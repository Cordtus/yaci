#!/bin/bash

# Development setup script for Yaci Explorer

echo " Setting up Yaci Explorer development environment..."

# Check if yaci is running (look for live extraction process)
if pgrep -f "yaci extract.*--live" > /dev/null; then
    echo " Yaci indexer is running in live mode"
else
    echo "  Yaci indexer not detected. Please start yaci first:"
    echo "   ./bin/yaci extract postgres localhost:9090 -p \"postgres://postgres:foobar@localhost:5432/postgres\" --live -k"
    exit 1
fi

# Check PostgreSQL connection using Docker
if docker exec infra-db-1 pg_isready -U postgres > /dev/null 2>&1; then
    echo " PostgreSQL is running"
else
    echo " PostgreSQL not accessible. Please start PostgreSQL first with:"
    echo "   make docker-infra-up"
    exit 1
fi

# Install dependencies
echo " Installing dependencies..."
npm install

# Check if database has yaci tables
echo "  Checking database schema..."
if docker exec infra-db-1 psql -U postgres -d postgres -c "\dt api.*" > /dev/null 2>&1; then
    echo " Yaci database schema found"
else
    echo "  Yaci database schema not found. Make sure yaci has run at least once."
fi

# Start development server
echo " Starting development server..."
echo ""
echo "The explorer will be available at: http://localhost:3004"
echo "Make sure yaci is running with --live flag to see real-time updates!"
echo ""

npm run dev