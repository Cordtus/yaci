# Explorer Testing Guide

## Current Status

The Yaci Block Explorer has been fully configured to use **ONLY real data** from the blockchain indexer. All mock data has been removed.

## What Was Fixed

### 1. Data Source Configuration
- Created `.env.local` with correct PostgREST API URL
- All queries now fetch from `http://localhost:3010` (PostgREST API)
- No hardcoded or mock data remains

### 2. Type Safety
- Updated all TypeScript types to match yaci indexer schema exactly
- Fixed field names (`gasLimit` not `gas_limit`, `proposal_ids` not `proposal_id`)
- Added proper null safety with optional chaining throughout

### 3. Client-Side Data Fetching
- Added `enabled: typeof window !== 'undefined'` to all React Query hooks
- This ensures queries only run in the browser, not during server-side rendering
- Prevents SSR from trying to fetch from localhost APIs

### 4. Error Handling
- Added comprehensive error display on pages
- Console logging for debugging data fetch issues
- Proper loading states with skeletons

## How to Test Properly

###  IMPORTANT: Testing Requires a Real Browser

The explorer is a **client-side application** that fetches data via JavaScript. Testing with `curl` or server-side tools will ONLY show loading skeletons because:

1. Server renders the initial HTML with loading states
2. Browser downloads and executes JavaScript
3. React Query fetches real data from API
4. UI updates with actual blockchain data

### Correct Testing Method

1. **Start all services:**
   ```bash
   # PostgreSQL + PostgREST (should already be running)
   docker ps | grep yaci

   # Block explorer
   cd explorer-next
   npm run dev
   ```

2. **Open in a real browser:**
   ```
   http://localhost:3000
   ```

3. **What you should see:**
   - Brief loading skeletons (< 1 second)
   - Real block data appears (Block #24670, etc.)
   - Transaction list with actual tx hashes
   - Chain stats (latest block, tx count, etc.)
   - Auto-refreshing every 2-5 seconds

4. **Open browser console** (F12) to see:
   ```
   [Dashboard] Fetching chain stats...
   [Dashboard] Chain stats: {latest_block: 24670, ...}
   [Dashboard] Fetching blocks...
   [Dashboard] Blocks loaded: 5
   [Dashboard] Fetching transactions...
   [Dashboard] Transactions loaded: 5
   ```

## Data Sources

All data comes from yaci indexer PostgreSQL database:

| UI Element | API Endpoint | Database Table |
|------------|--------------|----------------|
| Latest Blocks | `/blocks_raw?order=id.desc&limit=5` | `api.blocks_raw` |
| Transactions | `/transactions_main?order=height.desc&limit=5` | `api.transactions_main` |
| Chain Stats | Multiple queries combined | Multiple tables |
| Block Details | `/blocks_raw?id=eq.{height}` | `api.blocks_raw` |
| Transaction Details | `/transactions_main?id=eq.{hash}` | `api.transactions_main` + messages + events |

## Verification Checklist

- [ ] PostgreSQL container running and healthy
- [ ] PostgREST API responding on port 3010
- [ ] Block explorer dev server running on port 3000
- [ ] Browser shows real block numbers (not placeholders)
- [ ] Transaction hashes are actual 64-char hex strings
- [ ] Data refreshes automatically
- [ ] No "Error Loading Data" messages
- [ ] Browser console shows successful fetch logs

## Common Issues

### Issue: Still seeing loading skeletons
**Cause:** Client-side JavaScript not executing
**Fix:** Must use a real browser, not curl/wget

### Issue: API URL errors in console
**Cause:** `.env.local` not loaded or wrong port
**Fix:** Restart dev server, check `.env.local` exists

### Issue: CORS errors
**Cause:** PostgREST not configured for CORS
**Fix:** Check docker-compose has `PGRST_SERVER_CORS_ALLOWED_ORIGINS: "*"`

### Issue: No data in database
**Cause:** Yaci indexer not running
**Fix:** Start indexer with `yaci extract postgres ...`
