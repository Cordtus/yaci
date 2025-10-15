#!/bin/bash
set -e

echo "🚀 Starting Yaci Indexer Stack..."
echo ""

# Check if services are already running
check_running() {
    local service=$1
    local check_cmd=$2
    if eval "$check_cmd" > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Database check
if check_running "PostgreSQL" "docker ps --filter name=infra-db-1 --filter status=running --format '{{.Names}}' | grep -q infra-db"; then
    echo "✓ PostgreSQL is already running"
    DB_RUNNING=true
else
    echo "📦 Starting PostgreSQL..."
    DB_RUNNING=false
fi

# Manifest ledger check (optional - for testing)
if check_running "Manifest Ledger" "docker ps --filter name=infra-manifest-ledger-1 --filter status=running --format '{{.Names}}' | grep -q infra-manifest-ledger"; then
    echo "✓ Manifest Ledger is already running"
    LEDGER_RUNNING=true
else
    echo "⛓️  Manifest Ledger will be started (for testing)..."
    LEDGER_RUNNING=false
fi

# Yaci indexer check
if pgrep -f "yaci extract.*--live" > /dev/null; then
    echo "✓ Yaci indexer is already running"
    YACI_RUNNING=true
else
    echo "📊 Yaci indexer will be started..."
    YACI_RUNNING=false
fi

echo ""

# Start infrastructure if needed
if [ "$DB_RUNNING" = false ] || [ "$LEDGER_RUNNING" = false ]; then
    echo "📦 Starting infrastructure..."
    cd docker/infra
    docker compose up -d
    cd ../..

    echo "⏳ Waiting for services to be ready..."
    echo "   - Waiting for PostgreSQL health check..."
    timeout 60 bash -c 'until docker exec infra-db-1 pg_isready -U postgres > /dev/null 2>&1; do sleep 2; done' || {
        echo "❌ PostgreSQL failed to start in time"
        exit 1
    }
    echo "   ✓ PostgreSQL is healthy"

    if [ "$LEDGER_RUNNING" = false ]; then
        echo "   - Waiting for Manifest Ledger health check..."
        timeout 90 bash -c 'until docker exec infra-manifest-ledger-1 manifestd status 2>/dev/null | grep -q "earliest_block_height"; do sleep 5; done' || {
            echo "❌ Manifest Ledger failed to start in time"
            exit 1
        }
        echo "   ✓ Manifest Ledger is healthy"
    fi
else
    echo "✓ Infrastructure already running, skipping startup"
fi

echo ""

# Start Yaci indexer if needed
if [ "$YACI_RUNNING" = false ]; then
    echo "📊 Starting Yaci indexer..."

    # Kill any existing yaci processes
    pkill -f "yaci extract.*--live" 2>/dev/null || true
    sleep 2

    # Check if binary exists
    if [ ! -f "./bin/yaci" ]; then
        echo "   ⚠️  Binary not found, building..."
        make build
    fi

    # Default to localhost:9090 if no CHAIN_GRPC_ENDPOINT is set
    GRPC_ENDPOINT=${CHAIN_GRPC_ENDPOINT:-localhost:9090}

    nohup ./bin/yaci extract postgres "$GRPC_ENDPOINT" \
        -p "postgres://postgres:foobar@localhost:5432/postgres" \
        --start 1 --live -k --max-concurrency 200 \
        --enable-prometheus --prometheus-addr 0.0.0.0:2112 \
        > yaci-indexer.log 2>&1 &

    echo "   ✓ Yaci indexer started (PID: $!)"
else
    echo "✓ Yaci indexer already running, skipping startup"
fi

echo ""
echo "✅ Yaci indexer stack started successfully!"
echo ""
echo "📡 Access points:"
echo "   - PostgreSQL:         localhost:5432"
echo "   - Blockchain gRPC:    ${CHAIN_GRPC_ENDPOINT:-localhost:9090}"
echo "   - Blockchain RPC:     http://localhost:26657"
echo "   - Prometheus metrics: http://localhost:2112/metrics"
echo ""
echo "📊 Monitor logs:"
echo "   - Yaci indexer:    tail -f yaci-indexer.log"
echo "   - Manifest Ledger: docker logs -f infra-manifest-ledger-1"
echo "   - PostgreSQL:      docker logs -f infra-db-1"
echo ""
echo "🛑 To stop services: ./scripts/stop-all.sh"
echo ""
echo "💡 To use the block explorer, see: https://github.com/Cordtus/yaci-explorer"
