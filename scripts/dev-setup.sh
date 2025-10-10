#!/bin/bash

# Development setup script for Yaci + Explorer
set -e

echo " Setting up Yaci development environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a Docker container is running and healthy
check_docker_service() {
    local service_name=$1
    local container_name=$2
    
    if docker ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
        echo -e "${GREEN}✓${NC} $service_name is running"
        return 0
    else
        echo -e "${RED}✗${NC} $service_name is not running"
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
        
        echo -e "${YELLOW}...${NC} Attempt $attempt/$max_attempts"
        sleep 2
        ((attempt++))
    done
    
    echo -e "${RED}✗${NC} $service_name failed to become ready after $max_attempts attempts"
    return 1
}

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}✗${NC} Docker is not running. Please start Docker first."
    exit 1
fi

echo -e "${BLUE}${NC} Checking service status..."

# Check infrastructure services
postgres_running=false
blockchain_running=false

if check_docker_service "PostgreSQL" "infra-db-1"; then
    postgres_running=true
fi

if check_docker_service "Blockchain Node" "infra-manifest-ledger-1"; then
    blockchain_running=true
fi

# Start missing infrastructure services
if [ "$postgres_running" = false ] || [ "$blockchain_running" = false ]; then
    echo -e "${YELLOW}${NC} Starting infrastructure services..."
    make docker-infra-up
    
    # Wait for PostgreSQL to be ready
    wait_for_service "PostgreSQL" "docker exec infra-db-1 pg_isready -U postgres"
    
    # Wait for blockchain node to be ready
    wait_for_service "Blockchain Node" "docker exec infra-manifest-ledger-1 manifestd status"
fi

# Check if yaci indexer is running
if pgrep -f "yaci extract.*--live" > /dev/null; then
    echo -e "${GREEN}✓${NC} Yaci indexer is running in live mode"
else
    echo -e "${YELLOW}${NC} Starting yaci indexer..."
    
    # Build yaci if not exists
    if [ ! -f "./bin/yaci" ]; then
        echo -e "${BLUE}${NC} Building yaci..."
        make build
    fi
    
    # Start yaci in background
    nohup ./bin/yaci extract postgres localhost:9090 \
        -p "postgres://postgres:foobar@localhost:5432/postgres" \
        --live -k > yaci.log 2>&1 &
    
    echo -e "${GREEN}✓${NC} Yaci indexer started (logs in yaci.log)"
    
    # Wait a moment for yaci to initialize
    sleep 5
fi

# Check if database schema exists
echo -e "${BLUE}${NC} Checking database schema..."
if docker exec infra-db-1 psql -U postgres -d postgres -c "\dt api.*" > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Yaci database schema found"
else
    echo -e "${YELLOW}${NC} Waiting for yaci to create database schema..."
    sleep 10
    if docker exec infra-db-1 psql -U postgres -d postgres -c "\dt api.*" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC} Yaci database schema created"
    else
        echo -e "${YELLOW}${NC} Database schema not yet created. Yaci may still be initializing."
    fi
fi

echo -e "${GREEN}${NC} Development environment is ready!"
echo -e "${BLUE}${NC} Services running:"
echo "   - PostgreSQL: localhost:5432"
echo "   - Blockchain Node: localhost:9090"
echo "   - PostgREST API: localhost:3000"
echo "   - Yaci Indexer: running in background"
echo ""
echo -e "${BLUE}${NC} To start the explorer:"
echo "   cd explorer && npm install && npm run dev"
echo ""
echo -e "${BLUE}${NC} Monitor yaci logs: tail -f yaci.log"