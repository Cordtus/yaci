package utils

import (
	"strconv"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/pkg/errors"
)

const statusMethod = "cosmos.base.node.v1beta1.Service.Status"
const getLatestBlockMethod = "cosmos.base.tendermint.v1beta1.Service.GetLatestBlock"

// GetLatestBlockHeightWithRetry retrieves the latest block height from the gRPC server with retry logic.
// It tries the Status method (cosmos.base.node.v1beta1.Service.Status) first, and falls back to
// GetLatestBlock (cosmos.base.tendermint.v1beta1.Service.GetLatestBlock) if Status is unavailable.
//
// This fallback improves indexer robustness when:
// - The node's Status endpoint is disabled or unavailable
// - Pruning is enabled and early blocks (height 0/1) are not available
// - Different chain configurations use different gRPC endpoint structures
//
// With this fallback, the indexer can discover the earliest available height and begin indexing
// from there, rather than failing when attempting to query unavailable historical data.
func GetLatestBlockHeightWithRetry(gRPCClient *client.GRPCClient, maxRetries uint) (uint64, error) {
	// Try the standard Status method first
	height, err := ExtractGRPCField(
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

	// If Status method fails, try GetLatestBlock as fallback
	if err != nil {
		height, err = ExtractGRPCField(
			gRPCClient,
			getLatestBlockMethod,
			maxRetries,
			"sdk_block.header.height",
			func(s string) (uint64, error) {
				height, err := strconv.ParseUint(s, 10, 64)
				if err != nil {
					return 0, errors.WithMessage(err, "error parsing height from GetLatestBlock")
				}
				return height, nil
			},
		)
	}

	return height, err
}
