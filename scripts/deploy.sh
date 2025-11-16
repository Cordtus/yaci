#!/bin/bash
# Yaci Indexer Production Deployment Script
# This script handles building, installing, and managing the yaci indexer service

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
INSTALL_DIR="/opt/yaci"
CONFIG_DIR="${INSTALL_DIR}/config"
SERVICE_FILE="yaci-indexer.service"
SYSTEMD_DIR="/etc/systemd/system"

# Helper functions
info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

success() {
    echo -e "${GREEN}✓${NC} $1"
}

warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

error() {
    echo -e "${RED}✗${NC} $1"
    exit 1
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        error "This script must be run as root. Use: sudo $0"
    fi
}

build_binary() {
    info "Building yaci binary..."
    make build || error "Build failed"
    success "Binary built successfully"
}

install_binary() {
    info "Installing binary to ${INSTALL_DIR}/bin/..."
    mkdir -p "${INSTALL_DIR}/bin"
    cp -f bin/yaci "${INSTALL_DIR}/bin/yaci"
    chmod +x "${INSTALL_DIR}/bin/yaci"
    success "Binary installed"
}

setup_config() {
    info "Setting up configuration..."
    mkdir -p "${CONFIG_DIR}"

    # Copy example config if yaci.env doesn't exist
    if [ ! -f "${CONFIG_DIR}/yaci.env" ]; then
        if [ -f "config/yaci.env.example" ]; then
            cp config/yaci.env.example "${CONFIG_DIR}/yaci.env"
            warning "Created ${CONFIG_DIR}/yaci.env from example. PLEASE EDIT THIS FILE!"
            warning "You must configure CHAIN_GRPC_ENDPOINT and POSTGRES_CONN_STRING"
        else
            error "config/yaci.env.example not found"
        fi
    else
        info "Using existing configuration at ${CONFIG_DIR}/yaci.env"
    fi

    # Copy all environment examples for reference
    if [ -d "config" ]; then
        cp -f config/*.env* "${CONFIG_DIR}/" 2>/dev/null || true
    fi

    success "Configuration setup complete"
}

install_service() {
    info "Installing systemd service..."

    if [ ! -f "scripts/${SERVICE_FILE}" ]; then
        error "Service file scripts/${SERVICE_FILE} not found"
    fi

    cp -f "scripts/${SERVICE_FILE}" "${SYSTEMD_DIR}/${SERVICE_FILE}"
    chmod 644 "${SYSTEMD_DIR}/${SERVICE_FILE}"

    systemctl daemon-reload
    success "Systemd service installed"
}

enable_service() {
    info "Enabling yaci-indexer service..."
    systemctl enable yaci-indexer
    success "Service enabled (will start on boot)"
}

start_service() {
    info "Starting yaci-indexer service..."
    systemctl restart yaci-indexer
    sleep 2

    if systemctl is-active --quiet yaci-indexer; then
        success "Service started successfully"
    else
        error "Service failed to start. Check: journalctl -u yaci-indexer -n 50"
    fi
}

show_status() {
    echo ""
    info "Service Status:"
    systemctl status yaci-indexer --no-pager || true
    echo ""
    info "Recent logs:"
    journalctl -u yaci-indexer -n 20 --no-pager || true
}

show_help() {
    cat <<EOF
Yaci Indexer Deployment Script

Usage: $0 [COMMAND]

Commands:
    install         Full installation (build, install, setup service)
    update          Update binary and restart service
    build           Build binary only
    config          Setup configuration files
    start           Start the service
    stop            Stop the service
    restart         Restart the service
    status          Show service status and logs
    logs            Follow service logs
    enable          Enable service to start on boot
    disable         Disable service from starting on boot
    uninstall       Remove service and files
    help            Show this help message

Examples:
    # First time installation
    sudo $0 install

    # Update after code changes
    sudo $0 update

    # View live logs
    sudo $0 logs

    # Check service status
    sudo $0 status

Configuration:
    Edit ${CONFIG_DIR}/yaci.env to configure the indexer

Logs:
    journalctl -u yaci-indexer -f          # Follow logs
    journalctl -u yaci-indexer -n 100      # Last 100 lines
    journalctl -u yaci-indexer --since     # Since timestamp
EOF
}

# Main deployment function
full_install() {
    check_root

    echo ""
    info "Starting Yaci Indexer Installation..."
    echo ""

    build_binary
    install_binary
    setup_config
    install_service
    enable_service

    echo ""
    warning "IMPORTANT: Edit ${CONFIG_DIR}/yaci.env before starting!"
    warning "Configure at minimum:"
    warning "  - CHAIN_GRPC_ENDPOINT (blockchain gRPC endpoint)"
    warning "  - POSTGRES_CONN_STRING (database connection)"
    echo ""

    read -p "Have you configured ${CONFIG_DIR}/yaci.env? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        start_service
        show_status
    else
        warning "Skipping service start. Start manually after configuration:"
        warning "  sudo systemctl start yaci-indexer"
    fi

    echo ""
    success "Installation complete!"
    echo ""
    info "Useful commands:"
    echo "  sudo systemctl status yaci-indexer    # Check status"
    echo "  sudo journalctl -u yaci-indexer -f    # View logs"
    echo "  sudo systemctl restart yaci-indexer   # Restart service"
    echo ""
}

update_deployment() {
    check_root

    echo ""
    info "Updating Yaci Indexer..."
    echo ""

    build_binary
    install_binary

    info "Restarting service..."
    systemctl restart yaci-indexer
    sleep 2

    if systemctl is-active --quiet yaci-indexer; then
        success "Update complete and service restarted"
        show_status
    else
        error "Service failed to restart. Check: journalctl -u yaci-indexer -n 50"
    fi
}

uninstall() {
    check_root

    warning "This will remove the yaci-indexer service and binary"
    read -p "Are you sure? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        info "Uninstall cancelled"
        exit 0
    fi

    info "Stopping service..."
    systemctl stop yaci-indexer 2>/dev/null || true

    info "Disabling service..."
    systemctl disable yaci-indexer 2>/dev/null || true

    info "Removing service file..."
    rm -f "${SYSTEMD_DIR}/${SERVICE_FILE}"
    systemctl daemon-reload

    info "Removing binary..."
    rm -f "${INSTALL_DIR}/bin/yaci"

    success "Uninstall complete"
    warning "Configuration files in ${CONFIG_DIR} were not removed"
}

# Command handling
case "${1:-help}" in
    install)
        full_install
        ;;
    update)
        update_deployment
        ;;
    build)
        build_binary
        ;;
    config)
        check_root
        setup_config
        ;;
    start)
        check_root
        systemctl start yaci-indexer
        success "Service started"
        ;;
    stop)
        check_root
        systemctl stop yaci-indexer
        success "Service stopped"
        ;;
    restart)
        check_root
        systemctl restart yaci-indexer
        success "Service restarted"
        ;;
    status)
        show_status
        ;;
    logs)
        journalctl -u yaci-indexer -f
        ;;
    enable)
        check_root
        enable_service
        ;;
    disable)
        check_root
        systemctl disable yaci-indexer
        success "Service disabled"
        ;;
    uninstall)
        uninstall
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        error "Unknown command: $1. Use '$0 help' for usage."
        ;;
esac
