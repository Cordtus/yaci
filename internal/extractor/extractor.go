package extractor

import (
	"fmt"
	"log/slog"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/config"
	"github.com/manifest-network/yaci/internal/output"
	"github.com/manifest-network/yaci/internal/utils"
)

const (
	blockMethodFullName = "cosmos.tx.v1beta1.Service.GetBlockWithTxs"
	txMethodFullName    = "cosmos.tx.v1beta1.Service.GetTx"
)

// Extract extracts blocks and transactions from a gRPC server.
func Extract(gRPCClient *client.GRPCClient, outputHandler output.OutputHandler, config config.ExtractConfig) error {
	// Check if the missing block check should be skipped before setting the block range
	skipMissingBlockCheck := shouldSkipMissingBlockCheck(config)

	if err := setBlockRange(gRPCClient, outputHandler, &config); err != nil {
		return err
	}

	if !skipMissingBlockCheck {
		if err := processMissingBlocks(gRPCClient, outputHandler, config); err != nil {
			return err
		}
	}

	if config.LiveMonitoring {
		slog.Info("Starting live extraction", "block_time", config.BlockTime)
		err := extractLiveBlocksAndTransactions(gRPCClient, config.BlockStart, outputHandler, config.BlockTime, config.MaxConcurrency, config.MaxRetries)
		if err != nil {
			return fmt.Errorf("failed to process live blocks and transactions: %w", err)
		}
	} else {
		// Batch extraction with pruned node recovery
		for {
			slog.Info("Starting extraction", "start", config.BlockStart, "stop", config.BlockStop)
			err := extractBlocksAndTransactions(gRPCClient, config.BlockStart, config.BlockStop, outputHandler, config.MaxConcurrency, config.MaxRetries)
			if err == nil {
				return nil
			}

			// Check if error is due to pruned node with higher boundary
			newStart, recoveryErr := validatePrunedNodeRecovery(err.Error(), config.BlockStart, config.BlockStop)
			if recoveryErr != nil {
				return recoveryErr
			}
			if newStart > 0 {
				slog.Warn("Adjusting start height due to pruned node",
					"original_start", config.BlockStart,
					"new_start", newStart,
					"skipped_blocks", newStart-config.BlockStart)
				config.BlockStart = newStart
				continue
			}

			return fmt.Errorf("failed to process blocks and transactions: %w", err)
		}
	}

	return nil
}

// setBlockRange sets the block range based on the configuration.
// If the start block is not set, it will be set to the latest block in the database + 1.
// If the database is empty, it queries the node for the earliest available block.
// If the stop block is not set, it will be set to the latest block on the node.
// Returns an error if the start block is greater than the stop block.
func setBlockRange(gRPCClient *client.GRPCClient, outputHandler output.OutputHandler, cfg *config.ExtractConfig) error {
	if cfg.ReIndex {
		slog.Info("Reindexing entire database...")
		earliestLocalBlock, err := outputHandler.GetEarliestBlock(gRPCClient.Ctx)
		if err != nil {
			return fmt.Errorf("failed to get the earliest local block: %w", err)
		}
		if earliestLocalBlock != nil {
			cfg.BlockStart = earliestLocalBlock.ID
		} else {
			// Fresh DB with reindex - probe for earliest available
			earliestAvailable, err := utils.GetEarliestBlockHeight(gRPCClient, cfg.MaxRetries)
			if err != nil {
				return fmt.Errorf("failed to determine earliest available block: %w", err)
			}
			cfg.BlockStart = earliestAvailable
		}
		cfg.BlockStop = 0
	}

	if cfg.BlockStart == 0 {
		latestLocalBlock, err := outputHandler.GetLatestBlock(gRPCClient.Ctx)
		if err != nil {
			return fmt.Errorf("failed to get the latest block: %w", err)
		}
		if latestLocalBlock != nil {
			// Resume from existing DB - no probe needed
			cfg.BlockStart = latestLocalBlock.ID + 1
		} else {
			// Fresh DB - probe to find earliest available block on node
			earliestAvailable, err := utils.GetEarliestBlockHeight(gRPCClient, cfg.MaxRetries)
			if err != nil {
				return fmt.Errorf("failed to determine earliest available block: %w", err)
			}
			cfg.BlockStart = earliestAvailable
		}
	}

	if cfg.BlockStop == 0 {
		latestRemoteBlock, err := utils.GetLatestBlockHeightWithRetry(gRPCClient, cfg.MaxRetries)
		if err != nil {
			return fmt.Errorf("failed to get the latest block: %w", err)
		}
		cfg.BlockStop = latestRemoteBlock
	}

	if cfg.BlockStart > cfg.BlockStop {
		return fmt.Errorf("start block is greater than stop block")
	}

	return nil
}

// shouldSkipMissingBlockCheck returns true if the missing block check should be skipped.
func shouldSkipMissingBlockCheck(cfg config.ExtractConfig) bool {
	return (cfg.BlockStart != 0 && cfg.BlockStop != 0) || cfg.ReIndex
}

// validatePrunedNodeRecovery checks if recovery from a pruned node error is possible.
// It returns the new start height if recovery is valid, 0 if the error is not a pruned node error,
// or an error if the pruned node boundary exceeds the stop block.
func validatePrunedNodeRecovery(errMsg string, currentStart, blockStop uint64) (uint64, error) {
	newStart := utils.ParseLowestHeightFromError(errMsg)
	if newStart <= currentStart {
		return 0, nil // Not a pruned node error we can recover from
	}
	if newStart > blockStop {
		return 0, fmt.Errorf("pruned node boundary (%d) exceeds requested stop block (%d): requested range [%d-%d] is unavailable",
			newStart, blockStop, currentStart, blockStop)
	}
	return newStart, nil
}
