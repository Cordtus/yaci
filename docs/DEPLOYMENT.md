# Yaci Indexer Production Deployment Guide

This guide covers deploying the Yaci indexer as a systemd service on a barebones Linux server (no Docker required).

## Prerequisites

- Linux server with systemd
- Go 1.21+ installed
- PostgreSQL database (local or remote)
- Access to a blockchain node's gRPC endpoint
- Root/sudo access for service installation

## Quick Start

### 1. Clone and Build

```bash
# Clone the repository
git clone https://github.com/Cordtus/yaci.git
cd yaci

# Build the binary
make build
```

### 2. Install as Service

```bash
# Run the deployment script
sudo ./scripts/deploy.sh install
```

The installer will:
- Build and install the binary to `/opt/yaci/bin/yaci`
- Create configuration directory at `/opt/yaci/config/`
- Install systemd service file
- Enable the service to start on boot

### 3. Configure

Edit the configuration file for your chain:

```bash
sudo nano /opt/yaci/config/yaci.env
```

**Minimum required configuration:**

```bash
# Your blockchain node's gRPC endpoint
CHAIN_GRPC_ENDPOINT=nodes.chandrastation.com:9090

# Your PostgreSQL connection string
POSTGRES_CONN_STRING=postgres://user:password@localhost:5432/dbname?sslmode=disable
```

### 4. Start the Service

```bash
sudo systemctl start yaci-indexer
sudo systemctl status yaci-indexer
```

## Configuration Examples

The `config/` directory contains pre-configured examples:

### Manifest Mainnet

```bash
sudo cp /opt/yaci/config/manifest-mainnet.env /opt/yaci/config/yaci.env
sudo nano /opt/yaci/config/yaci.env  # Update POSTGRES_CONN_STRING
sudo systemctl restart yaci-indexer
```

### Republic Testnet

```bash
sudo cp /opt/yaci/config/republic-testnet.env /opt/yaci/config/yaci.env
sudo nano /opt/yaci/config/yaci.env  # Update POSTGRES_CONN_STRING
sudo systemctl restart yaci-indexer
```

### Local Development

```bash
sudo cp /opt/yaci/config/localhost-dev.env /opt/yaci/config/yaci.env
sudo systemctl restart yaci-indexer
```

## Deployment Script Commands

The `deploy.sh` script provides several commands for managing the indexer:

```bash
# Full installation (first time)
sudo ./scripts/deploy.sh install

# Update binary after code changes
sudo ./scripts/deploy.sh update

# Service management
sudo ./scripts/deploy.sh start
sudo ./scripts/deploy.sh stop
sudo ./scripts/deploy.sh restart
sudo ./scripts/deploy.sh status

# View logs
sudo ./scripts/deploy.sh logs

# Configuration
sudo ./scripts/deploy.sh config

# Remove installation
sudo ./scripts/deploy.sh uninstall

# Show help
./scripts/deploy.sh help
```

## Service Management

### Systemd Commands

```bash
# Start the service
sudo systemctl start yaci-indexer

# Stop the service
sudo systemctl stop yaci-indexer

# Restart the service
sudo systemctl restart yaci-indexer

# View status
sudo systemctl status yaci-indexer

# Enable on boot
sudo systemctl enable yaci-indexer

# Disable on boot
sudo systemctl disable yaci-indexer
```

### View Logs

```bash
# Follow logs in real-time
sudo journalctl -u yaci-indexer -f

# View last 100 lines
sudo journalctl -u yaci-indexer -n 100

# View logs since specific time
sudo journalctl -u yaci-indexer --since "2024-01-01 12:00:00"

# View logs with timestamps
sudo journalctl -u yaci-indexer -o short-iso
```

## Configuration Reference

All configuration is done via environment variables in `/opt/yaci/config/yaci.env`:

### Chain Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `CHAIN_GRPC_ENDPOINT` | Blockchain gRPC endpoint | `nodes.chandrastation.com:9090` |
| `CHAIN_ID` | Chain identifier (for logging) | `manifest-1` |

### Database Configuration

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_CONN_STRING` | PostgreSQL connection string | `postgres://user:pass@localhost:5432/db` |

### Indexer Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `START_BLOCK` | Starting block height (empty = auto-resume) | `` |
| `STOP_BLOCK` | Stopping block height (empty = continuous) | `` |
| `ENABLE_LIVE` | Enable live monitoring | `true` |
| `BLOCK_TIME` | Polling interval in seconds | `2` |

### Performance Tuning

| Variable | Description | Default |
|----------|-------------|---------|
| `MAX_CONCURRENCY` | Max concurrent block requests | `100` |
| `MAX_RETRIES` | Max retry attempts | `3` |
| `MAX_RECV_MSG_SIZE` | Max gRPC message size (bytes) | `4194304` |

### Security

| Variable | Description | Default |
|----------|-------------|---------|
| `INSECURE` | Skip TLS verification | `false` |

### Observability

| Variable | Description | Default |
|----------|-------------|---------|
| `ENABLE_PROMETHEUS` | Enable metrics server | `true` |
| `PROMETHEUS_ADDR` | Metrics bind address | `0.0.0.0:2112` |
| `LOG_LEVEL` | Log level (debug/info/warn/error) | `info` |

## Database Setup

### PostgreSQL Installation

```bash
# Install PostgreSQL
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### Create Database and User

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user
CREATE DATABASE manifest;
CREATE USER yaci WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE manifest TO yaci;
\q
```

### Test Connection

```bash
psql "postgres://yaci:your_secure_password@localhost:5432/manifest"
```

## Updating the Indexer

### Code Updates

```bash
cd /path/to/yaci

# Pull latest changes
git pull

# Update deployment
sudo ./scripts/deploy.sh update
```

This will:
1. Build the new binary
2. Install it to `/opt/yaci/bin/`
3. Restart the service automatically

### Configuration Updates

```bash
# Edit configuration
sudo nano /opt/yaci/config/yaci.env

# Restart to apply changes
sudo systemctl restart yaci-indexer
```

## Monitoring

### Health Checks

```bash
# Check if service is running
sudo systemctl is-active yaci-indexer

# Check service status
sudo ./scripts/deploy.sh status

# View recent logs
sudo journalctl -u yaci-indexer -n 50
```

### Prometheus Metrics

Access metrics at: `http://your-server:2112/metrics`

Key metrics:
- Block indexing rate
- Database insert performance
- gRPC connection health
- Error rates

### Log Monitoring

Set up log alerting:

```bash
# Example: Alert on errors
sudo journalctl -u yaci-indexer -f | grep -i error
```

## Troubleshooting

### Service Won't Start

```bash
# Check service status
sudo systemctl status yaci-indexer

# View detailed logs
sudo journalctl -u yaci-indexer -n 100 --no-pager

# Common issues:
# 1. Wrong database credentials
# 2. Database not accessible
# 3. gRPC endpoint unreachable
# 4. Configuration file syntax error
```

### Database Connection Errors

```bash
# Test PostgreSQL connection manually
psql "YOUR_POSTGRES_CONN_STRING"

# Check PostgreSQL is running
sudo systemctl status postgresql

# Check firewall
sudo ufw status
```

### gRPC Connection Errors

```bash
# Test gRPC endpoint
grpcurl nodes.chandrastation.com:9090 list

# Check network connectivity
telnet nodes.chandrastation.com 9090

# Try with TLS disabled in config
INSECURE=true
```

### High Memory Usage

Reduce concurrency in configuration:

```bash
MAX_CONCURRENCY=50  # Default is 100
MAX_RECV_MSG_SIZE=2097152  # Reduce from 4MB to 2MB
```

### Slow Indexing

Increase concurrency and resources:

```bash
MAX_CONCURRENCY=200
MAX_RETRIES=5
BLOCK_TIME=1  # Faster polling
```

## Multiple Chain Deployment

To run indexers for multiple chains on the same server:

### 1. Create Separate Services

```bash
# Copy service file for each chain
sudo cp /etc/systemd/system/yaci-indexer.service /etc/systemd/system/yaci-manifest.service
sudo cp /etc/systemd/system/yaci-indexer.service /etc/systemd/system/yaci-republic.service
```

### 2. Update Service Files

Edit each service to use different config files:

```bash
sudo nano /etc/systemd/system/yaci-manifest.service
# Change: EnvironmentFile=/opt/yaci/config/manifest.env

sudo nano /etc/systemd/system/yaci-republic.service
# Change: EnvironmentFile=/opt/yaci/config/republic.env
```

### 3. Create Configurations

```bash
sudo cp /opt/yaci/config/manifest-mainnet.env /opt/yaci/config/manifest.env
sudo cp /opt/yaci/config/republic-testnet.env /opt/yaci/config/republic.env

# Edit each config with different databases and Prometheus ports
sudo nano /opt/yaci/config/manifest.env
# POSTGRES_CONN_STRING=postgres://yaci:pass@localhost:5432/manifest
# PROMETHEUS_ADDR=0.0.0.0:2112

sudo nano /opt/yaci/config/republic.env
# POSTGRES_CONN_STRING=postgres://yaci:pass@localhost:5432/republic
# PROMETHEUS_ADDR=0.0.0.0:2113
```

### 4. Start Services

```bash
sudo systemctl daemon-reload
sudo systemctl enable yaci-manifest yaci-republic
sudo systemctl start yaci-manifest yaci-republic
```

## Security Best Practices

1. **Run as non-root user**: Modify the service file to use a dedicated user
2. **Firewall**: Only expose necessary ports (PostgreSQL, Prometheus)
3. **Database security**: Use strong passwords, restrict network access
4. **TLS**: Enable TLS for production gRPC endpoints (`INSECURE=false`)
5. **Log rotation**: Configure journald or logrotate to manage log size
6. **Monitoring**: Set up alerts for service failures and errors

## Performance Optimization

### For High-Performance Indexing

```bash
# Increase concurrency
MAX_CONCURRENCY=300

# Increase gRPC message size for large blocks
MAX_RECV_MSG_SIZE=16777216  # 16MB

# Reduce polling interval
BLOCK_TIME=1

# Increase retries for reliability
MAX_RETRIES=10
```

### For Resource-Constrained Systems

```bash
# Reduce concurrency
MAX_CONCURRENCY=25

# Smaller message size
MAX_RECV_MSG_SIZE=2097152  # 2MB

# Slower polling
BLOCK_TIME=5

# Fewer retries
MAX_RETRIES=3
```

## Backup and Recovery

### Database Backup

```bash
# Backup database
pg_dump -U yaci manifest > manifest_backup_$(date +%Y%m%d).sql

# Restore database
psql -U yaci manifest < manifest_backup_20240101.sql
```

### Configuration Backup

```bash
# Backup configuration
sudo cp /opt/yaci/config/yaci.env /opt/yaci/config/yaci.env.backup
```

## Support

- **Documentation**: [CLAUDE.md](../CLAUDE.md)
- **Issues**: [GitHub Issues](https://github.com/manifest-network/yaci/issues)
- **Explorer**: [Yaci Explorer](https://github.com/Cordtus/yaci-explorer)
