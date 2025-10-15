-- Revert to parsing from txResponse.events (without msg_index)

CREATE OR REPLACE FUNCTION api.update_events_raw()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  ev jsonb;
  ev_ord int;
BEGIN
  -- Rebuild all events for this tx id (safe for INSERT and UPDATE)
  DELETE FROM api.events_raw WHERE id = NEW.id;

  FOR ev, ev_ord IN
    SELECT e, (ord::int - 1)
    FROM jsonb_array_elements(NEW.data->'txResponse'->'events') WITH ORDINALITY AS t(e, ord)
  LOOP
    INSERT INTO api.events_raw (id, event_index, data)
    VALUES (NEW.id, ev_ord, ev);
  END LOOP;

  RETURN NEW;
END $$;

-- Rebuild events_raw table with old structure
TRUNCATE api.events_raw;

INSERT INTO api.events_raw (id, event_index, data)
SELECT
  tr.id,
  (ord::int - 1) AS event_index,
  ev
FROM api.transactions_raw tr
CROSS JOIN LATERAL jsonb_array_elements(tr.data->'txResponse'->'events')
  WITH ORDINALITY AS t(ev, ord);
