#!/bin/bash

echo "🚀 Starting persistent Yaci services..."

# Kill existing processes
pkill -f "yaci extract.*--live" 2>/dev/null || true
pkill -f "postgrest" 2>/dev/null || true
pkill -f "vite.*5174" 2>/dev/null || true

# Start infrastructure with Docker
echo "📦 Starting database and blockchain..."
docker-compose up -d db redis manifest-ledger

# Wait for services
echo "⏳ Waiting for services to be ready..."
sleep 30

# Start PostgREST in background with nohup
echo "🌐 Starting PostgREST API..."
nohup docker run --rm --name postgrest-persistent --network host \
  -e PGRST_DB_URI=postgres://postgres:foobar@localhost:5432/postgres \
  -e PGRST_DB_SCHEMA=api \
  -e PGRST_DB_ANON_ROLE=postgres \
  postgrest/postgrest:v12.0.2 > postgrest.log 2>&1 &

# Start EVM enhanced yaci indexer in background
echo "⚡ Starting EVM enhanced yaci indexer..."
nohup ./bin/yaci extract postgres localhost:9090 \
  -p "postgres://postgres:foobar@localhost:5432/postgres" \
  --start 1 --live -k --max-concurrency 200 > yaci-enhanced.log 2>&1 &

# Wait a bit for API to be ready
sleep 10

# Start Lit.dev explorer in background
echo "🎯 Starting Lit.dev explorer..."
cd explorer/explorer-lit
nohup yarn dev --host 0.0.0.0 --port 5174 > ../../explorer-lit.log 2>&1 &
cd ../..

echo ""
echo "✅ All services started persistently!"
echo ""
echo "📍 Access points:"
echo "   - Lit.dev Explorer: http://localhost:5174"
echo "   - PostgREST API: http://localhost:3000" 
echo "   - PostgreSQL: localhost:5432"
echo "   - Blockchain gRPC: localhost:9090"
echo ""
echo "📊 Monitor logs:"
echo "   - Yaci indexer: tail -f yaci-enhanced.log"
echo "   - PostgREST API: tail -f postgrest.log"
echo "   - Explorer: tail -f explorer-lit.log"
echo ""
echo "🛑 To stop all services: ./scripts/stop-all.sh"