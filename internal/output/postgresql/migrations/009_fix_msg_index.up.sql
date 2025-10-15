-- Fix msg_index association by parsing from txResponse.logs instead of txResponse.events
-- This ensures events are properly associated with their message index

-- Update the trigger to parse from logs (which includes msg_index) instead of flattened events
CREATE OR REPLACE FUNCTION api.update_events_raw()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  log_entry jsonb;
  log_idx int;
  ev jsonb;
  global_ev_idx int := 0;
BEGIN
  -- Rebuild all events for this tx id (safe for INSERT and UPDATE)
  DELETE FROM api.events_raw WHERE id = NEW.id;

  -- Parse from txResponse.logs if available (provides msg_index)
  -- Falls back to txResponse.events if logs don't exist (shouldn't happen in modern Cosmos SDK)
  IF NEW.data->'txResponse'->'logs' IS NOT NULL AND jsonb_typeof(NEW.data->'txResponse'->'logs') = 'array' THEN
    -- Iterate through logs array (each log corresponds to a message)
    FOR log_entry, log_idx IN
      SELECT l, (ord::int - 1)
      FROM jsonb_array_elements(NEW.data->'txResponse'->'logs') WITH ORDINALITY AS t(l, ord)
    LOOP
      -- For each event in this log's events array
      FOR ev IN
        SELECT e
        FROM jsonb_array_elements(log_entry->'events') AS e
      LOOP
        -- Add msg_index to event data
        ev := jsonb_set(ev, '{msg_index}', to_jsonb(log_idx));

        INSERT INTO api.events_raw (id, event_index, data)
        VALUES (NEW.id, global_ev_idx, ev);

        global_ev_idx := global_ev_idx + 1;
      END LOOP;
    END LOOP;
  ELSE
    -- Fallback to txResponse.events (no msg_index available)
    FOR ev, global_ev_idx IN
      SELECT e, (ord::int - 1)
      FROM jsonb_array_elements(NEW.data->'txResponse'->'events') WITH ORDINALITY AS t(e, ord)
    LOOP
      INSERT INTO api.events_raw (id, event_index, data)
      VALUES (NEW.id, global_ev_idx, ev);
    END LOOP;
  END IF;

  RETURN NEW;
END $$;

-- Rebuild events_raw table with new msg_index data
TRUNCATE api.events_raw;

INSERT INTO api.events_raw (id, event_index, data)
SELECT
  tr.id,
  ROW_NUMBER() OVER (PARTITION BY tr.id ORDER BY log_ord, ev_ord) - 1 AS event_index,
  jsonb_set(ev, '{msg_index}', to_jsonb(log_ord)) AS data
FROM api.transactions_raw tr
CROSS JOIN LATERAL (
  SELECT l, (ord::int - 1) AS log_ord
  FROM jsonb_array_elements(tr.data->'txResponse'->'logs') WITH ORDINALITY AS t(l, ord)
) AS logs
CROSS JOIN LATERAL (
  SELECT e, (ord::int - 1) AS ev_ord
  FROM jsonb_array_elements(logs.l->'events') WITH ORDINALITY AS t(e, ord)
) AS events(ev, ev_ord)
WHERE tr.data->'txResponse'->'logs' IS NOT NULL
  AND jsonb_typeof(tr.data->'txResponse'->'logs') = 'array';

-- Handle transactions that don't have logs (fallback to events)
INSERT INTO api.events_raw (id, event_index, data)
SELECT
  tr.id,
  (ord::int - 1) AS event_index,
  ev
FROM api.transactions_raw tr
CROSS JOIN LATERAL jsonb_array_elements(tr.data->'txResponse'->'events')
  WITH ORDINALITY AS t(ev, ord)
WHERE tr.data->'txResponse'->'logs' IS NULL
  OR jsonb_typeof(tr.data->'txResponse'->'logs') != 'array'
  AND tr.id NOT IN (SELECT DISTINCT id FROM api.events_raw);
