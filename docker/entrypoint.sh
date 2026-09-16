#!/bin/sh
set -e

# Accept both naming conventions used across deployments.
CHAIN_GRPC_ENDPOINT="${CHAIN_GRPC_ENDPOINT:-$YACI_GRPC_ENDPOINT}"
POSTGRES_CONN_STRING="${POSTGRES_CONN_STRING:-$YACI_POSTGRES_DSN}"

if [ -z "$CHAIN_GRPC_ENDPOINT" ] || [ -z "$POSTGRES_CONN_STRING" ]; then
  echo "CHAIN_GRPC_ENDPOINT (or YACI_GRPC_ENDPOINT) and POSTGRES_CONN_STRING (or YACI_POSTGRES_DSN) must be set" >&2
  exit 1
fi

INSECURE_FLAG=""
if [ "$YACI_INSECURE" = "true" ]; then
  INSECURE_FLAG="--insecure"
fi

START_FLAG=""
if [ -n "$YACI_START" ]; then
  START_FLAG="-s $YACI_START"
fi

# Requires a node exposing the GetBlockResults endpoint (e.g. republicd).
BLOCK_RESULTS_FLAG=""
if [ "$YACI_ENABLE_BLOCK_RESULTS" = "true" ]; then
  BLOCK_RESULTS_FLAG="--enable-block-results"
fi

# Go code auto-resumes from the last indexed block when no -s flag is passed.
exec yaci extract postgres "$CHAIN_GRPC_ENDPOINT" \
  -p "$POSTGRES_CONN_STRING" \
  --live \
  --enable-prometheus \
  --prometheus-addr 0.0.0.0:2112 \
  -c "${YACI_MAX_CONCURRENCY:-${YACI_CONCURRENCY:-5}}" \
  $INSECURE_FLAG \
  $START_FLAG \
  $BLOCK_RESULTS_FLAG \
  "$@"
