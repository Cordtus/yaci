-- Migration 002: Add block_results_raw table for finalize_block_events
--
-- Block results contain consensus-level events that don't appear in transactions:
-- - Validator slashing events
-- - Validator jailing events
-- - Validator set updates
-- - Consensus parameter updates
--
-- This data is fetched via the new GetBlockResults gRPC endpoint
-- (requires republicd with cosmos-sdk feat/grpc-block-results-main)

BEGIN;

-- Raw block results from GetBlockResults
CREATE TABLE IF NOT EXISTS api.block_results_raw (
    height BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for querying blocks with finalize_block_events
CREATE INDEX IF NOT EXISTS idx_block_results_has_events
ON api.block_results_raw((jsonb_array_length(data->'finalizeBlockEvents') > 0))
WHERE jsonb_array_length(data->'finalizeBlockEvents') > 0;

-- Index for querying blocks with validator updates
CREATE INDEX IF NOT EXISTS idx_block_results_has_validator_updates
ON api.block_results_raw((jsonb_array_length(data->'validatorUpdates') > 0))
WHERE jsonb_array_length(data->'validatorUpdates') > 0;

-- Read access for PostgREST
GRANT SELECT ON api.block_results_raw TO web_anon;

COMMIT;
