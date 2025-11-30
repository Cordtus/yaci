#!/bin/sh
set -e

if [ -z "$YACI_GRPC_ENDPOINT" ] || [ -z "$YACI_POSTGRES_DSN" ]; then
  echo "YACI_GRPC_ENDPOINT and YACI_POSTGRES_DSN must be set" >&2
  exit 1
fi

INSECURE_FLAG=""
if [ "$YACI_INSECURE" = "true" ]; then
  INSECURE_FLAG="--insecure"
fi

# Go code auto-resumes from last indexed block when no -s flag is passed
exec yaci extract postgres "$YACI_GRPC_ENDPOINT" -p "$YACI_POSTGRES_DSN" --live --enable-prometheus --prometheus-addr 0.0.0.0:2112 -c "${YACI_CONCURRENCY:-5}" $INSECURE_FLAG "$@"
