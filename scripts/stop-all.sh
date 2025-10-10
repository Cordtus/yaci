#!/bin/bash

echo " Stopping all Yaci services..."

# Stop background processes
pkill -f "yaci extract.*--live" 2>/dev/null || true
pkill -f "postgrest" 2>/dev/null || true  
pkill -f "vite.*5174" 2>/dev/null || true

# Stop Docker containers
docker stop postgrest-persistent 2>/dev/null || true
docker-compose down

echo " All services stopped."