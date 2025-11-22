#!/bin/sh
set -e

if [ -z "$YACI_GRPC_ENDPOINT" ] || [ -z "$YACI_POSTGRES_DSN" ]; then
  echo "YACI_GRPC_ENDPOINT and YACI_POSTGRES_DSN must be set" >&2
  exit 1
fi

# Query database for last indexed block to resume from
START_HEIGHT=1
if command -v psql >/dev/null 2>&1; then
  LAST_BLOCK=$(psql "$YACI_POSTGRES_DSN" -t -c "SELECT COALESCE(MAX(id), 0) FROM api.blocks_raw;" 2>/dev/null | tr -d ' ')
  if [ -n "$LAST_BLOCK" ] && [ "$LAST_BLOCK" -gt 0 ]; then
    START_HEIGHT=$LAST_BLOCK
    echo "Resuming from block $START_HEIGHT"
  fi
fi

exec yaci extract postgres "$YACI_GRPC_ENDPOINT" -p "$YACI_POSTGRES_DSN" --live -s "$START_HEIGHT" --enable-prometheus --prometheus-addr 0.0.0.0:2112 -c "${YACI_CONCURRENCY:-5}" "$@"
