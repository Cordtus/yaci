package extractor

import (
	"fmt"
	"time"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/config"
	"github.com/manifest-network/yaci/internal/output"
	"github.com/manifest-network/yaci/internal/utils"
)

// extractLiveBlocksAndTransactions monitors the chain and processes new blocks as they are produced.
func extractLiveBlocksAndTransactions(gRPCClient *client.GRPCClient, start uint64, outputHandler output.OutputHandler, cfg config.ExtractConfig) error {
	currentHeight := start - 1
	for {
		select {
		case <-gRPCClient.Ctx.Done():
			return nil
		default:
			// Get the latest block height
			latestHeight, err := utils.GetLatestBlockHeightWithRetry(gRPCClient, cfg.MaxRetries)
			if err != nil {
				return fmt.Errorf("failed to get latest block height: %w", err)
			}

			if latestHeight > currentHeight {
				err = extractBlocksAndTransactions(gRPCClient, currentHeight+1, latestHeight, outputHandler, cfg)
				if err != nil {
					return fmt.Errorf("failed to process blocks and transactions: %w", err)
				}
				currentHeight = latestHeight
			}

			// Sleep before checking again
			time.Sleep(time.Duration(cfg.BlockTime) * time.Second)
		}
	}
}
