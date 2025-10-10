#!/bin/bash

# Reset development environment
# Useful when encountering persistent dev issues
# Usage: ./scripts/dev-reset.sh

set -e

echo " Resetting development environment..."

# Kill any running dev servers on port 5173
echo " Stopping any running dev servers..."
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

# Clean all artifacts
echo " Cleaning build artifacts..."
rm -rf build .react-router node_modules/.vite

# Reinstall dependencies
echo " Reinstalling dependencies..."
rm -rf node_modules package-lock.json
npm install

echo ""
echo " Development environment reset complete!"
echo "Run 'npm run dev' to start the development server"
