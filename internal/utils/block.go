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

// GetLatestBlockHeightWithRetry retrieves the latest block height from the gRPC server with retry logic.
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
// It probes block 1 to check if the node is an archive node or pruned.
// For archive nodes, returns 1. For pruned nodes, parses the error message
// to extract the lowest available height.
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

// parseLowestHeightFromError extracts lowest height from pruned node errors.
// CosmosSDK nodes return errors like "height 1 is not available, lowest height is 28566001".
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
