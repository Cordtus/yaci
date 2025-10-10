#!/bin/bash

# Check for outdated dependencies
# Usage: ./scripts/check-deps.sh

echo " Checking for outdated dependencies..."
echo ""

npm outdated || true

echo ""
echo "To update dependencies:"
echo "  - Run 'npm update' for minor/patch updates"
echo "  - Run 'npm install <package>@latest' for major updates"
echo "  - Always test after updating!"
