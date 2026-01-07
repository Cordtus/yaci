package extractor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/config"
	"github.com/manifest-network/yaci/internal/models"
	"github.com/manifest-network/yaci/internal/output"
	"github.com/manifest-network/yaci/internal/utils"
	"github.com/schollz/progressbar/v3"
	"golang.org/x/sync/errgroup"
)

// lowestHeightRegex matches pruned node error messages from CosmosSDK nodes.
// Example: "height 60 is not available, lowest height is 28566001"
// This pattern is used to detect when extraction starts below the pruning boundary.
var lowestHeightRegex = regexp.MustCompile(`lowest height is (\d+)`)

// ErrHeightNotAvailable signals that a requested block has been pruned.
// It carries the lowest available height so the caller can restart extraction
// from a valid block without user intervention.
type ErrHeightNotAvailable struct {
	RequestedHeight uint64
	LowestHeight    uint64
}

func (e *ErrHeightNotAvailable) Error() string {
	return fmt.Sprintf("height %d is not available, lowest height is %d", e.RequestedHeight, e.LowestHeight)
}

// parseLowestHeight extracts the lowest available height from a pruned node error.
// Returns (height, true) if found, (0, false) otherwise.
func parseLowestHeight(errMsg string) (uint64, bool) {
	matches := lowestHeightRegex.FindStringSubmatch(errMsg)
	if len(matches) < 2 {
		return 0, false
	}
	height, err := strconv.ParseUint(matches[1], 10, 64)
	if err != nil {
		return 0, false
	}
	return height, true
}

// extractBlocksAndTransactions extracts blocks and transactions from the gRPC server.
//
// Pruned Node Handling:
// When the starting height is below the node's pruning boundary, the gRPC call
// returns an error like "height X is not available, lowest height is Y". Rather
// than failing, we parse this error to extract Y and restart extraction from
// that height. This loop continues until we either complete successfully or hit
// a non-recoverable error.
//
// This approach handles:
// - Initial misconfiguration where user specifies too-low start height
// - Mid-extraction discovery that early blocks were pruned during indexing
// - Nodes with aggressive pruning where --start=1 is common but invalid
func extractBlocksAndTransactions(gRPCClient *client.GRPCClient, start, stop uint64, outputHandler output.OutputHandler, maxConcurrency, maxRetries uint) error {
	currentStart := start

	for {
		displayProgress := currentStart != stop
		if displayProgress {
			slog.Info("Extracting blocks and transactions", "range", fmt.Sprintf("[%d, %d]", currentStart, stop))
		} else {
			slog.Info("Extracting blocks and transactions", "height", currentStart)
		}

		var bar *progressbar.ProgressBar
		if displayProgress {
			bar = progressbar.NewOptions64(
				int64(stop-currentStart+1),
				progressbar.OptionClearOnFinish(),
				progressbar.OptionSetDescription("Processing blocks..."),
				progressbar.OptionShowCount(),
				progressbar.OptionShowIts(),
				progressbar.OptionSetTheme(progressbar.Theme{
					Saucer:        "=",
					SaucerHead:    ">",
					SaucerPadding: " ",
					BarStart:      "[",
					BarEnd:        "]",
				}),
			)
			if err := bar.RenderBlank(); err != nil {
				return fmt.Errorf("failed to render progress bar: %w", err)
			}
		}

		err := processBlocks(gRPCClient, currentStart, stop, outputHandler, maxConcurrency, maxRetries, bar)
		if err != nil {
			// Check if we got a height not available error
			var heightErr *ErrHeightNotAvailable
			if errors.As(err, &heightErr) {
				slog.Info("Restarting extraction from lowest available height",
					"previousStart", currentStart,
					"newStart", heightErr.LowestHeight,
					"blocksSkipped", heightErr.LowestHeight-currentStart)
				currentStart = heightErr.LowestHeight
				continue
			}
			return fmt.Errorf("failed to process blocks and transactions: %w", err)
		}

		if bar != nil {
			if err := bar.Finish(); err != nil {
				return fmt.Errorf("failed to finish progress bar: %w", err)
			}
		}

		return nil
	}
}

// processMissingBlocks processes missing blocks by fetching them from the gRPC server.
func processMissingBlocks(gRPCClient *client.GRPCClient, outputHandler output.OutputHandler, cfg config.ExtractConfig) error {
	missingBlockIds, err := outputHandler.GetMissingBlockIds(gRPCClient.Ctx)
	if err != nil {
		return fmt.Errorf("failed to get missing block IDs: %w", err)
	}

	if len(missingBlockIds) > 0 {
		slog.Warn("Missing blocks detected", "count", len(missingBlockIds))
		for _, blockID := range missingBlockIds {
			if err := processSingleBlockWithRetry(gRPCClient, blockID, outputHandler, cfg.MaxRetries); err != nil {
				return fmt.Errorf("failed to process missing block %d: %w", blockID, err)
			}
		}
	}
	return nil
}

// processBlocks processes blocks in parallel using goroutines.
func processBlocks(gRPCClient *client.GRPCClient, start, stop uint64, outputHandler output.OutputHandler, maxConcurrency, maxRetries uint, bar *progressbar.ProgressBar) error {
	eg, ctx := errgroup.WithContext(gRPCClient.Ctx)
	sem := make(chan struct{}, maxConcurrency)

	for height := start; height <= stop; height++ {
		if ctx.Err() != nil {
			slog.Info("Processing cancelled by user")
			return ctx.Err()
		}

		blockHeight := height
		sem <- struct{}{}

		clientWithCtx := &client.GRPCClient{
			Conn:     gRPCClient.Conn,
			Ctx:      ctx,
			Resolver: gRPCClient.Resolver,
		}

		eg.Go(func() error {
			defer func() { <-sem }()

			err := processSingleBlockWithRetry(clientWithCtx, blockHeight, outputHandler, maxRetries)
			if err != nil {
				// User cancellation takes precedence
				if errors.Is(err, context.Canceled) {
					slog.Error("Failed to process block", "height", blockHeight, "error", err, "retries", maxRetries)
					return fmt.Errorf("failed to process block %d: %w", blockHeight, err)
				}

				// Pruned node detection: when concurrent workers hit pruned blocks,
				// propagate ErrHeightNotAvailable to trigger restart from valid height
				if lowestHeight, ok := parseLowestHeight(err.Error()); ok {
					slog.Warn("Pruned node detected - adjusting start height",
						"requestedHeight", blockHeight,
						"lowestAvailable", lowestHeight,
						"note", "Blocks before this height are not available on this endpoint and cannot be indexed")
					return &ErrHeightNotAvailable{
						RequestedHeight: blockHeight,
						LowestHeight:    lowestHeight,
					}
				}

				slog.Error("Block processing error",
					"height", blockHeight,
					"error", err,
					"errorType", fmt.Sprintf("%T", err))
				return err
			}

			if bar != nil {
				if err := bar.Add(1); err != nil {
					slog.Warn("Failed to update progress bar", "error", err)
				}
			}

			return nil
		})
	}

	if err := eg.Wait(); err != nil {
		return fmt.Errorf("error while fetching blocks: %w", err)
	}
	return nil
}

// processSingleBlockWithRetry fetches a block and its transactions from the gRPC server with retries.
// It unmarshals the block data and writes it to the output handler.
func processSingleBlockWithRetry(gRPCClient *client.GRPCClient, blockHeight uint64, outputHandler output.OutputHandler, maxRetries uint) error {
	blockJsonParams := []byte(fmt.Sprintf(`{"height": %d}`, blockHeight))

	// Get block data with retries
	blockJsonBytes, err := utils.GetGRPCResponse(
		gRPCClient,
		blockMethodFullName,
		maxRetries,
		blockJsonParams,
	)
	if err != nil {
		return fmt.Errorf("failed to get block data: %w", err)
	}

	// Create block model
	block := &models.Block{
		ID:   blockHeight,
		Data: blockJsonBytes,
	}

	var data map[string]interface{}
	if err := json.Unmarshal(blockJsonBytes, &data); err != nil {
		return fmt.Errorf("failed to unmarshal block JSON: %w", err)
	}

	transactions, err := extractTransactions(gRPCClient, data, maxRetries)
	if err != nil {
		return fmt.Errorf("failed to extract transactions from block: %w", err)
	}

	// Write block with transactions to the output handler
	err = outputHandler.WriteBlockWithTransactions(gRPCClient.Ctx, block, transactions)
	if err != nil {
		return fmt.Errorf("failed to write block with transactions: %w", err)
	}

	return nil
}
