#!/bin/bash

echo "🚀 Starting Next.js Explorer..."

cd explorer

if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install --legacy-peer-deps
fi

echo "🌐 Starting Next.js development server..."
echo "📍 Explorer will be available at: http://localhost:3001"
echo "📊 API endpoint: http://localhost:3000" 
echo ""

npm run dev