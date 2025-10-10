# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

`yaci` is a Go-based blockchain data extraction tool that connects to Cosmos SDK chains via gRPC and indexes block/transaction data into PostgreSQL. It includes a modern block explorer UI for visualizing the indexed data, with native support for both Cosmos and EVM transactions.

## Architecture

### Core Components

1. **Extractors** (`internal/extractor/`): Handle blockchain data extraction
   - `extractor.go`: Main extraction orchestrator
   - `block.go`, `transaction.go`: Parse block and transaction data
   - `live.go`: Live monitoring implementation
   - `evm_enhanced.go`: EVM transaction processing for chains with EVM support

2. **Output Handlers** (`internal/output/`): Data storage implementations
   - `postgresql/`: PostgreSQL storage with migrations
   - Database triggers automatically parse raw JSON data into normalized tables

3. **Client** (`internal/client/`): gRPC client management
   - Auto-discovers protobuf definitions via server reflection
   - Handles connection pooling and retries

4. **Metrics** (`internal/metrics/`): Prometheus metrics collectors
   - Custom collectors for chain-specific metrics (locked tokens, payouts, etc.)
   - Metrics server exposed on port 2112

5. **EVM Integration** (`internal/evm/`): EVM transaction processing
   - Parses EVM transactions from Cosmos SDK transactions
   - Converts to Blockscout-compatible format for indexing

## Development Commands

### Building and Running

```bash
# Build the binary
make build

# Run with Docker (includes PostgreSQL + manifest chain)
make docker-up
make docker-down

# Run infrastructure only (PostgreSQL without indexer)
make docker-infra-up
make docker-infra-down

# Run full explorer stack
docker-compose -f docker-compose.explorer.yml up -d

# Extract data (example - connects to chain and indexes blocks)
./bin/yaci extract postgres localhost:9090 -p postgres://user:pass@localhost/db -s 1 -e 100

# Extract with live monitoring
./bin/yaci extract postgres localhost:9090 -p postgres://user:pass@localhost/db --live -t 5

# Reindex from block 1 (advanced)
./bin/yaci extract postgres localhost:9090 -p postgres://user:pass@localhost/db --reindex
```

### Block Explorer Development

```bash
cd explorer-next

# Install dependencies
npm install

# Run development server (default port 3000)
npm run dev

# Build for production
npm run build

# Run production server
npm start

# Type checking
npm run type-check

# Format code
npm run format
```

### Testing

```bash
# Run unit tests (short tests only, no Docker required)
make test

# Run end-to-end tests (requires Docker, starts full environment)
make test-e2e

# Generate coverage report (combines unit + e2e coverage)
make coverage
# Coverage output: coverage.html
```

### Code Quality

```bash
# Run linter (installs golangci-lint v1.61.0 if needed)
make lint

# Fix linting issues automatically
make lint-fix

# Format code with goimports (preserves local imports)
make format

# Security vulnerability check
make govulncheck
```

## Database Schema

PostgreSQL storage uses a two-tier approach:
- `*_raw` tables store complete JSON data
- `*_main` tables contain parsed, normalized data
- Database triggers handle automatic parsing on insert/update

Key tables:
- `api.blocks_raw`: Raw block data
- `api.transactions_raw/main`: Transaction data with parsed fields
- `api.messages_raw/main`: Decoded message data
- `api.events_raw/main`: Transaction events
- `api.normalized_events`: Standardized event attributes

## Configuration

Configuration sources (in priority order):
1. Command-line flags
2. Environment variables (prefixed with `YACI_`)
3. Config file (`config.yaml`, `config.json`, `config.toml`)

### Extract Command Flags

**Block Range:**
- `-s, --start`: Starting block height (default: resume from latest indexed block)
- `-e, --stop`: Stopping block height (default: extract to chain's latest block)
- `--reindex`: Reindex from earliest block or block 1 to latest (advanced operation)

**Operation Mode:**
- `--live`: Enable continuous monitoring (polls for new blocks)
- `-t, --block-time`: Block polling interval in live mode (default: 2s)

**Connection:**
- `-k, --insecure`: Skip TLS certificate verification (use for local/dev chains)
- `-m, --max-recv-msg-size`: Max gRPC message size in bytes (default: 4194304 / 4MB)
- `-r, --max-retries`: Max retries for gRPC operations (default: 3)

**Performance:**
- `-c, --max-concurrency`: Max concurrent block requests (default: 100)

**Observability:**
- `--enable-prometheus`: Enable Prometheus metrics server
- `--prometheus-addr`: Metrics server bind address (default: "0.0.0.0:2112")
- `-l, --logLevel`: Log level: debug|info|warn|error (default: info)

**PostgreSQL Subcommand:**
- `-p, --postgres-conn`: PostgreSQL connection string (required)
  - Format: `postgres://user:password@host:port/database?sslmode=disable`

## Testing Approach

- Unit tests use mocks for gRPC server and database connections
- E2E tests spin up a full environment with Docker Compose
- Test data includes manifest chain with various transaction types
- Coverage tracked via `go tool cover`

## Key Technical Details

### gRPC Client Architecture
- **Server Reflection**: Auto-discovers protobuf definitions via gRPC reflection (no `.proto` files needed)
- **Custom Resolver**: `internal/reflection/` contains custom protobuf resolver that decodes nested `Any` types
- **Connection Management**: Uses keepalive params (60s time, 30s timeout) with configurable max message size (default 4MB)
- **Initialization Flow**: Connect → Fetch descriptors → Build file descriptor set → Create resolver

### Data Extraction Pipeline
- **Concurrent Processing**: Configurable concurrency (`-c` flag, default 100 concurrent requests)
- **Retry Logic**: Automatic retries with configurable max attempts (`-r` flag, default 3)
- **Missing Block Detection**: Scans for gaps in indexed data before extraction (skipped with `--reindex`)
- **Live Monitoring**: Polls chain at intervals (`-t` flag) and processes new blocks as they arrive
- **Block Range Logic**:
  - If `--start` not set: resumes from latest indexed block + 1
  - If `--stop` not set: extracts up to chain's latest block
  - `--reindex` mode: starts from earliest indexed block or block 1

### Database Layer
- **Two-Tier Storage**: `*_raw` tables store complete JSON, `*_main` tables have parsed fields
- **Trigger-Based Parsing**: Database triggers automatically parse JSON on insert/update
- **Auto-Migrations**: Migrations run automatically on startup via `golang-migrate`
- **Transaction Safety**: All operations wrapped in transactions for atomicity

### Configuration System
- **Priority Order**: CLI flags > Environment variables (prefixed `YACI_`) > Config file
- **Viper Integration**: Uses spf13/viper for unified config management
- **Search Paths**: `./`, `$HOME/.yaci`, `/etc/yaci` for config files
- **Validation**: All config validated in `PreRunE` hooks before execution

## Important Code Patterns

### Error Handling
- Wrap errors with context using `fmt.Errorf("context: %w", err)` for error chain tracing
- Use `slog` for structured logging: `slog.Info/Debug/Warn/Error("message", "key", value)`
- Log level set via `--logLevel` flag, outputs JSON format

### Database Transactions
- Always use `tx.Exec(ctx, ...)` within transaction blocks
- `outputHandler.InsertBlock()` and similar methods handle their own transactions
- Rollback on error, commit on success pattern enforced

### gRPC Method Invocation
- Methods invoked via reflection: `gRPCClient.Resolver.InvokeRPC(methodName, request)`
- Requests/responses are protobuf messages decoded dynamically
- Full method names follow pattern: `package.service.Service.Method`
  - Example: `cosmos.tx.v1beta1.Service.GetBlockWithTxs`

### Concurrency Patterns
- Use `golang.org/x/sync/errgroup` for concurrent operations with error handling
- Worker pool pattern in extractors with semaphore via `sync.NewWeighted(maxConcurrency)`
- Context cancellation propagates through all goroutines

### Build Tags
- Build flag includes `-tags manifest` for chain-specific customization
- Version injected via ldflags: `-X github.com/manifest-network/yaci/cmd/yaci.Version=$(VERSION)`

## Common Development Tasks

### Adding New Metrics Collectors

1. Create collector in `internal/metrics/collectors/`
2. Implement `prometheus.Collector` interface (`Describe`, `Collect` methods)
3. Register in `internal/metrics/collectors/registry.go`
4. Metrics exposed on `/metrics` endpoint when `--enable-prometheus` enabled

### Modifying Database Schema

1. Create migration files in `internal/output/postgresql/migrations/`
2. Follow naming convention: `XXX_description.up.sql` and `XXX_description.down.sql`
3. Migrations run automatically on startup (ordered by XXX prefix)
4. Test migrations with `make docker-up` or `make test-e2e`
5. Use database triggers for automatic JSON parsing (see existing triggers as examples)

### Adding EVM Support for New Chain

1. Update `internal/evm/parser.go` for chain-specific parsing logic
2. Add processing logic in `internal/evm/processor.go`
3. Update `internal/extractor/evm_enhanced.go` for integration with extraction pipeline
4. Configure chain metadata in `explorer-next/src/config/chains.ts`
5. Test with chain that has EVM module and EVM transactions

### Debugging Extraction Issues

1. Set log level to debug: `./bin/yaci extract postgres <addr> -l debug`
2. Check gRPC connection: verify endpoint, TLS settings (`-k` for insecure)
3. Verify database connection string format
4. Check Prometheus metrics if enabled: `http://localhost:2112/metrics`
5. Inspect `*_raw` tables for raw JSON data before trigger parsing

## Project Structure

```
yaci/
├── main.go                 # Entry point
├── cmd/yaci/               # CLI command definitions
│   ├── root.go            # Root command & config loading
│   ├── extract.go         # Extract command setup
│   ├── postgres.go        # PostgreSQL subcommand
│   └── *_test.go          # E2E tests
├── internal/
│   ├── client/            # gRPC client management
│   │   └── client.go      # Connection, keepalive, initialization
│   ├── reflection/        # Protobuf reflection & dynamic resolution
│   │   ├── resolver.go    # Custom protobuf resolver
│   │   └── descriptor.go  # Descriptor fetching & building
│   ├── extractor/         # Data extraction pipeline
│   │   ├── extractor.go   # Main extraction orchestrator
│   │   ├── block.go       # Block parsing
│   │   ├── transaction.go # Transaction parsing
│   │   ├── live.go        # Live monitoring loop
│   │   └── evm_enhanced.go # EVM transaction extraction
│   ├── output/            # Output handler interface & implementations
│   │   └── postgresql/
│   │       ├── postgresql.go # PostgreSQL handler
│   │       └── migrations/   # SQL migrations (auto-run)
│   ├── metrics/           # Prometheus metrics
│   │   ├── server.go      # Metrics HTTP server
│   │   └── collectors/    # Custom collectors
│   ├── evm/               # EVM-specific processing
│   │   ├── parser.go      # EVM transaction parsing
│   │   └── processor.go   # Conversion to Blockscout format
│   ├── config/            # Configuration structs & validation
│   └── utils/             # Shared utilities
├── explorer-next/         # Modern block explorer (Next.js 14)
│   ├── src/
│   │   ├── app/           # Next.js App Router pages
│   │   ├── components/    # React components (Radix UI + Tailwind)
│   │   ├── lib/
│   │   │   ├── api/       # PostgREST API client
│   │   │   └── utils/     # Helper functions
│   │   ├── types/         # TypeScript type definitions
│   │   └── config/        # Chain configurations
│   └── public/            # Static assets
├── explorer/              # Legacy explorer (Lit-based, deprecated)
├── docker/
│   ├── infra/            # Infrastructure only (PostgreSQL)
│   └── yaci/             # Full stack (indexer + PostgreSQL + chain)
├── docker-compose.yml         # Basic demo setup
└── docker-compose.explorer.yml # Full explorer stack
```

### Key Files to Know

- **internal/extractor/extractor.go**: Main extraction logic, block range calculation, missing block detection
- **internal/client/client.go**: gRPC initialization, server reflection setup
- **internal/reflection/resolver.go**: Dynamic protobuf resolution for nested `Any` types
- **internal/output/postgresql/postgresql.go**: Database operations, transaction handling
- **cmd/yaci/postgres.go**: PostgreSQL command setup, Prometheus server startup
- **explorer-next/src/lib/api/client.ts**: PostgREST API client for explorer UI
- **Makefile**: All development commands and build configurations