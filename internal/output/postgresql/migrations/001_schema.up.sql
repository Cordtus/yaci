-- Minimal schema for yaci indexer
-- Only creates raw tables that the indexer writes to directly
-- All parsing logic, triggers, views, and functions are in yaci-explorer-apis

BEGIN;

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schema
CREATE SCHEMA IF NOT EXISTS api;

-- Create web_anon role for PostgREST (read-only)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'web_anon') THEN
    CREATE ROLE web_anon NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA api TO web_anon;

--------------------------------------------------------------------------------
-- RAW TABLES (written by yaci indexer)
--------------------------------------------------------------------------------

-- Raw block data from GetBlockWithTxs
CREATE TABLE IF NOT EXISTS api.blocks_raw (
    id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    tx_count INTEGER DEFAULT 0
);

-- Raw transaction data from GetBlockWithTxs
CREATE TABLE IF NOT EXISTS api.transactions_raw (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL
);

--------------------------------------------------------------------------------
-- INDEXES ON RAW TABLES
--------------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_blocks_tx_count ON api.blocks_raw(tx_count) WHERE tx_count > 0;

--------------------------------------------------------------------------------
-- PERMISSIONS
--------------------------------------------------------------------------------

-- Read access to raw tables for PostgREST
GRANT SELECT ON api.blocks_raw TO web_anon;
GRANT SELECT ON api.transactions_raw TO web_anon;

COMMIT;
