BEGIN;

CREATE VIEW api.evm_tx_map AS
SELECT
  t.id AS tx_id,
  t.height,
  t.timestamp,
  MAX(CASE WHEN e.attr_key = 'ethereumTxHash' THEN e.attr_value END) AS ethereum_tx_hash,
  MAX(CASE WHEN e.attr_key = 'recipient'      THEN e.attr_value END) AS recipient,
  MAX(
    CASE
      WHEN e.attr_key = 'txGasUsed' THEN NULLIF(e.attr_value, '')::numeric
      ELSE NULL
    END
  )::bigint AS gas_used
FROM api.transactions_main t
JOIN api.events_main e ON e.id = t.id
WHERE e.event_type = 'ethereum_tx'
GROUP BY t.id, t.height, t.timestamp;

CREATE VIEW api.evm_address_activity AS
SELECT
  addr AS address,
  COUNT(DISTINCT tx_id) AS tx_count,
  MIN(timestamp) AS first_seen,
  MAX(timestamp) AS last_seen
FROM (
  SELECT
    t.id AS tx_id,
    t.timestamp,
    e.attr_value AS addr
  FROM api.transactions_main t
  JOIN api.events_main e ON e.id = t.id
  WHERE e.attr_value LIKE '0x%'
    AND (
      (e.event_type = 'ethereum_tx' AND e.attr_key = 'recipient')
      OR (e.event_type = 'message'      AND e.attr_key = 'sender')
    )
) AS x
GROUP BY addr;

COMMIT;

