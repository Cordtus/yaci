-- Create api schema
CREATE SCHEMA IF NOT EXISTS api;

-- Raw block data storage
CREATE TABLE IF NOT EXISTS api.blocks_raw (
    id BIGINT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Raw transaction data storage
CREATE TABLE IF NOT EXISTS api.transactions_raw (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_blocks_raw_created_at ON api.blocks_raw(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_raw_created_at ON api.transactions_raw(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_raw_data ON api.transactions_raw USING GIN (data);

-- Grant permissions for PostgREST anonymous access
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
END
$$;

GRANT USAGE ON SCHEMA api TO web_anon;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO web_anon;
