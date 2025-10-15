#!/bin/bash
set -e

echo "🧹 Docker Maintenance"
echo ""

# Check if any containers are running
RUNNING_CONTAINERS=$(docker ps -q | wc -l | tr -d ' ')
if [ "$RUNNING_CONTAINERS" -gt 0 ]; then
    echo "⚠️  Warning: $RUNNING_CONTAINERS container(s) currently running"
    echo "   Run ./scripts/stop-all.sh first to stop all services"
    echo ""
    read -p "   Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

echo "📊 Current Docker usage:"
echo ""
docker system df
echo ""

# Prune stopped containers
echo "🗑️  Removing stopped containers..."
REMOVED_CONTAINERS=$(docker container prune -f 2>&1 | grep "Total reclaimed space" || echo "0B")
echo "   $REMOVED_CONTAINERS"
echo ""

# Prune dangling images
echo "🗑️  Removing dangling images..."
REMOVED_IMAGES=$(docker image prune -f 2>&1 | grep "Total reclaimed space" || echo "0B")
echo "   $REMOVED_IMAGES"
echo ""

# Prune unused networks
echo "🗑️  Removing unused networks..."
REMOVED_NETWORKS=$(docker network prune -f 2>&1 | grep "Total reclaimed space" || echo "0B")
echo "   $REMOVED_NETWORKS"
echo ""

# Show volume information
echo "💾 Docker volumes:"
docker volume ls
echo ""

# Ask about volume pruning
read -p "Remove unused volumes? This will delete data! (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing unused volumes..."
    docker volume prune -f
    echo ""
else
    echo "   Skipping volume cleanup"
    echo ""
fi

# Clean build cache
read -p "Clean Docker build cache? (y/N): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🗑️  Removing build cache..."
    docker builder prune -f
    echo ""
else
    echo "   Skipping build cache cleanup"
    echo ""
fi

echo "📊 Docker usage after cleanup:"
echo ""
docker system df
echo ""

echo "✅ Maintenance complete!"
echo ""
echo "💡 Tips:"
echo "   - For aggressive cleanup: docker system prune -a --volumes"
echo "   - To restart services: ./scripts/start-persistent.sh"
