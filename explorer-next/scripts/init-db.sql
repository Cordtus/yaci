-- Database initialization and optimization script for Yaci Explorer
-- This script sets up indexes and configurations for efficient querying of large datasets

-- Create web_anon role for PostgREST
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_anon') THEN
        CREATE ROLE web_anon NOLOGIN;
    END IF;
END $$;

-- Grant necessary permissions
GRANT USAGE ON SCHEMA api TO web_anon;
GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA api GRANT SELECT ON TABLES TO web_anon;

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS btree_gin;
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Create indexes for blocks table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocks_height ON api.blocks_raw(id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocks_time ON api.blocks_raw((data->>'time'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocks_proposer ON api.blocks_raw((data->'block'->'header'->>'proposer_address'));
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_blocks_hash ON api.blocks_raw((data->'block_id'->>'hash'));

-- Create indexes for transactions table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_height ON api.transactions_main(height);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_hash ON api.transactions_main(hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_time ON api.transactions_main(time);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_code ON api.transactions_main(code);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_gas ON api.transactions_main(gas_wanted, gas_used);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_memo ON api.transactions_main(memo) WHERE memo IS NOT NULL;

-- Composite index for common queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_height_time ON api.transactions_main(height DESC, time DESC);

-- GIN index for JSONB fee column (for fee analysis)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_tx_fee ON api.transactions_main USING GIN (fee);

-- Create indexes for messages table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_tx ON api.messages_main(tx_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_type ON api.messages_main(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_index ON api.messages_main(msg_index);

-- Composite index for message queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_msg_tx_type ON api.messages_main(tx_id, type);

-- Create indexes for events table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_tx ON api.events_main(tx_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_type ON api.events_main(type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_msg ON api.events_main(msg_index);

-- GIN index for attributes JSONB
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_event_attrs ON api.events_main USING GIN (attributes);

-- Create indexes for normalized_events table
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_tx ON api.normalized_events(tx_hash);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_type ON api.normalized_events(event_type);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_action ON api.normalized_events(action);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_sender ON api.normalized_events(sender);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_recipient ON api.normalized_events(recipient);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_amount ON api.normalized_events(amount);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_denom ON api.normalized_events(denom);

-- Composite indexes for common address queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_sender_type
    ON api.normalized_events(sender, event_type) WHERE sender IS NOT NULL;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_norm_event_recipient_type
    ON api.normalized_events(recipient, event_type) WHERE recipient IS NOT NULL;

-- Create partitioning for large tables (if needed)
-- This is commented out by default but can be enabled for very large datasets
/*
-- Partition transactions by month
CREATE TABLE IF NOT EXISTS api.transactions_main_partitioned (
    LIKE api.transactions_main INCLUDING ALL
) PARTITION BY RANGE (time);

-- Create partitions for the last 12 months
DO $$
DECLARE
    start_date date;
    end_date date;
    partition_name text;
BEGIN
    FOR i IN 0..11 LOOP
        start_date := date_trunc('month', CURRENT_DATE - interval '1 month' * i);
        end_date := start_date + interval '1 month';
        partition_name := 'transactions_' || to_char(start_date, 'YYYY_MM');

        EXECUTE format('CREATE TABLE IF NOT EXISTS api.%I PARTITION OF api.transactions_main_partitioned
            FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date);
    END LOOP;
END $$;
*/

-- Create materialized views for expensive aggregations
CREATE MATERIALIZED VIEW IF NOT EXISTS api.hourly_stats AS
SELECT
    date_trunc('hour', time) as hour,
    COUNT(*) as tx_count,
    SUM(gas_used) as total_gas_used,
    SUM(gas_wanted) as total_gas_wanted,
    AVG(gas_used::numeric / NULLIF(gas_wanted, 0)) as avg_gas_efficiency,
    COUNT(DISTINCT (fee->>'denom')) as unique_denoms
FROM api.transactions_main
WHERE time IS NOT NULL
GROUP BY 1
WITH DATA;

CREATE INDEX ON api.hourly_stats(hour DESC);

CREATE MATERIALIZED VIEW IF NOT EXISTS api.daily_stats AS
SELECT
    date_trunc('day', time) as day,
    COUNT(*) as tx_count,
    COUNT(DISTINCT height) as block_count,
    SUM(gas_used) as total_gas_used,
    SUM(gas_wanted) as total_gas_wanted,
    AVG(gas_used::numeric / NULLIF(gas_wanted, 0)) as avg_gas_efficiency
FROM api.transactions_main
WHERE time IS NOT NULL
GROUP BY 1
WITH DATA;

CREATE INDEX ON api.daily_stats(day DESC);

-- Create function to refresh materialized views
CREATE OR REPLACE FUNCTION api.refresh_stats_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY api.hourly_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY api.daily_stats;
END;
$$ LANGUAGE plpgsql;

-- Schedule periodic refresh (requires pg_cron extension)
-- Uncomment if pg_cron is installed
/*
SELECT cron.schedule('refresh-stats', '*/5 * * * *', 'SELECT api.refresh_stats_views()');
*/

-- Optimize table statistics for better query planning
ANALYZE api.blocks_raw;
ANALYZE api.transactions_main;
ANALYZE api.messages_main;
ANALYZE api.events_main;
ANALYZE api.normalized_events;

-- Set table storage parameters for better performance
ALTER TABLE api.transactions_main SET (fillfactor = 90);
ALTER TABLE api.messages_main SET (fillfactor = 90);
ALTER TABLE api.events_main SET (fillfactor = 90);
ALTER TABLE api.normalized_events SET (fillfactor = 90);

-- Enable parallel queries for large tables
ALTER TABLE api.transactions_main SET (parallel_workers = 4);
ALTER TABLE api.messages_main SET (parallel_workers = 4);
ALTER TABLE api.events_main SET (parallel_workers = 4);
ALTER TABLE api.normalized_events SET (parallel_workers = 4);

-- Create function for efficient address transaction lookup
CREATE OR REPLACE FUNCTION api.get_address_transactions(
    address_param text,
    limit_param integer DEFAULT 100,
    offset_param integer DEFAULT 0
)
RETURNS TABLE (
    tx_hash text,
    height bigint,
    time timestamptz,
    event_type text,
    action text,
    amount text,
    denom text,
    is_sender boolean
) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        ne.tx_hash,
        t.height,
        t.time,
        ne.event_type,
        ne.action,
        ne.amount,
        ne.denom,
        (ne.sender = address_param) as is_sender
    FROM api.normalized_events ne
    JOIN api.transactions_main t ON t.hash = ne.tx_hash
    WHERE ne.sender = address_param OR ne.recipient = address_param
    ORDER BY t.time DESC
    LIMIT limit_param
    OFFSET offset_param;
END;
$$ LANGUAGE plpgsql STABLE PARALLEL SAFE;

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION api.get_address_transactions TO web_anon;

COMMENT ON FUNCTION api.get_address_transactions IS
    'Efficiently retrieve transactions for a given address with pagination support';

-- Output optimization summary
DO $$
BEGIN
    RAISE NOTICE 'Database optimization complete:';
    RAISE NOTICE '  - Created % indexes for efficient querying',
        (SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'api');
    RAISE NOTICE '  - Created materialized views for aggregations';
    RAISE NOTICE '  - Configured table storage parameters';
    RAISE NOTICE '  - Enabled parallel query execution';
    RAISE NOTICE '  - Created optimized functions for common queries';
END $$;