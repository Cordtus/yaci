package utils

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/pkg/errors"
)

const statusMethod = "cosmos.base.node.v1beta1.Service.Status"
const getBlockByHeightMethod = "cosmos.base.tendermint.v1beta1.Service.GetBlockByHeight"

// GetLatestBlockHeightWithRetry gets current block height from Status endpoint
func GetLatestBlockHeightWithRetry(gRPCClient *client.GRPCClient, maxRetries uint) (uint64, error) {
	return ExtractGRPCField(
		gRPCClient,
		statusMethod,
		maxRetries,
		"height",
		func(s string) (uint64, error) {
			height, err := strconv.ParseUint(s, 10, 64)
			if err != nil {
				return 0, errors.WithMessage(err, "error parsing height")
			}
			return height, nil
		},
	)
}

// GetEarliestBlockHeight determines the earliest available block on a node.
//
// Strategy:
// 1. Probe block 1 with minimal retries (pruned nodes fail fast with clear error)
// 2. If successful, node is an archive node - return 1
// 3. If error contains "lowest height is X", node is pruned - return X
// 4. If error is transient (network issue), retry with full retry count
//
// This approach minimizes latency for the common case (pruned nodes return
// immediately with the lowest height) while still handling archive nodes
// and transient failures gracefully.
func GetEarliestBlockHeight(gRPCClient *client.GRPCClient, maxRetries uint) (uint64, error) {
	inputParams := []byte(`{"height":"1"}`)

	// Fast path: single attempt to check if block 1 exists
	_, err := GetGRPCResponse(gRPCClient, getBlockByHeightMethod, 1, inputParams)
	if err == nil {
		return 1, nil // Archive node with full history
	}

	// Check if error reveals the pruning boundary
	if lowestHeight := parseLowestHeightFromError(err.Error()); lowestHeight > 0 {
		return lowestHeight, nil
	}

	// Error was neither "block exists" nor "pruned" - retry in case of transient failure
	_, err = GetGRPCResponse(gRPCClient, getBlockByHeightMethod, maxRetries, inputParams)
	if err == nil {
		return 1, nil
	}

	return 0, fmt.Errorf("failed to determine earliest block height: %w", err)
}

// parseLowestHeightFromError extracts lowest height from pruned node errors
func parseLowestHeightFromError(errMsg string) uint64 {
	re := regexp.MustCompile(`lowest height is (\d+)`)
	matches := re.FindStringSubmatch(strings.ToLower(errMsg))

	if len(matches) >= 2 {
		height, err := strconv.ParseUint(matches[1], 10, 64)
		if err == nil {
			return height
		}
	}

	return 0
}
