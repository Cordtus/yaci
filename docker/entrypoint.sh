#!/bin/sh
set -e

if [ -z "$CHAIN_GRPC_ENDPOINT" ] || [ -z "$POSTGRES_CONN_STRING" ]; then
  echo "CHAIN_GRPC_ENDPOINT and POSTGRES_CONN_STRING must be set" >&2
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

exec yaci extract postgres "$CHAIN_GRPC_ENDPOINT" \
  -p "$POSTGRES_CONN_STRING" \
  --live \
  --enable-prometheus \
  --prometheus-addr 0.0.0.0:2112 \
  -c "${YACI_MAX_CONCURRENCY:-5}" \
  $INSECURE_FLAG \
  $START_FLAG \
  "$@"
