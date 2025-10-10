#!/bin/bash

# Complete development environment startup script
set -e

echo " Starting complete Yaci development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a service is running
check_service() {
    local service_name=$1
    local check_command=$2
    
    if eval "$check_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} $service_name is running"
        return 0
    else
        echo -e "${YELLOW}${NC} $service_name is not running"
        return 1
    fi
}

# Function to wait for a service to be ready
wait_for_service() {
    local service_name=$1
    local check_command=$2
    local max_attempts=${3:-30}
    local attempt=1
    
    echo -e "${YELLOW}${NC} Waiting for $service_name to be ready..."
    
    while [ $attempt -le $max_attempts ]; do
        if eval "$check_command" > /dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} $service_name is ready"
            return 0
        fi
        
        printf "."
        sleep 2
        ((attempt++))
    done
    
    echo ""
    echo -e "${RED}✗${NC} $service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Docker is not running. Please start Docker first."
    exit 1
fi

echo -e "${BLUE}${NC} Checking current service status..."

# Check what's already running
postgres_running=false
blockchain_running=false

if check_service "PostgreSQL" "docker exec infra-db-1 pg_isready -U postgres"; then
    postgres_running=true
fi

if check_service "Blockchain Node" "docker exec infra-manifest-ledger-1 manifestd status"; then
    blockchain_running=true
fi

# Start only missing infrastructure services
if [ "$postgres_running" = false ] || [ "$blockchain_running" = false ]; then
    echo -e "${YELLOW}${NC} Starting missing infrastructure services..."
    make docker-infra-up
    
    # Wait for services to be ready only if they weren't running
    if [ "$postgres_running" = false ]; then
        wait_for_service "PostgreSQL" "docker exec infra-db-1 pg_isready -U postgres"
    fi
    
    if [ "$blockchain_running" = false ]; then
        wait_for_service "Blockchain Node" "docker exec infra-manifest-ledger-1 manifestd status" 60
    fi
else
    echo -e "${GREEN}✓${NC} All infrastructure services already running"
fi

# Build yaci if needed
if [ ! -f "./bin/yaci" ]; then
    echo -e "${BLUE}${NC} Building yaci..."
    make build
fi

# Check if yaci indexer is running
if ! check_service "Yaci Indexer" "pgrep -f 'yaci extract.*--live'"; then
    echo -e "${YELLOW}${NC} Starting yaci indexer..."
    
    # Start yaci in background with higher concurrency for faster extraction
    nohup ./bin/yaci extract postgres localhost:9090 \
        -p "postgres://postgres:foobar@localhost:5432/postgres" \
        --live -k --max-concurrency 200 > yaci.log 2>&1 &
    
    echo -e "${GREEN}✓${NC} Yaci indexer started (logs in yaci.log)"
    
    # Wait for yaci to initialize and create schema
    wait_for_service "Yaci Database Schema" "docker exec infra-db-1 psql -U postgres -d postgres -c '\dt api.*'" 20
fi

# Setup explorer dependencies
echo -e "${BLUE}${NC} Setting up explorer dependencies..."
cd explorer
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}${NC} Installing explorer dependencies..."
    npm install --legacy-peer-deps
else
    echo -e "${GREEN}✓${NC} Explorer dependencies already installed"
fi

echo ""
echo -e "${GREEN}${NC} Complete development environment is ready!"
echo ""
echo -e "${BLUE}${NC} Services running:"
echo "   - PostgreSQL: localhost:5432"
echo "   - PostgREST API: localhost:3000"
echo "   - Blockchain Node: localhost:9090 (gRPC), localhost:26657 (RPC)"
echo "   - Yaci Indexer: running in background"
echo ""
echo -e "${BLUE}${NC} Available Explorers:"
echo "   - Modern Lit.dev Explorer: cd explorer/explorer-lit && yarn dev (http://localhost:5174) [RECOMMENDED]"
echo "   - Legacy Next.js Explorer: cd explorer && npm run dev (http://localhost:3001) [DEPRECATED]"
echo ""
echo -e "${BLUE}${NC} Useful commands:"
echo "   - Monitor yaci logs: tail -f yaci.log"  
echo "   - Stop services: make docker-infra-down"
echo "   - View PostgreSQL data: docker exec -it infra-db-1 psql -U postgres"
echo "   - API docs: http://localhost:3000"
echo ""
echo -e "${BLUE}${NC} Quick start explorers:"
echo "   - Lit.dev (recommended): ./scripts/start-lit.sh"
echo "   - Next.js (legacy): ./scripts/start-nextjs.sh"