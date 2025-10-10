#!/bin/bash

echo " Starting Lit.dev Explorer..."

cd explorer/explorer-lit

if [ ! -d "node_modules" ]; then
    echo " Installing dependencies..."
    yarn install
fi

echo " Starting Lit.dev development server..."
echo " Explorer will be available at: http://localhost:5174"
echo " API endpoint: http://localhost:3000"
echo ""

yarn dev