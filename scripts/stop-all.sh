#!/bin/bash
set -e

echo "🛑 Stopping all Yaci indexer services..."
echo ""

# Function to safely stop docker compose in a directory
stop_compose() {
    local dir=$1
    local label=$2
    if [ -f "$dir/docker-compose.yml" ] || [ -f "$dir/compose.yaml" ]; then
        echo "  Stopping $label..."
        (cd "$dir" && docker compose down 2>/dev/null) || true
    fi
}

# Stop background processes
echo "📍 Stopping background processes..."
pkill -f "yaci extract.*--live" 2>/dev/null || true
echo "  ✓ Background processes stopped"
echo ""

# Stop all docker-compose configurations
echo "📍 Stopping Docker Compose stacks..."

# Docker subdirectories
stop_compose "docker/yaci" "yaci demo stack"
stop_compose "docker/infra" "infrastructure stack"

echo "  ✓ All compose stacks stopped"
echo ""

# Stop any remaining yaci-related containers
echo "📍 Cleaning up remaining containers..."
docker ps -a --filter "name=yaci" --filter "name=infra" --format "{{.Names}}" | while read -r container; do
    if [ ! -z "$container" ]; then
        echo "  Stopping $container..."
        docker stop "$container" 2>/dev/null || true
        docker rm "$container" 2>/dev/null || true
    fi
done
echo "  ✓ Cleanup complete"
echo ""

echo "✅ All Yaci indexer services stopped."
echo ""
echo "💡 Tips:"
echo "   - To remove volumes: docker volume prune"
echo "   - To start indexer: ./scripts/start-indexer.sh"
echo "   - For full stack with explorer: https://github.com/Cordtus/yaci-explorer"
