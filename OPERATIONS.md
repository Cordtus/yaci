# YACI Explorer Stack Operations Guide

## System Architecture Overview

### Component Purpose and Interaction

**1. Yaci Indexer**

* Go-based extractor for Cosmos gRPC
* Polls blocks/transactions
* Stores raw JSON in PostgreSQL
* Resumes via `COALESCE(MAX(id),0)`
* Configurable concurrency/retries
* External dependency

**2. Middleware Layer**

* Three-process architecture on Fly.io:
  * `app`: PostgREST API server (port 3000)
  * `worker`: EVM decode daemon (batch processing)
  * `priority_decoder`: Priority EVM decode via NOTIFY/LISTEN
* PostgREST exposes PostgreSQL schema as REST
* SQL functions implement filtering/pagination/aggregation
* Materialized views provide analytics (daily/hourly tx counts, message types)
* Triggers convert raw JSON into structured tables
* Triggers extract governance data (MsgSubmitProposal, MsgVote)
* No external API dependencies; all data derived from indexed gRPC transactions
* TypeScript client for typed API consumption
* All business logic resides in middleware

**3. Frontend Application**

* React Router client
* TanStack Query caching
* Radix UI + Tailwind
* Typed API client
* Cosmos/EVM transaction display
* Local IBC denom resolution

### Data Flow Pipeline

```
Cosmos SDK Chain (gRPC)
    |
    v
Yaci Indexer
    |
    v (INSERT operations)
PostgreSQL api.transactions_raw
    |
    v (Database triggers fire automatically)
PostgreSQL api.transactions_main/messages_main/events_main
    |
    +---> PostgREST API (HTTP REST) ---> Frontend (User Interface)
    |
    +---> EVM Worker (Background processing)
            |
            v
        api.evm_transactions/evm_logs/evm_token_transfers
```

**Detailed Flow**

1. Indexer polls gRPC
2. Extracts blocks/transactions
3. Inserts into raw tables
4. Triggers parse metadata, events, messages
5. PostgREST exposes structured tables
6. Worker decodes pending EVM transactions
7. Frontend reads API
8. TanStack Query caches responses

---

## Configuration Reference

### Yaci Indexer Configuration

The gRPC endpoint is passed as a **positional CLI argument**, not an environment variable.

**Command syntax:**
```bash
yaci extract <GRPC_ENDPOINT> postgres -p <POSTGRES_CONNECTION_STRING>
```

**Environment variables** (prefix: `YACI_`, dashes become underscores):
```bash
# Database connection (required)
YACI_POSTGRES_CONN=postgres://user:password@host:5432/postgres

# Optional overrides
YACI_START=0                    # Start block height (0 = resume from MAX(id))
YACI_STOP=0                     # Stop block height (0 = no limit)
YACI_MAX_CONCURRENCY=100        # Concurrent gRPC requests (default: 100)
YACI_BLOCK_TIME=2               # Polling interval in seconds (default: 2)
YACI_MAX_RETRIES=3              # Connection retry attempts (default: 3)
YACI_INSECURE=false             # Skip TLS verification (default: false)
YACI_LOGLEVEL=info              # Log level: debug|info|warn|error (default: info)
YACI_MAX_RECV_MSG_SIZE=4194304  # Max gRPC message size in bytes (default: 4MB)
YACI_LIVE=false                 # Enable live monitoring mode
YACI_REINDEX=false              # Reindex from block 1
YACI_ENABLE_PROMETHEUS=false    # Enable Prometheus metrics
YACI_PROMETHEUS_ADDR=0.0.0.0:2112  # Prometheus listen address
```

**Config file support:** Yaci also reads from `config.yaml`, `config.json`, or `config.toml` in `.`, `$HOME/.yaci`, or `/etc/yaci`.

### Middleware Configuration

**PostgREST**

```bash
PGRST_DB_URI=postgres://authenticator:password@host:5432/postgres
PGRST_DB_ANON_ROLE=web_anon
PGRST_DB_SCHEMAS=api
PGRST_SERVER_PORT=3000
```

**EVM Worker**

```bash
DATABASE_URL=postgres://postgres:password@host:5432/postgres
POLL_INTERVAL_MS=5000
BATCH_SIZE=100
```

### Frontend Configuration

```bash
VITE_POSTGREST_URL=https://yaci-explorer-apis.fly.dev
VITE_CHAIN_REST_ENDPOINT=https://rest.example.com
```

---

## Database Schema Architecture

### Raw Storage Tables

| Table | Purpose |
| ----- | ------- |
| `api.blocks_raw` | Raw block JSON (id BIGINT, data JSONB) |
| `api.transactions_raw` | Raw transaction JSON (id TEXT, data JSONB) |
| `api.messages_raw` | Flattened messages (id, message_index, data) |

Note: Events are parsed directly into `events_main` via triggers; there is no `events_raw` table.

### Parsed Tables

| Table | Purpose |
| ----- | ------- |
| `api.transactions_main` | Parsed transaction metadata (height, timestamp, fee, memo, error, proposal_ids) |
| `api.messages_main` | Parsed messages with sender/mentions (type, sender, mentions[], metadata) |
| `api.events_main` | Normalized event attributes (event_type, attr_key, attr_value, msg_index) |

### EVM Tables

| Table | Purpose |
| ----- | ------- |
| `api.evm_transactions` | Decoded EVM transactions (hash, from, to, value, gas, function_name) |
| `api.evm_logs` | EVM event logs (address, topics[], data) |
| `api.evm_token_transfers` | ERC-20/721 transfers (token_address, from, to, value) |
| `api.evm_tokens` | Token metadata (address, name, symbol, decimals, type) |
| `api.evm_contracts` | Contract metadata (address, creator, creation_tx, abi) |

### Governance Tables

| Table | Purpose |
| ----- | ------- |
| `api.governance_proposals` | Proposals extracted from indexed transactions |
| `api.governance_snapshots` | Proposal vote snapshots over time |

### Analytics Views

| View | Purpose |
| ---- | ------- |
| `api.chain_stats` | Latest block, total transactions, unique addresses |
| `api.tx_volume_daily` | Daily transaction counts |
| `api.tx_volume_hourly` | Hourly transaction counts |
| `api.message_type_stats` | Message type distribution |
| `api.gas_usage_distribution` | Gas usage buckets |
| `api.tx_success_rate` | Success/failure rates |
| `api.fee_revenue` | Fee totals by denomination |
| `api.evm_tx_map` | Cosmos hash to ETH hash mapping |
| `api.evm_pending_decode` | EVM decode queue |

### Materialized Views (require periodic refresh)

| View | Purpose |
| ---- | ------- |
| `api.mv_daily_tx_stats` | Cached daily transaction statistics |
| `api.mv_hourly_tx_stats` | Cached hourly transaction statistics |
| `api.mv_message_type_stats` | Cached message type distribution |

Refresh with: `SELECT api.refresh_analytics_views();`

---

## Security Model

### PostgreSQL Roles

**postgres**

* Full access
* Migrations only

**yaci_writer** (must be created manually)

* INSERT on raw tables only
* Used by Yaci indexer

**authenticator** (must be created manually)

* LOGIN, switches to web_anon
* Used by PostgREST

**web_anon**

* SELECT on main tables/views
* EXECUTE on API functions
* Read-only

Note: The `yaci_writer` and `authenticator` roles are **not created by the migrations**. They must be created manually before deployment:

```sql
CREATE ROLE yaci_writer WITH LOGIN PASSWORD 'your_password';
GRANT INSERT ON api.blocks_raw, api.transactions_raw TO yaci_writer;

CREATE ROLE authenticator WITH LOGIN PASSWORD 'your_password' NOINHERIT;
CREATE ROLE web_anon NOLOGIN;
GRANT web_anon TO authenticator;
```

**Permission Grants** (from migrations):

```sql
GRANT SELECT ON ALL TABLES IN SCHEMA api TO web_anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA api TO web_anon;
GRANT USAGE ON SCHEMA api TO web_anon;
```

---

## Deployment Procedures

### Step 1: Deploy PostgreSQL

```bash
fly postgres create republic-yaci-pg \
  --region sjc \
  --vm-size shared-cpu-1x \
  --volume-size 10

fly postgres connect -a republic-yaci-pg
```

### Step 2: Apply Database Migrations

There are 13 migrations that must be applied in order:

```bash
cd ~/repos/yaci-explorer-apis

# Apply all migrations
cat migrations/001_complete_schema.sql | fly postgres connect -a republic-yaci-pg
cat migrations/002_add_yaci_triggers.sql | fly postgres connect -a republic-yaci-pg
cat migrations/003_fix_proposal_ids_type.sql | fly postgres connect -a republic-yaci-pg
cat migrations/004_fix_get_transactions_paginated.sql | fly postgres connect -a republic-yaci-pg
cat migrations/005_fix_get_transactions_by_address.sql | fly postgres connect -a republic-yaci-pg
cat migrations/006_add_get_blocks_paginated.sql | fly postgres connect -a republic-yaci-pg
cat migrations/007_add_governance_tables.sql | fly postgres connect -a republic-yaci-pg
cat migrations/008_performance_indexes.sql | fly postgres connect -a republic-yaci-pg
cat migrations/009_optimize_get_blocks_paginated.sql | fly postgres connect -a republic-yaci-pg
cat migrations/010_add_priority_evm_decode.sql | fly postgres connect -a republic-yaci-pg
cat migrations/011_enable_pg_stat_statements.sql | fly postgres connect -a republic-yaci-pg
cat migrations/012_materialized_analytics.sql | fly postgres connect -a republic-yaci-pg
cat migrations/013_governance_from_indexed_data.sql | fly postgres connect -a republic-yaci-pg

# Or apply all at once
for f in migrations/*.sql; do cat "$f" | fly postgres connect -a republic-yaci-pg; done

# Verify schema
fly postgres connect -a republic-yaci-pg -c "\dt api.*"
fly postgres connect -a republic-yaci-pg -c "SELECT COUNT(*) FROM pg_trigger WHERE tgrelid = 'api.transactions_raw'::regclass;"
```

### Step 3: Deploy Middleware

```bash
cd ~/repos/yaci-explorer-apis

fly apps create yaci-explorer-apis --org personal
fly secrets set DATABASE_URL="postgres://postgres:PASSWORD@republic-yaci-pg.flycast:5432/postgres?sslmode=disable" -a yaci-explorer-apis
fly secrets set PGRST_DB_URI="postgres://authenticator:PASSWORD@republic-yaci-pg.flycast:5432/postgres" -a yaci-explorer-apis
fly deploy -a yaci-explorer-apis
fly status -a yaci-explorer-apis
curl https://yaci-explorer-apis.fly.dev/
```

### Step 4: Deploy Indexer

The yaci repository does not include a `fly.toml`. Deploy using Docker or create your own Fly config.

**Option A: Docker Compose** (from yaci-explorer repo):
```bash
cd ~/repos/yaci-explorer
docker compose -f docker/docker-compose.yml up -d yaci
```

**Option B: Manual Fly.io deployment:**
```bash
cd ~/repos/yaci

# Create fly.toml
cat > fly.toml << 'EOF'
app = "republic-yaci-indexer"
primary_region = "sjc"

[build]
  image = "ghcr.io/cordtus/yaci:main"

[env]
  YACI_LOGLEVEL = "info"
  YACI_MAX_CONCURRENCY = "100"
  YACI_LIVE = "true"
  YACI_ENABLE_PROMETHEUS = "true"
  YACI_PROMETHEUS_ADDR = "0.0.0.0:2112"

[[services]]
  internal_port = 2112
  protocol = "tcp"

[[vm]]
  memory = "512mb"
  cpu_kind = "shared"
  cpus = 1
EOF

fly apps create republic-yaci-indexer --org personal

# Set the postgres connection string
fly secrets set YACI_POSTGRES_CONN="postgres://yaci_writer:PASSWORD@republic-yaci-pg.flycast:5432/postgres" -a republic-yaci-indexer

# Note: gRPC endpoint must be in the command, not as env var
# Modify fly.toml [experimental] cmd or Dockerfile CMD to include:
# yaci extract rpc.example.com:9090 postgres

fly deploy -a republic-yaci-indexer
fly logs -a republic-yaci-indexer
```

### Step 5: Deploy Frontend

```bash
cd ~/repos/yaci-explorer
echo "VITE_POSTGREST_URL=https://yaci-explorer-apis.fly.dev" > .env.production
fly apps create yaci-explorer --org personal
fly deploy -a yaci-explorer
curl https://yaci-explorer.fly.dev
```

---

## Updating Components

```bash
cd ~/repos/yaci-explorer-apis
git pull origin main
fly deploy -a yaci-explorer-apis
```

```bash
cd ~/repos/yaci-explorer
git pull origin main
fly deploy -a yaci-explorer
```

```bash
cat migrations/014_new_migration.sql | fly postgres connect -a republic-yaci-pg
```

```bash
cd ~/repos/yaci
git pull origin main
fly deploy -a republic-yaci-indexer
```

---

## Rollback Procedures

```bash
fly releases -a yaci-explorer-apis
fly releases rollback <version> -a yaci-explorer-apis
```

```bash
fly postgres connect -a republic-yaci-pg < backup.sql
fly postgres backup restore <backup-id> -a republic-yaci-pg
```

---

## Operations Manual

### Status / Start / Stop

```bash
fly status -a republic-yaci-indexer
fly status -a yaci-explorer-apis
fly status -a yaci-explorer
```

```bash
fly machines list -a republic-yaci-indexer
fly machine stop <machine-id> -a republic-yaci-indexer
fly machine start <machine-id> -a republic-yaci-indexer
```

### Restart / Scale Middleware

```bash
fly machine restart <machine-id> -a yaci-explorer-apis
cd ~/repos/yaci-explorer-apis
fly deploy -a yaci-explorer-apis
```

```bash
fly scale count 2 --process-group=app -a yaci-explorer-apis
fly scale count 2 --process-group=worker -a yaci-explorer-apis
```

---

## Monitoring and Observability

### KPIs

* Indexed block height
* Parsed vs raw rows
* Pending EVM decode queue
* API latency and errors

### Commands

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT MAX(id) as latest_block, COUNT(*) as total_blocks, MAX(data->>'time') as latest_block_time
FROM api.blocks_raw;"
```

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT
  (SELECT COUNT(*) FROM api.transactions_raw) raw_txs,
  (SELECT COUNT(*) FROM api.transactions_main) parsed_txs,
  (SELECT COUNT(*) FROM api.messages_main) messages,
  (SELECT COUNT(*) FROM api.events_main) events;
"
```

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT
  (SELECT COUNT(*) FROM api.evm_pending_decode) pending,
  (SELECT COUNT(*) FROM api.evm_transactions) decoded;
"
```

```bash
fly logs -a yaci-explorer-apis --instance=<worker-id>
curl -i https://yaci-explorer-apis.fly.dev/
fly logs -a yaci-explorer-apis --instance=<app-id>
```

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT datname, usename, application_name, state, query_start
FROM pg_stat_activity WHERE datname = 'postgres';
"
```

---

## Maintenance Tasks

### Daily

* Check indexer height
* Check API health
* Review logs

### Weekly

```bash
fly postgres connect -a republic-yaci-pg -c "VACUUM ANALYZE;"
```

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT schemaname, tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) table_size,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) indexes_size
FROM pg_tables WHERE schemaname = 'api'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"
```

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT query, calls, total_exec_time, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
"
```

### Monthly

```bash
fly postgres backup create -a republic-yaci-pg
fly postgres backup list -a republic-yaci-pg
```

```bash
fly postgres connect -a republic-yaci-pg -c "
SELECT schemaname, tablename, indexname, idx_scan, idx_tup_read, idx_tup_fetch
FROM pg_stat_user_indexes WHERE schemaname = 'api'
ORDER BY idx_scan;
"
```

---

## Handling Genesis Resets (Devnet)

```bash
fly machine stop <indexer-id> -a republic-yaci-indexer
```

```bash
fly postgres connect -a republic-yaci-pg -c "
BEGIN;
TRUNCATE api.blocks_raw CASCADE;
TRUNCATE api.transactions_raw CASCADE;
TRUNCATE api.evm_transactions CASCADE;
TRUNCATE api.evm_logs CASCADE;
TRUNCATE api.evm_token_transfers CASCADE;
TRUNCATE api.evm_tokens CASCADE;
COMMIT;
"
```

```bash
fly machine start <indexer-id> -a republic-yaci-indexer
fly logs -a republic-yaci-indexer
```

---

## Trigger Backfill Process

```bash
cd ~/repos/yaci-explorer-apis
fly proxy 15433:5432 -a republic-yaci-pg &
export DATABASE_URL="postgres://postgres:PASSWORD@localhost:15433/postgres?sslmode=disable"
npx tsx scripts/backfill-triggers.ts
```

---

## Development Workflow

```bash
git clone https://github.com/Cordtus/yaci.git
git clone https://github.com/Cordtus/yaci-explorer-apis.git
git clone https://github.com/Cordtus/yaci-explorer.git
```

```bash
docker run -d \
  --name yaci-postgres \
  -e POSTGRES_PASSWORD=foobar \
  -p 5432:5432 \
  postgres:16
```

```bash
cat yaci-explorer-apis/migrations/*.sql | psql postgres://postgres:foobar@localhost/postgres
```

**Run indexer locally** (note: gRPC is a positional argument):
```bash
cd yaci
export YACI_POSTGRES_CONN="postgres://postgres:foobar@localhost/postgres"
go run main.go extract testnet.example.com:9090 postgres -p "$YACI_POSTGRES_CONN"
```

```bash
cd yaci-explorer-apis
export PGRST_DB_URI="postgres://postgres:foobar@localhost/postgres"
export PGRST_DB_ANON_ROLE="web_anon"
postgrest &
export DATABASE_URL="postgres://postgres:foobar@localhost/postgres"
npx tsx scripts/decode-evm-daemon.ts &
```

```bash
cd yaci-explorer
echo "VITE_POSTGREST_URL=http://localhost:3000" > .env.local
yarn dev
```

---

## Testing Changes

```bash
cd yaci-explorer-apis
yarn typecheck
cat migrations/00X_test.sql | psql $DATABASE_URL
export DATABASE_URL="..."
npx tsx scripts/decode-evm-daemon.ts
```

```bash
cd yaci-explorer
yarn typecheck
yarn build
yarn test
```

---

## Creating New Migrations

```bash
cd yaci-explorer-apis
cat > migrations/014_new_feature.sql << 'EOF'
BEGIN;
-- Add new columns, tables, functions, etc.
COMMIT;
EOF
```

```bash
cat migrations/014_new_feature.sql | psql $LOCAL_DATABASE_URL
```

```bash
cat > migrations/014_new_feature.down.sql << 'EOF'
BEGIN;
-- Reverse all changes
COMMIT;
EOF
```

```bash
cat migrations/014_new_feature.sql | fly postgres connect -a republic-yaci-pg
```

---

## CI/CD Pipeline

### GitHub Actions Workflows

**Build Workflow**

* PRs and pushes to main
* Checkout, Node.js setup, install deps, typecheck, migration validation

**Deploy Workflow**

* Push to main or manual trigger
* Checkout, flyctl setup, deploy

### Branch Strategy

* `main`: production
* `feature/*`: feature work

### Required Secrets

* `FLY_API_TOKEN`

### Manual Deployment

```bash
cd yaci-explorer-apis
fly deploy --remote-only -a yaci-explorer-apis

cd yaci-explorer
fly deploy --remote-only -a yaci-explorer
```

---

## Advanced Topics

### Custom SQL Functions

```sql
CREATE OR REPLACE FUNCTION api.get_address_summary(_address TEXT)
RETURNS JSONB
LANGUAGE SQL STABLE
AS $$
  WITH tx_stats AS (
    SELECT
      COUNT(DISTINCT t.id) as total_txs,
      SUM((t.fee->'amount'->0->>'amount')::BIGINT) as total_fees,
      MIN(t.timestamp) as first_seen,
      MAX(t.timestamp) as last_seen
    FROM api.transactions_main t
    JOIN api.messages_main m ON t.id = m.id
    WHERE m.sender = _address OR m.mentions @> ARRAY[_address]
  )
  SELECT jsonb_build_object(
    'address', _address,
    'total_transactions', COALESCE(total_txs, 0),
    'total_fees_paid', COALESCE(total_fees, 0),
    'first_seen', first_seen,
    'last_seen', last_seen
  )
  FROM tx_stats;
$$;

GRANT EXECUTE ON FUNCTION api.get_address_summary(TEXT) TO web_anon;
```

### Performance Optimization

```sql
CREATE INDEX CONCURRENTLY idx_msg_sender_height
ON api.messages_main(sender, height DESC)
WHERE message_index < 10000;

CREATE INDEX CONCURRENTLY idx_evm_tx_hash
ON api.evm_transactions(hash)
WHERE status = 1;

CREATE INDEX CONCURRENTLY idx_msg_mentions_gin
ON api.messages_main USING GIN(mentions);
```

```sql
WITH recent_blocks AS (
  SELECT id, data
  FROM api.blocks_raw
  WHERE id > (SELECT MAX(id) - 100 FROM api.blocks_raw)
)
SELECT ...;
```

```sql
SELECT
  t.*,
  (SELECT jsonb_agg(m.*) FROM api.messages_main m WHERE m.id = t.id) as messages
FROM api.transactions_main t;
```

### Scaling Considerations

```bash
fly postgres update --vm-size dedicated-cpu-1x -a republic-yaci-pg
fly scale vm shared-cpu-2x -a yaci-explorer-apis
```

```bash
fly scale count 3 --process-group=app -a yaci-explorer-apis
fly postgres attach --app yaci-explorer-apis republic-yaci-pg
```

```sql
CREATE TABLE api.transactions_main_2024_01 PARTITION OF api.transactions_main
FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

---

## Appendix

### Useful SQL Queries

```sql
SELECT id, height, (fee->'amount'->0->>'amount')::BIGINT as fee_amount
FROM api.transactions_main
ORDER BY fee_amount DESC NULLS LAST
LIMIT 100;
```

```sql
SELECT type, COUNT(*) as count
FROM api.messages_main
WHERE message_index < 10000
GROUP BY type
ORDER BY count DESC;
```

```sql
SELECT
  et.hash,
  et."from",
  et."to",
  et.value::TEXT,
  t.timestamp
FROM api.evm_transactions et
JOIN api.transactions_main t ON et.tx_id = t.id
ORDER BY t.timestamp DESC
LIMIT 50;
```

```sql
SELECT
  token_address,
  COUNT(*) as transfer_count,
  COUNT(DISTINCT from_address) as unique_senders
FROM api.evm_token_transfers
GROUP BY token_address
ORDER BY transfer_count DESC;
```

### Common Fly.io Commands

```bash
fly ssh console -a yaci-explorer-apis
fly ssh console -a yaci-explorer-apis -C "ls -la"
fly ssh sftp get /path/in/container /local/path -a yaci-explorer-apis
fly dashboard -a yaci-explorer-apis
fly apps list
fly config show -a yaci-explorer-apis
```

### Environment-Specific Configurations

**Development**

* Local DB, local PostgREST, Vite dev server, mock data

**Staging**

* Staging Fly apps, separate DB, testnet

**Production**

* Production Fly apps, backups, mainnet, autoscaling
