BEGIN;

---
-- Update the trigger function to gracefully handle transactions with error metadata
-- (transactions that failed to fetch from the chain)
---
CREATE OR REPLACE FUNCTION update_transaction_main()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  error_text TEXT;
  proposal_ids TEXT[];
  has_tx_data BOOLEAN;
BEGIN
  -- Check if this is an error metadata record (lacks 'tx' and 'txResponse' fields)
  has_tx_data := (NEW.data ? 'tx') AND (NEW.data ? 'txResponse');

  IF NOT has_tx_data THEN
    -- This is an error metadata record, skip normal processing
    -- The trigger still needs to populate transactions_main with minimal data
    INSERT INTO api.transactions_main (id, fee, memo, error, height, timestamp, proposal_ids)
    VALUES (
              NEW.id,
              NULL, -- No fee data available
              NULL, -- No memo available
              COALESCE(NEW.data->>'reason', NEW.data->>'error', 'Transaction fetch failed'), -- Store error reason
              0, -- Unknown height
              NOW(), -- Use current timestamp as fallback
              NULL -- No proposal IDs
           )
    ON CONFLICT (id) DO UPDATE
    SET error = EXCLUDED.error;

    RETURN NEW;
  END IF;

  -- Normal processing for successfully fetched transactions
  error_text := NEW.data->'txResponse'->>'rawLog';

  IF error_text IS NULL THEN
    error_text := extract_proposal_failure_logs(NEW.data);
  END IF;

  proposal_ids := extract_proposal_ids(NEW.data->'txResponse'->'events');

  INSERT INTO api.transactions_main (id, fee, memo, error, height, timestamp, proposal_ids)
  VALUES (
            NEW.id,
            NEW.data->'tx'->'authInfo'->'fee',
            NEW.data->'tx'->'body'->>'memo',
            error_text,
            (NEW.data->'txResponse'->>'height')::BIGINT,
            (NEW.data->'txResponse'->>'timestamp')::TIMESTAMPTZ,
            proposal_ids
         )
  ON CONFLICT (id) DO UPDATE
  SET fee = EXCLUDED.fee,
      memo = EXCLUDED.memo,
      error = EXCLUDED.error,
      height = EXCLUDED.height,
      timestamp = EXCLUDED.timestamp,
      proposal_ids = EXCLUDED.proposal_ids;

  -- Insert top level messages (only if we have valid tx data)
  INSERT INTO api.messages_raw (id, message_index, data)
  SELECT
    NEW.id,
    message_index - 1,
    message
  FROM jsonb_array_elements(NEW.data->'tx'->'body'->'messages') WITH ORDINALITY AS message(message, message_index)
  ON CONFLICT (id, message_index) DO UPDATE
  SET data = EXCLUDED.data;

  -- Insert nested messages, e.g., messages within a proposal
  INSERT INTO api.messages_raw (id, message_index, data)
  SELECT
    NEW.id,
    -- We make a derived index for nested messages so they don't collide with top level messages
    10000 + ((top_level.msg_index - 1) * 1000) + sub_level.sub_index,
    sub_level.sub_msg
  FROM jsonb_array_elements(NEW.data->'tx'->'body'->'messages')
       WITH ORDINALITY AS top_level(msg, msg_index)
       CROSS JOIN LATERAL (
         SELECT sub_msg, sub_index
         FROM jsonb_array_elements(top_level.msg->'messages')
              WITH ORDINALITY AS inner_msg(sub_msg, sub_index)
       ) AS sub_level
  -- TODO: Add x/gov support
  WHERE top_level.msg->>'@type' = '/cosmos.group.v1.MsgSubmitProposal'
    AND top_level.msg->'messages' IS NOT NULL
  ON CONFLICT (id, message_index) DO UPDATE
  SET data = EXCLUDED.data;

  RETURN NEW;
END;
$$;

COMMIT;
