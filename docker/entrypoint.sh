#!/bin/sh
set -e

if [ -z "$YACI_GRPC_ENDPOINT" ] || [ -z "$YACI_POSTGRES_DSN" ]; then
  echo "YACI_GRPC_ENDPOINT and YACI_POSTGRES_DSN must be set" >&2
  exit 1
fi

# Go code auto-resumes from last indexed block when no -s flag is passed
# extracts finalize_block_events for jailing/slashing data
exec yaci extract postgres "$YACI_GRPC_ENDPOINT" -p "$YACI_POSTGRES_DSN" --live -c "${YACI_CONCURRENCY:-5}" "$@"
