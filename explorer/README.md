# Yaci Explorer

A comprehensive blockchain explorer for Cosmos SDK and EVM-compatible chains, built to work seamlessly with the [Yaci indexer](../README.md).

## Features

###  Core Blockchain Explorer
- **Block Browser**: View detailed block information, navigation, and transaction listings
- **Transaction Details**: Complete transaction analysis with message parsing and address extraction
- **Address Pages**: Comprehensive address activity tracking with transaction history
- **Real-time Updates**: Live block and transaction monitoring via Server-Sent Events

###  Advanced Search & Discovery
- **Universal Search**: Find blocks, transactions, addresses, and contracts by various identifiers
- **Smart Search**: Auto-detects search type (block height, tx hash, address) and routes accordingly
- **Search Suggestions**: Real-time autocomplete for improved UX

###  EVM Integration
- **Contract Verification**: Submit and verify smart contract source code and ABIs
- **Hex Data Decoding**: Automatically decode transaction input data and event logs
- **ABI Integration**: Support for ERC20, ERC721, ERC1155, and custom contract types
- **Contract Interaction**: View decoded function calls and event emissions

###  Analytics & Insights
- **Network Statistics**: Real-time chain metrics and performance indicators
- **Transaction Analytics**: Success rates, message type distribution, and trends
- **Address Analytics**: Transaction patterns and activity summaries

## Technology Stack

- **Frontend**: Next.js 14 with TypeScript and ESM
- **Styling**: Tailwind CSS with Shadcn/UI components
- **API**: tRPC for end-to-end type safety
- **Database**: PostgreSQL (leverages Yaci's existing schema)
- **Real-time**: Server-Sent Events for live updates
- **EVM Support**: ethers.js for contract interaction and decoding

## Getting Started

### Prerequisites

1. **Yaci Indexer Running**: The explorer requires yaci to be actively indexing blockchain data
2. **PostgreSQL Database**: Must contain yaci's indexed blockchain data
3. **Node.js**: Version 18+ with ES modules support

### Installation

```bash
cd explorer
npm install
```

### Configuration

Copy the example environment file and update as needed:

```bash
cp .env.example .env.local
```

Key configuration:
- `DATABASE_URL`: PostgreSQL connection string (same as yaci's)
- `NEXT_PUBLIC_CHAIN_NAME`: Display name for your blockchain
- `NEXT_PUBLIC_CHAIN_ID`: Chain identifier

### Development

```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Run production server
npm start
```

## Architecture

### Database Integration
The explorer extends Yaci's existing PostgreSQL schema with additional tables for:
- Contract verification and ABI storage
- Address labels and metadata
- Network statistics caching
- Search indexing

### API Layer
- **tRPC Routers**: Type-safe API endpoints for blocks, transactions, addresses, EVM, and search
- **Real-time Endpoints**: Server-Sent Events for live blockchain data
- **Database Queries**: Optimized PostgreSQL queries leveraging Yaci's indexes

### Frontend Structure
```
src/
├── components/        # Reusable UI components
├── lib/
│   ├── api/          # tRPC routers and API logic  
│   ├── db/           # Database schema and connection
│   ├── evm/          # EVM-specific utilities
│   ├── hooks/        # Custom React hooks
│   └── utils/        # Utility functions
└── pages/            # Next.js pages and API routes
```

## Integration with Yaci

The explorer is designed to work directly with Yaci's PostgreSQL schema:

- **Blocks**: Reads from `api.blocks_raw`
- **Transactions**: Uses `api.transactions_main` and `api.transactions_raw`  
- **Messages**: Leverages `api.messages_main` and `api.messages_raw`
- **Address Search**: Utilizes `api.get_messages_for_address()` function

## EVM Features

### Contract Verification
Submit source code and ABI for smart contracts to enable:
- Decoded transaction input data
- Human-readable event logs
- Function call analysis

### Supported Standards
- **ERC20**: Token transfers and approvals
- **ERC721**: NFT minting and transfers
- **ERC1155**: Multi-token standard
- **Custom Contracts**: Any verified contract with ABI

## Real-time Updates

The explorer provides live updates for:
- New blocks as they're produced
- Transaction confirmations
- Network statistics
- Search results

Updates are delivered via Server-Sent Events for efficient real-time data streaming.

## Contributing

This explorer is designed to complement the Yaci indexer. When adding new features:

1. **Database Changes**: Add new tables to extend (don't modify) Yaci's schema
2. **API Updates**: Create new tRPC routers for additional functionality
3. **UI Components**: Follow the established design patterns and TypeScript conventions

## License

Same as Yaci indexer - MIT License