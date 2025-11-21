#!/bin/sh
set -e

if [ -z "$YACI_GRPC_ENDPOINT" ] || [ -z "$YACI_POSTGRES_DSN" ]; then
  echo "YACI_GRPC_ENDPOINT and YACI_POSTGRES_DSN must be set" >&2
  exit 1
fi

exec yaci extract postgres "$YACI_GRPC_ENDPOINT" -p "$YACI_POSTGRES_DSN" --live --enable-prometheus --prometheus-addr 0.0.0.0:2112 "$@"
