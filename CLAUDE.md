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

# Run full explorer stack
docker-compose -f docker-compose.explorer.yml up -d

# Extract data (example)
./bin/yaci extract postgres localhost:9090 -p postgres://user:pass@localhost/db -s 1 -e 100
```

### Block Explorer Development

```bash
cd explorer-next

# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Run production server
npm start
```

### Testing

```bash
# Run unit tests
make test

# Run end-to-end tests (requires Docker)
make test-e2e

# Generate coverage report
make coverage
```

### Code Quality

```bash
# Run linter
make lint

# Fix linting issues
make lint-fix

# Format code
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

Common flags:
- `-s, --start`: Starting block height
- `-e, --stop`: Stopping block height
- `--live`: Enable live monitoring
- `-t, --block-time`: Block polling interval
- `-k, --insecure`: Skip TLS verification
- `--enable-prometheus`: Enable metrics server

## Testing Approach

- Unit tests use mocks for gRPC server and database connections
- E2E tests spin up a full environment with Docker Compose
- Test data includes manifest chain with various transaction types
- Coverage tracked via `go tool cover`

## Key Technical Details

- Uses gRPC server reflection - no proto files needed
- Properly decodes nested `Any` types in Cosmos messages
- Supports concurrent block extraction with configurable concurrency
- Handles chain reorganizations and missing blocks
- Database migrations run automatically on startup
- Prometheus metrics provide real-time chain insights

## Common Development Tasks

### Adding New Metrics Collectors

1. Create collector in `internal/metrics/collectors/`
2. Implement `prometheus.Collector` interface
3. Register in `internal/metrics/collectors/registry.go`

### Modifying Database Schema

1. Create migration files in `internal/output/postgresql/migrations/`
2. Follow naming convention: `XXX_description.up.sql` and `.down.sql`
3. Test migrations with `make docker-up`

### Adding EVM Support for New Chain

1. Update `internal/evm/parser.go` for chain-specific parsing
2. Add processing logic in `internal/evm/processor.go`
3. Update `internal/extractor/evm_enhanced.go` for integration
4. Configure chain in `explorer-next/src/config/chains.ts`

## Project Structure

```
yaci/
├── cmd/yaci/           # CLI commands
├── internal/           # Core indexer logic
│   ├── extractor/      # Blockchain data extraction
│   ├── output/         # Output handlers (PostgreSQL)
│   ├── client/         # gRPC client
│   ├── metrics/        # Prometheus collectors
│   └── evm/            # EVM transaction processing
├── explorer-next/      # Modern block explorer UI
│   ├── src/
│   │   ├── app/        # Next.js pages
│   │   ├── components/ # React components
│   │   ├── lib/        # Utilities and API client
│   │   └── types/      # TypeScript types
│   └── public/         # Static assets
├── explorer/           # Legacy explorer (Lit-based)
└── docker/             # Docker configurations
```