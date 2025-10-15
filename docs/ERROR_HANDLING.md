# Transaction Error Handling

## Overview

Yaci implements graceful degradation when fetching transaction details from the blockchain. If a transaction cannot be fetched (due to size limits, network issues, or chain-specific problems), yaci will store error metadata instead of failing the entire block processing.

## Error Scenarios

### Common Causes of Transaction Fetch Failures

1. **Message Size Limits**: Transaction exceeds gRPC max message size (default: 4MB)
2. **Network Timeouts**: Chain fails to respond within timeout period
3. **Chain-Specific Issues**: Some chains may have non-standard transaction formats
4. **Missing Transaction**: Transaction hash exists in block but query by hash fails

### Example: Mantrachain Large Transactions

Mantrachain has been observed to produce very large transactions that exceed default gRPC message size limits. These transactions are handled gracefully:

```bash
# Mantrachain block 9357143 contains a transaction that exceeds size limits
grpcurl -plaintext -d '{"height":"9357143"}' \
    mantra-grpc.polkachu.com:25190 \
    cosmos.base.tendermint.v1beta1.Service/GetBlockByHeight
```

## Behavior

### Transaction Extraction (internal/extractor/transaction.go:51-67)

When a transaction fetch fails:

1. **Error is logged** with structured logging:
   ```
   WARN Failed to fetch transaction details, storing with error metadata hash=<hash> error=<error>
   ```

2. **Error metadata is stored** as valid JSON in `transactions_raw.data`:
   ```json
   {
     "error": "failed to fetch transaction details",
     "hash": "<transaction_hash>",
     "reason": "<error_message>"
   }
   ```

3. **Block processing continues** - other transactions are unaffected

### Database Handling (migration 010_handle_tx_errors.up.sql)

The database trigger `update_transaction_main()` detects error metadata records by checking for missing `tx` and `txResponse` fields:

1. **Error transactions populate `transactions_main` with minimal data**:
   - `id`: Transaction hash
   - `error`: Error reason from metadata
   - `height`: 0 (unknown)
   - `timestamp`: Current time (fallback)
   - `fee`, `memo`, `proposal_ids`: NULL

2. **No messages are extracted** - error transactions have no messages

3. **Queries still work** - error transactions appear in the database with clear error indication

## Querying Error Transactions

### Find all error transactions

```sql
SELECT id, error, timestamp
FROM api.transactions_main
WHERE height = 0 AND error LIKE '%fetch%';
```

### Check raw error metadata

```sql
SELECT id, data->>'reason' as reason
FROM api.transactions_raw
WHERE data ? 'error';
```

### Count failed vs successful transactions

```sql
SELECT
  COUNT(*) FILTER (WHERE height > 0) as successful,
  COUNT(*) FILTER (WHERE height = 0) as failed
FROM api.transactions_main;
```

## Configuration

### Increase gRPC Message Size Limit

If transactions are failing due to size limits, increase the max message size:

```bash
# Default is 4MB (4194304 bytes)
./bin/yaci extract postgres localhost:9090 \
  -m 10485760 \
  -p postgres://user:pass@localhost/db
```

### Increase Retry Attempts

For transient network issues:

```bash
# Default is 3 retries
./bin/yaci extract postgres localhost:9090 \
  -r 5 \
  -p postgres://user:pass@localhost/db
```

## Monitoring

### Prometheus Metrics

When `--enable-prometheus` is enabled, failed transaction fetches are logged and can be monitored via structured logs. Consider adding custom metrics for tracking:

- Total transactions processed
- Failed transaction fetch count
- Error rate by error type

### Log Monitoring

Search logs for transaction fetch failures:

```bash
# JSON log format
grep 'Failed to fetch transaction' yaci.log | jq -r '.hash'

# Count failures
grep 'Failed to fetch transaction' yaci.log | wc -l
```

## Retry and Recovery

### Manual Retry of Failed Transactions

Failed transactions can be reprocessed by:

1. Identifying failed transaction hashes
2. Manually querying the chain with increased message size limits
3. Updating the database with correct data

Example script:

```bash
#!/bin/bash
# Get failed transaction hashes
psql -d yaci -t -c "SELECT id FROM api.transactions_raw WHERE data ? 'error'" | \
while read hash; do
  # Query chain directly with larger message size
  grpcurl -max-msg-sz 10485760 -plaintext \
    -d "{\"hash\": \"$hash\"}" \
    chain-grpc:9090 \
    cosmos.tx.v1beta1.Service.GetTx
done
```

### Reindex Specific Blocks

To reprocess blocks that had failed transactions:

```bash
# Reindex a specific block range
./bin/yaci extract postgres localhost:9090 \
  -s 9357143 -e 9357143 \
  -m 10485760 \
  -p postgres://user:pass@localhost/db
```

## Upstream Improvements

This error handling approach is designed to be upstreamed to the main yaci repository:

- **Non-breaking**: Existing functionality is preserved
- **Observable**: Clear logging and error tracking
- **Configurable**: Size limits can be adjusted per chain
- **Recoverable**: Failed transactions can be retried

Consider submitting a PR with:
1. Code changes in `internal/extractor/transaction.go`
2. Database migration `010_handle_tx_errors.up.sql`
3. This documentation
4. Additional test cases for error scenarios

## Testing

### Unit Tests

Add tests for transaction fetch failure scenarios:

```go
// Test transaction fetch failure
func TestExtractTransactions_FetchFailure(t *testing.T) {
    // Mock gRPC client that returns error
    // Verify error metadata is stored
    // Verify block processing continues
}
```

### Integration Tests

Test with chains known to have large transactions:

```bash
# Test with Mantrachain
./bin/yaci extract postgres mantra-grpc.polkachu.com:25190 \
  -s 9357143 -e 9357143 \
  --insecure \
  -p postgres://user:pass@localhost/db
```

## Best Practices

1. **Monitor error rates**: High error rates may indicate configuration issues
2. **Adjust message size limits per chain**: Different chains have different transaction sizes
3. **Review failed transactions periodically**: Ensure they're expected failures
4. **Set up alerts**: Alert on sustained high error rates
5. **Document chain-specific issues**: Track which chains need special configuration
