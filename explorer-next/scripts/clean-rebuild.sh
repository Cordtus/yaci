#!/bin/bash

# Clean and rebuild the explorer application
# Usage: ./scripts/clean-rebuild.sh

set -e

echo " Cleaning build artifacts and cache..."
rm -rf build .react-router node_modules/.vite

echo " Installing dependencies..."
npm install

echo " Running type check..."
npm run typecheck

echo "  Building application..."
npm run build

echo " Clean rebuild complete!"
echo "Run 'npm start' to serve the built application"
