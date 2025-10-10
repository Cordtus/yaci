#!/bin/bash

echo " Starting Vue 3 Explorer..."

cd explorer/explorer-vue

if [ ! -d "node_modules" ]; then
    echo " Installing dependencies..."
    npm install
fi

echo " Starting Vue 3 + Vite development server..."
echo " Explorer will be available at: http://localhost:5173"
echo " API endpoint: http://localhost:3000"
echo ""

npm run dev