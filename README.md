<h1 align="center">yaci</h1>

<p align="center">
  <img src="https://raw.githubusercontent.com/cosmos/chain-registry/00df6ff89abd382f9efe3d37306c353e2bd8d55c/manifest/images/manifest.png" alt="Manifest Network" width="100"/>
</p>

![GitHub Actions Workflow Status](https://img.shields.io/github/actions/workflow/status/manifest-network/yaci/ci.yml)
[![codecov](https://codecov.io/github/manifest-network/yaci/graph/badge.svg?token=E0fP14l7Ct)](https://codecov.io/github/manifest-network/yaci)
[![Go Report Card](https://goreportcard.com/badge/github.com/manifest-network/yaci)](https://goreportcard.com/report/github.com/manifest-network/yaci)

`yaci` is a command-line tool that connects to Cosmos SDK chains via gRPC and extracts blockchain data to PostgreSQL for off-chain storage and indexing.

> **Looking for the Block Explorer?** See [yaci-explorer](https://github.com/Cordtus/yaci-explorer) - a separate project that provides a modern web UI for visualizing yaci-indexed data.

## Use Cases

- Off-chain indexing of block & transaction data
- Real-time blockchain monitoring and analytics
- Data warehouse for blockchain analytics and reporting
- API backend via PostgREST for custom applications

## Requirements

- Go 1.24.6
- Docker & Docker Compose (optional)
- CosmosSDK >= 0.50 (chain to index)

> [!IMPORTANT]
> When indexing an existing blockchain with pruning enabled, start the indexer from a recent block height that has not been pruned.

## Features

- **PostgreSQL Output**: Extracts block and transaction data to PostgreSQL with two-tier storage (raw JSON + parsed tables)
- **gRPC Server Reflection**: Auto-discovers protobuf definitions; no need to specify proto files
- **Dynamic Protobuf Decoding**: Properly decodes nested `Any` types using custom resolver
- **Live Monitoring**: Continuous extraction with configurable polling intervals
- **Batch Extraction**: Concurrent block fetching with configurable concurrency (default: 100)
- **EVM Support**: Native support for Cosmos chains with EVM modules (Ethermint, etc.)
- **Prometheus Metrics**: Optional metrics server for monitoring indexer performance
- **Auto-Recovery**: Detects and fills gaps in indexed data

## Installation

To install the `yaci` tool, you need to have Go installed on your system. Then, you can use the following command to install `yaci`:

```sh
go install github.com/manifest-network/yaci@latest
```

The `yaci` binary will be installed in the `$GOPATH/bin` directory.

## Usage
The basic usage of the yaci tool is as follows:
```shell
yaci [command] [address] [flags]
```

## Commands

- `completion` - Generate the autocompletion script for the specified shell.
- `extract` - Extracts blockchain data to various output format.
- `help` - Help about any command.
- `version` - Prints the version of the tool. 

## Global Flags

- `-l`, `--logLevel` - The log level (default: "info")'

## Extract Command

Extract blockchain data and output it in the specified format.

## Flags

The following flags are available for all `extract` subcommand:

- `-t`, `--block-time` - The time to wait between each block extraction (default: 2s)
- `-s`, `--start` - The starting block height to extract data from (default: 1)
- `-e`, `--stop` - The stopping block height to extract data from (default: 1)
- `-k`, `--insecure` - Skip TLS certificate verification (default: false)'
- `--live` - Continuously extract data from the blockchain (default: false)
- `--reindex` - Reindex the entire database from block 1 (default: false)'
- `-r`, `--max-retries` - The maximum number of retries to connect to the gRPC server (default: 3)
- `-c`, `--max-concurrency` - The maximum number of concurrent requests to the gRPC server (default: 100)
- `-m`, `--max-recv-msg-size` - The maximum gRPC message size, in bytes, the client can receive (default: 4194304 (4MB))'
- `--enable-prometheus` - Enable Prometheus metrics (default: false)
- `--prometheus-addr` - The address to bind the Prometheus metrics server to (default: "0.0.0.0:2112")

### Subcommands

- `postgres` - Extracts blockchain data to a PostgreSQL database.

### PostgreSQL Subcommand

Extract blockchain data and output it to a PostgreSQL database.

The PostgreSQL database has the following schema:

```mermaid
erDiagram
  "api.transactions_main" {
    varchar(64) id
    jsonb fee
    text memo
    text error
    string height
    text timestamp
    text[] proposal_id
  }
  "api.messages_raw" {
    varchar(64) id
    bigint message_index
    jsonb data
  }
  "api.messages_main" {
    varchar(64) id
    bigint message_index
    text type
    text sender
    text[] mentions
    jsonb metadata
  }
  "api.transactions_raw" {
    varchar(64) id
    jsonb data
  }
  "api.transactions_raw" ||--|| "api.transactions_main" : "trigger insert/update"
  "api.transactions_raw" ||--o{ "api.messages_raw": "trigger insert/update"
  "api.messages_raw" ||--|| "api.messages_main" : "trigger insert/update"
  "api.blocks_raw" {
    serial id
    jsonb data
  }
  "api.events_raw" {
    varchar(64) id
    bigint event_index
    jsonb data
  }
  "api.events_main" {
    varchar(64) id
    bigint event_index
    bigint attr_index
    text event_type
    text attr_key
    text attr_value
    bigint msg_index
  }
  "api.transactions_raw" ||--o{ "api.events_raw": "trigger insert/update"
  "api.events_raw" ||--|| "api.events_main" : "trigger insert/update"
```

#### Usage

```
Usage:
  yaci extract postgres [address] [flags]
```

#### Flags

- `-p`, `--postgres-conn` - The PostgreSQL connection string

#### Example

```shell
yaci extract postgres localhost:9090 -p postgres://postgres:foobar@localhost/postgres -s 106000 -k --live -t 5
```

This command will connect to the gRPC server running on `localhost:9090`, continuously extract data from block height `106000` and store the extracted data in the `postgres` database. New blocks and transactions will be inserted into the database every 5 seconds.

#### PostgreSQL Functions

The following PostgreSQL functions are available:

- `get_messages_for_address(_address)`: Returns relevant transactions for a given address.

## Configuration

The `yaci` tool parameters can be configured from the following sources

- Environment variables (prefixed with `YACI_`)
- Configuration file (`config.yaml`, `config.json`, `config.toml`, `config.hcl`, [~~`config.env`~~](https://github.com/manifest-network/yaci/issues/15) )
- Command-line flags

The command-line flags have the highest priority, followed by the environment variables, and then the configuration file.

The environment variables are prefixed with `YACI_` and are in uppercase. For example, the `--logLevel` flag can be set using the `YACI_LOGLEVEL` environment variable. Dash (`-`) is replaced with underscore (`_`). For example, the `--block-time` flag can be set using the `YACI_BLOCK_TIME` environment variable.

The configuration file is searched in the following order:
- The current working directory (`./`)
- The user's home directory (`$HOME/.yaci`)
- The system's configuration directory (`/etc/yaci`)

## Quick Start with Docker

To run a demo indexer with test blockchain:

```shell
# Build and start the test environment (includes PostgreSQL + test chain + indexer)
make docker-up

# View indexed data via PostgREST API
curl "http://localhost:3000/blocks_raw?order=id.desc&limit=10"
curl "http://localhost:3000/transactions_main?order=height.desc&limit=10"

# Stop the environment
make docker-down
```

This starts:
- **PostgreSQL**: localhost:5432 (indexed data storage)
- **PostgREST API**: http://localhost:3000 (REST API for indexed data)
- **Manifest Ledger**: localhost:9090 (test chain)
- **Yaci Indexer**: Indexes blocks in live mode

## Production Usage

For production deployments, see the [Docker deployment guide](#docker-deployment) below or use the [yaci-explorer](https://github.com/Cordtus/yaci-explorer) full-stack deployment.

### Using Docker Image

```bash
# Pull published image
docker pull ghcr.io/manifest-network/yaci:latest

# Run indexer
docker run -d \
  --name yaci-indexer \
  --network host \
  ghcr.io/manifest-network/yaci:latest \
  extract postgres YOUR_CHAIN_GRPC:9090 \
  -p postgres://user:pass@localhost:5432/dbname \
  --live \
  -k \
  --enable-prometheus
```

## Testing

To run the unit tests, you can use the following command:

```shell
make test
```

To run the end-to-end tests, you can use the following command:

```shell
make test-e2e
```

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Disclaimer

This software is provided "as is", without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose, and noninfringement. In no event shall the authors or copyright holders be liable for any claim, damages, or other liability, whether in an action of contract, tort, or otherwise, arising from, out of, or in connection with the software or the use or other dealings in the software.
