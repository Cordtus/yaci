-- Drop yaci indexer schema objects
-- Note: This only drops raw tables. Parsed tables/triggers/functions are in yaci-explorer-apis.
BEGIN;

DROP TABLE IF EXISTS api.transactions_raw CASCADE;
DROP TABLE IF EXISTS api.blocks_raw CASCADE;

-- Don't drop schema - yaci-explorer-apis may still need it
-- DROP SCHEMA IF EXISTS api CASCADE;

COMMIT;
