# Yaci Block Explorer Architecture

## Overview
A modern, performant block explorer for Cosmos SDK chains with native EVM support, deeply integrated with the yaci indexer for maximum control and efficiency.

## Core Design Principles

### 1. Deep Integration with Yaci Indexer
- Direct PostgreSQL access for optimal performance
- Real-time data synchronization via database triggers
- Leverage existing schema and indexing patterns
- No intermediary API layer when unnecessary

### 2. Chain-Agnostic Architecture
- Configurable per-chain settings
- Pluggable modules for chain-specific features
- Unified data models with extensible metadata
- Dynamic UI components based on chain capabilities

### 3. Performance & Scalability
- Server-side data processing in PostgreSQL
- Efficient query patterns with proper indexes
- Pagination and virtual scrolling for large datasets
- Caching strategy for frequently accessed data

### 4. Developer Experience
- TypeScript throughout for type safety
- Modern tooling (Vite, Tailwind, React/Next.js)
- Component-driven development
- Comprehensive error handling and logging

## System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Block Explorer UI                     │
│  (React/Next.js + TypeScript + Tailwind + shadcn/ui)   │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                      API Layer                           │
│          (Next.js API Routes / tRPC / GraphQL)          │
│                                                          │
│  • REST endpoints for basic queries                     │
│  • GraphQL for complex data fetching                    │
│  • WebSocket for real-time updates                      │
│  • Optional eth_* JSON-RPC proxy                        │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                   Data Access Layer                      │
│              (Drizzle ORM / Kysely / Raw SQL)           │
│                                                          │
│  • Type-safe database queries                           │
│  • Connection pooling                                   │
│  • Query optimization                                   │
│  • Caching layer (Redis optional)                       │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                     PostgreSQL                           │
│                  (Yaci Indexed Data)                     │
│                                                          │
│  Tables:                                                 │
│  • blocks_raw / blocks_main                             │
│  • transactions_raw / transactions_main                 │
│  • messages_raw / messages_main                         │
│  • events_raw / events_main                             │
│  • normalized_events                                    │
│                                                          │
│  Enhanced Tables (to be added):                         │
│  • evm_transactions                                     │
│  • evm_logs                                            │
│  • evm_contracts                                       │
│  • evm_token_transfers                                  │
│  • contract_verification                                │
│  • address_balances                                     │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│                    Yaci Indexer                          │
│            (Go - Continuous Data Extraction)             │
└─────────────────────────────────────────────────────────┘
```

## Database Schema Extensions

### EVM-Specific Tables

```sql
-- EVM transaction details
CREATE TABLE api.evm_transactions (
  hash VARCHAR(66) PRIMARY KEY,
  tx_hash VARCHAR(64) REFERENCES api.transactions_main(id),
  from_address VARCHAR(42) NOT NULL,
  to_address VARCHAR(42),
  value NUMERIC(78,0),
  gas_limit BIGINT,
  gas_price NUMERIC(78,0),
  gas_used BIGINT,
  nonce BIGINT,
  input_data TEXT,
  contract_address VARCHAR(42),
  status INTEGER,
  type INTEGER,
  max_fee_per_gas NUMERIC(78,0),
  max_priority_fee_per_gas NUMERIC(78,0),
  access_list JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- EVM event logs
CREATE TABLE api.evm_logs (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66) REFERENCES api.evm_transactions(hash),
  log_index INTEGER,
  address VARCHAR(42),
  topics TEXT[],
  data TEXT,
  removed BOOLEAN DEFAULT FALSE
);

-- Contract metadata
CREATE TABLE api.evm_contracts (
  address VARCHAR(42) PRIMARY KEY,
  creator_address VARCHAR(42),
  creation_tx_hash VARCHAR(66),
  bytecode TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  contract_name VARCHAR(255),
  compiler_version VARCHAR(50),
  optimization_enabled BOOLEAN,
  runs INTEGER,
  source_code TEXT,
  abi JSONB,
  constructor_args TEXT,
  verified_at TIMESTAMP
);

-- Token transfers (ERC20/721/1155)
CREATE TABLE api.evm_token_transfers (
  id SERIAL PRIMARY KEY,
  tx_hash VARCHAR(66),
  log_index INTEGER,
  token_address VARCHAR(42),
  from_address VARCHAR(42),
  to_address VARCHAR(42),
  value NUMERIC(78,0),
  token_id NUMERIC(78,0),
  token_type VARCHAR(10), -- ERC20, ERC721, ERC1155
  block_number BIGINT,
  timestamp TIMESTAMP
);

-- Address token balances (materialized view or table)
CREATE TABLE api.address_balances (
  address VARCHAR(42),
  token_address VARCHAR(42),
  balance NUMERIC(78,0),
  block_number BIGINT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (address, token_address)
);
```

## API Design

### REST Endpoints

```typescript
// Block endpoints
GET /api/blocks
GET /api/blocks/:height
GET /api/blocks/latest

// Transaction endpoints
GET /api/transactions
GET /api/transactions/:hash
GET /api/transactions/pending

// Address endpoints
GET /api/addresses/:address
GET /api/addresses/:address/transactions
GET /api/addresses/:address/tokens
GET /api/addresses/:address/balance

// Contract endpoints
GET /api/contracts/:address
POST /api/contracts/:address/verify
GET /api/contracts/:address/abi
POST /api/contracts/:address/read
POST /api/contracts/:address/write

// Search
GET /api/search?q=:query

// Stats
GET /api/stats
GET /api/stats/gas-price
GET /api/stats/tps
```

### GraphQL Schema

```graphql
type Query {
  block(height: Int!): Block
  blocks(limit: Int, offset: Int): [Block!]!

  transaction(hash: String!): Transaction
  transactions(
    limit: Int
    offset: Int
    filter: TransactionFilter
  ): [Transaction!]!

  address(address: String!): Address

  contract(address: String!): Contract

  search(query: String!): SearchResult!

  stats: ChainStats!
}

type Subscription {
  newBlock: Block!
  newTransaction: Transaction!
  addressActivity(address: String!): AddressEvent!
}

type Transaction {
  hash: String!
  block: Block!
  from: String
  to: String
  value: String
  gas: Int
  gasUsed: Int
  status: TransactionStatus!

  # Cosmos fields
  messages: [Message!]!
  events: [Event!]!

  # EVM fields
  evmData: EVMTransaction
  logs: [EVMLog!]
  tokenTransfers: [TokenTransfer!]
}
```

## Frontend Architecture

### Component Structure

```
src/
├── components/
│   ├── common/           # Shared UI components
│   │   ├── Layout.tsx
│   │   ├── SearchBar.tsx
│   │   ├── Pagination.tsx
│   │   └── DataTable.tsx
│   ├── blockchain/       # Blockchain-specific components
│   │   ├── BlockCard.tsx
│   │   ├── TransactionRow.tsx
│   │   ├── AddressOverview.tsx
│   │   └── ContractInterface.tsx
│   └── evm/             # EVM-specific components
│       ├── EVMTransactionDetails.tsx
│       ├── ContractVerification.tsx
│       ├── TokenTransfers.tsx
│       └── EventLogs.tsx
├── pages/               # Next.js pages
│   ├── index.tsx        # Dashboard
│   ├── blocks/
│   ├── transactions/
│   ├── address/[address].tsx
│   └── contract/[address].tsx
├── hooks/               # Custom React hooks
│   ├── useChainData.ts
│   ├── useWebSocket.ts
│   └── useContractABI.ts
├── lib/                 # Utilities and helpers
│   ├── api/            # API clients
│   ├── chain/          # Chain-specific logic
│   ├── formatting/     # Data formatters
│   └── validation/     # Input validators
└── config/             # Configuration
    ├── chains.ts       # Chain configurations
    ├── features.ts     # Feature flags
    └── theme.ts        # UI theme
```

### State Management

```typescript
// Using Zustand for global state
interface ExplorerState {
  // Chain configuration
  currentChain: ChainConfig
  setCurrentChain: (chain: ChainConfig) => void

  // User preferences
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void

  // Real-time data
  latestBlock: Block | null
  recentTransactions: Transaction[]

  // WebSocket connection
  wsConnected: boolean
  reconnect: () => void
}

// Using TanStack Query for server state
const useBlocks = (limit: number, offset: number) => {
  return useQuery({
    queryKey: ['blocks', limit, offset],
    queryFn: () => api.getBlocks(limit, offset),
    staleTime: 10_000,
  })
}
```

## Configuration System

### Chain Configuration

```typescript
interface ChainConfig {
  id: string
  name: string
  rpcUrl: string
  indexerUrl: string

  features: {
    evm: boolean
    ibc: boolean
    wasm: boolean
    staking: boolean
    governance: boolean
  }

  display: {
    logo: string
    primaryColor: string
    decimals: number
    symbol: string
  }

  contracts?: {
    multicall?: string
    ens?: string
  }

  explorers?: {
    mintscan?: string
    etherscan?: string
  }
}

// Example configuration
const manifestConfig: ChainConfig = {
  id: 'manifest-1',
  name: 'Manifest Network',
  rpcUrl: 'https://rpc.manifest.network',
  indexerUrl: 'http://localhost:5432',

  features: {
    evm: true,
    ibc: true,
    wasm: true,
    staking: true,
    governance: true,
  },

  display: {
    logo: '/logos/manifest.png',
    primaryColor: '#6B46C1',
    decimals: 6,
    symbol: 'MFX',
  },
}
```

## Performance Optimizations

### Database Optimizations

```sql
-- Indexes for common queries
CREATE INDEX idx_evm_tx_from ON api.evm_transactions(from_address);
CREATE INDEX idx_evm_tx_to ON api.evm_transactions(to_address);
CREATE INDEX idx_evm_tx_contract ON api.evm_transactions(contract_address);
CREATE INDEX idx_token_transfers_token ON api.evm_token_transfers(token_address);
CREATE INDEX idx_token_transfers_from ON api.evm_token_transfers(from_address);
CREATE INDEX idx_token_transfers_to ON api.evm_token_transfers(to_address);

-- Materialized views for expensive queries
CREATE MATERIALIZED VIEW api.address_stats AS
SELECT
  address,
  COUNT(DISTINCT tx_hash) as tx_count,
  SUM(CASE WHEN from_address = address THEN 1 ELSE 0 END) as sent_count,
  SUM(CASE WHEN to_address = address THEN 1 ELSE 0 END) as received_count,
  MIN(created_at) as first_seen,
  MAX(created_at) as last_seen
FROM api.evm_transactions
GROUP BY address;

CREATE INDEX idx_address_stats ON api.address_stats(address);
```

### Frontend Optimizations

- Virtual scrolling for large lists
- Lazy loading of transaction details
- Prefetching next page of results
- Service Worker for offline support
- Image optimization and lazy loading
- Code splitting per route

## Monitoring & Observability

### Metrics to Track

- API response times
- Database query performance
- WebSocket connection stability
- Cache hit rates
- User interaction patterns
- Error rates by endpoint

### Health Checks

```typescript
// Health check endpoint
GET /api/health

Response:
{
  "status": "healthy",
  "database": "connected",
  "indexer": {
    "latestBlock": 1234567,
    "syncStatus": "synced",
    "lag": 0
  },
  "cache": "connected",
  "uptime": 3600
}
```

## Security Considerations

- Input validation and sanitization
- Rate limiting per IP/endpoint
- CORS configuration
- SQL injection prevention via parameterized queries
- XSS protection via Content Security Policy
- Authentication for write operations (contract verification)
- API key management for premium features

## Deployment Strategy

### Docker Compose Setup

```yaml
version: '3.8'

services:
  explorer:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=postgresql://user:pass@postgres:5432/yaci
      - REDIS_URL=redis://redis:6379
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15
    volumes:
      - postgres_data:/var/lib/postgresql/data
    environment:
      - POSTGRES_DB=yaci
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

## Future Enhancements

1. **Advanced Features**
   - Multi-chain dashboard
   - Cross-chain transaction tracking
   - DeFi protocol integration
   - NFT gallery and metadata

2. **Developer Tools**
   - Contract debugging interface
   - Transaction simulator
   - Gas estimator
   - ABI encoder/decoder

3. **Analytics**
   - Historical charts
   - Network statistics
   - Token analytics
   - Whale tracking

4. **Mobile Support**
   - Responsive design optimization
   - Native mobile app
   - Push notifications