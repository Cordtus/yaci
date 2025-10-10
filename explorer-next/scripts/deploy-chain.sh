#!/bin/bash

# Deployment script for Yaci Explorer on a new chain
# This script configures and starts the entire explorer stack for a new blockchain

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Yaci Explorer Chain Deployment Script${NC}"
echo "======================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo -e "${YELLOW}No .env file found. Creating from .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}Created .env file. Please edit it with your chain configuration.${NC}"
    echo "Required configuration:"
    echo "  - GRPC_ENDPOINT: Your chain's gRPC endpoint"
    echo "  - DATABASE_URL: PostgreSQL connection string"
    echo "  - NEXT_PUBLIC_POSTGREST_URL: PostgREST API endpoint"
    echo "  - PROMETHEUS_ENDPOINT (optional): Prometheus metrics endpoint"
    exit 1
fi

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

echo -e "${GREEN}Configuration loaded:${NC}"
echo "  Chain: ${NEXT_PUBLIC_CHAIN_NAME:-Unknown}"
echo "  gRPC: ${GRPC_ENDPOINT}"
echo "  Database: ${DATABASE_URL}"
echo "  PostgREST: ${NEXT_PUBLIC_POSTGREST_URL}"
echo "  Prometheus: ${PROMETHEUS_ENDPOINT:-Not configured}"
echo ""

# Function to check if a service is running
check_service() {
    local service=$1
    local port=$2
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓ $service is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}✗ $service is not running on port $port${NC}"
        return 1
    fi
}

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

# Check PostgreSQL
if check_service "PostgreSQL" 5432; then
    echo "PostgreSQL is running"
else
    echo -e "${RED}PostgreSQL is not running. Please start it first.${NC}"
    exit 1
fi

# Check PostgREST
if check_service "PostgREST" 3010; then
    echo "PostgREST is running"
else
    echo -e "${YELLOW}PostgREST is not running. Starting it...${NC}"
    # You might want to add PostgREST startup command here
    echo "Please start PostgREST manually or via Docker"
fi

# Build yaci if needed
if [ ! -f ../bin/yaci ]; then
    echo -e "${YELLOW}Building yaci extractor...${NC}"
    cd ..
    make build
    cd explorer-next
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    yarn install
fi

# Create start script with chain configuration
cat > start-explorer.sh << EOF
#!/bin/bash
# Auto-generated script to start the explorer with current configuration

# Start yaci extractor in background
echo "Starting yaci extractor..."
../bin/yaci extract postgres ${GRPC_ENDPOINT} \\
    -p "${DATABASE_URL}" \\
    --live \\
    --enable-prometheus \\
    -k \\
    -t 6 \\
    -l info &

YACI_PID=\$!
echo "Yaci extractor started with PID \$YACI_PID"

# Start explorer frontend
echo "Starting explorer frontend..."
NEXT_PUBLIC_POSTGREST_URL=${NEXT_PUBLIC_POSTGREST_URL} \\
NEXT_PUBLIC_CHAIN_NAME="${NEXT_PUBLIC_CHAIN_NAME}" \\
NEXT_PUBLIC_CHAIN_ID="${NEXT_PUBLIC_CHAIN_ID}" \\
yarn dev &

FRONTEND_PID=\$!
echo "Frontend started with PID \$FRONTEND_PID"

# Wait for interrupt
echo ""
echo "Explorer is running!"
echo "  Frontend: http://localhost:5173"
echo "  API: ${NEXT_PUBLIC_POSTGREST_URL}"
echo ""
echo "Press Ctrl+C to stop..."

# Trap Ctrl+C and kill both processes
trap "echo 'Stopping...'; kill \$YACI_PID \$FRONTEND_PID; exit" INT
wait
EOF

chmod +x start-explorer.sh

echo -e "${GREEN}Deployment script created: start-explorer.sh${NC}"
echo ""
echo "To start the explorer, run:"
echo "  ./start-explorer.sh"
echo ""
echo "Configuration summary:"
echo "  - Chain gRPC: ${GRPC_ENDPOINT}"
echo "  - Database: PostgreSQL on localhost:5432"
echo "  - API: PostgREST on ${NEXT_PUBLIC_POSTGREST_URL}"
echo "  - Frontend: http://localhost:5173"

if [ -n "$PROMETHEUS_ENDPOINT" ]; then
    echo "  - Metrics: ${PROMETHEUS_ENDPOINT}"
fi

echo ""
echo -e "${GREEN}Setup complete!${NC}"