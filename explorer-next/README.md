# Yaci Block Explorer

A modern, performant block explorer for Cosmos SDK chains with native EVM support, deeply integrated with the yaci indexer.

## Features

-  **High Performance**: Direct PostgreSQL integration for optimal query performance
-  **Real-time Updates**: Live blockchain data synchronization
-  **Dual Chain Support**: Native support for both Cosmos and EVM transactions
-  **Modern UI**: Clean, responsive design with dark mode support
-  **Smart Search**: Unified search for blocks, transactions, and addresses
-  **Rich Analytics**: Chain statistics, transaction history, and performance metrics
-  **Developer Friendly**: TypeScript, modern tooling, and comprehensive documentation

## Tech Stack

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **State Management**: Zustand, TanStack Query
- **Database**: PostgreSQL with PostgREST API
- **Indexer**: Yaci (Go-based blockchain indexer)

## Quick Start

### Prerequisites

- Node.js 20+
- Docker and Docker Compose
- PostgreSQL 15+ (or use Docker)
- Running yaci indexer with PostgreSQL output

### Development

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

3. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3001](http://localhost:3001) to view the explorer.

### Production Deployment

#### Using Docker Compose (Recommended)

1. Start all services:
```bash
docker-compose -f docker-compose.explorer.yml up -d
```

This will start:
- PostgreSQL database
- PostgREST API server
- Yaci indexer
- Block explorer UI
- PgAdmin (optional, use `--profile tools`)

2. Access the services:
- Explorer UI: http://localhost:3001
- PostgREST API: http://localhost:3000
- Prometheus metrics: http://localhost:2112
- PgAdmin: http://localhost:8080 (if enabled)

#### Manual Deployment

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:foobar@localhost:5432/yaci` |
| `POSTGREST_URL` | PostgREST API URL | `http://localhost:3000` |
| `NEXT_PUBLIC_POSTGREST_URL` | Public PostgREST URL | `http://localhost:3000` |
| `CHAIN_ID` | Chain identifier | `manifest-1` |
| `CHAIN_RPC_URL` | Chain RPC endpoint | `http://localhost:9090` |

### Chain Configuration

Edit `src/config/chains.ts` to configure different chains:

```typescript
export const chains = {
  'manifest-1': {
    name: 'Manifest Network',
    features: {
      evm: true,
      ibc: true,
      wasm: true,
    },
    // ... other configuration
  }
}
```

## Architecture

```
┌─────────────────────────────┐
│     Next.js Frontend        │
│   (React + TypeScript)      │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│      PostgREST API          │
│   (Auto-generated REST)     │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│       PostgreSQL            │
│   (Indexed Blockchain Data) │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│      Yaci Indexer           │
│   (Continuous Extraction)   │
└─────────────────────────────┘
```

## API Endpoints

The explorer uses PostgREST to provide a RESTful API:

- `GET /blocks_raw` - Get raw block data
- `GET /transactions_main` - Get parsed transactions
- `GET /messages_main` - Get transaction messages
- `GET /events_main` - Get transaction events

All endpoints support:
- Filtering: `?field=eq.value`
- Sorting: `?order=field.desc`
- Pagination: `?limit=20&offset=0`

## Development

### Project Structure

```
src/
├── app/              # Next.js app router pages
├── components/       # React components
│   ├── ui/          # Base UI components
│   ├── common/      # Shared components
│   └── layout/      # Layout components
├── lib/             # Utilities and libraries
│   ├── api/         # API client
│   └── utils.ts     # Helper functions
├── types/           # TypeScript types
└── config/          # Configuration files
```

### Key Components

- **Dashboard**: Overview of chain statistics and recent activity
- **Blocks**: Browse and search blocks
- **Transactions**: View all transactions with filtering
- **Search**: Unified search across all data types
- **Transaction Details**: Deep dive into transaction data including EVM details

### Adding New Features

1. **New Page**: Create in `src/app/[page]/page.tsx`
2. **New Component**: Add to `src/components/`
3. **API Integration**: Extend `src/lib/api/client.ts`
4. **Database Schema**: Add migrations to yaci indexer

## Performance Optimization

- Server-side rendering for initial page loads
- Client-side caching with TanStack Query
- Virtual scrolling for large lists
- Database query optimization with proper indexes
- Image and code splitting optimization

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: [github.com/manifest-network/yaci](https://github.com/manifest-network/yaci)
- Documentation: See `/docs` folder

## Acknowledgments

- Yaci indexer by Manifest Network
- UI components from shadcn/ui
- Icons from Lucide React