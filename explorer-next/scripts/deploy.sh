#!/bin/bash

# Full deployment script with clean rebuild
# Usage: ./scripts/deploy.sh [environment]
# Example: ./scripts/deploy.sh production

set -e

ENVIRONMENT=${1:-production}

echo "🚀 Starting deployment for $ENVIRONMENT environment..."

# Clean everything
echo "🧹 Cleaning all artifacts..."
rm -rf build .react-router node_modules/.vite node_modules

# Fresh install
echo "📦 Fresh npm install..."
npm install

# Run linting
echo "🔍 Running linter..."
npm run lint

# Type checking
echo "📝 Type checking..."
npm run typecheck

# Build
echo "🏗️  Building application..."
npm run build

echo ""
echo "✅ Deployment build complete!"
echo ""
echo "Next steps:"
echo "  1. Test the build: npm start"
echo "  2. Deploy the ./build directory to your server"
echo "  3. Ensure NEXT_PUBLIC_POSTGREST_URL is set in production"
echo ""
