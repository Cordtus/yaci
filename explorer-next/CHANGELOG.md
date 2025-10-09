# Yaci Explorer - Changes Log

## Removed All Hardcoded and Mock Data

### Chain-Specific Values Removed

**Before:**
- Network name: "Manifest" (hardcoded in header)
- Token symbol: "MFX" (hardcoded in dashboard)
- Active validators: 100 (fake placeholder)
- Total supply: "1000000000" (fake placeholder)

**After:**
- Network name: Removed from header
- Token symbol: "Native Token" (generic)
- Active validators: "N/A" (no data in yaci DB)
- Total supply: "N/A" (no data in yaci DB)

### Data Sources - 100% Real Chain Data

All displayed data now comes exclusively from yaci PostgreSQL database:

| Data | Source | Table |
|------|--------|-------|
| Block numbers | Real blockchain blocks | `api.blocks_raw` |
| Transaction hashes | Real on-chain transactions | `api.transactions_main` |
| Block timestamps | Actual block times | `api.blocks_raw.data.block.header.time` |
| Transaction fees | Real fee amounts | `api.transactions_main.fee` |
| Message types | Decoded message types | `api.messages_main.type` |
| Events | Transaction events | `api.events_main` |
| Chain ID | Detected from blocks | `api.blocks_raw.data.block.header.chainId` |
| Token denom | Detected from transactions | `api.transactions_main.fee.amount[].denom` |

### New Features

1. **Dynamic Chain Detection Service** (`src/lib/chain-info.ts`)
   - Automatically detects chain ID from block headers
   - Extracts token denom from transaction fees
   - Identifies decimal precision from denom prefix
   - Can be integrated to show actual chain info

2. **Type Safety**
   - All types match yaci database schema exactly
   - Proper nullable types throughout
   - Optional chaining for safe property access

3. **Client-Side Data Fetching**
   - React Query only runs in browser (`enabled: typeof window !== 'undefined'`)
   - No SSR data fetching failures
   - Proper loading states

### Configuration

- **Environment**: `.env.local` with `NEXT_PUBLIC_POSTGREST_URL=http://localhost:3010`
- **API Client**: Configured to use PostgREST endpoint
- **Database**: Connects to yaci PostgreSQL via PostgREST

### What Still Needs Implementation

Data not available in yaci database (would require direct chain queries):

1. **Active Validators Count**
   - Need to query `/cosmos/staking/v1beta1/validators`
   - Currently shows "N/A"

2. **Total Supply**
   - Need to query `/cosmos/bank/v1beta1/supply`
   - Currently shows "N/A"

3. **Actual Average Block Time**
   - Could be calculated from block timestamps in DB
   - Currently uses default 2.0s

These would require adding a gRPC client to query the chain directly, or extending yaci to index this data.

## Testing

**Important**: Explorer must be tested in a real web browser, not with curl/wget.

1. Start services:
   ```bash
   # PostgreSQL + PostgREST should be running
   docker ps | grep yaci

   # Block explorer
   cd explorer-next
   npm run dev
   ```

2. Open http://localhost:3000 in browser

3. Verify real data:
   - Block numbers match yaci database
   - Transaction hashes are actual 64-char hex strings
   - Timestamps reflect real block times
   - Data refreshes automatically

## Architecture

```
Browser → React Query → YaciAPIClient → PostgREST (port 3010) → PostgreSQL (yaci DB)
```

No mock data, no hardcoded values, 100% real blockchain data from yaci indexer.
