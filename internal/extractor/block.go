package extractor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"sync"

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
var lowestHeightRegex = regexp.MustCompile(`lowest height is (\d+)`)

// ErrHeightNotAvailable signals that a requested block has been pruned.
// It carries the lowest available height so the caller can restart extraction.
type ErrHeightNotAvailable struct {
	RequestedHeight uint64
	LowestHeight    uint64
}

func (e *ErrHeightNotAvailable) Error() string {
	return fmt.Sprintf("height %d is not available, lowest height is %d", e.RequestedHeight, e.LowestHeight)
}

// parseLowestHeight extracts the lowest available height from a pruned node error.
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

// prunedNodeSignal provides thread-safe signaling for pruned node detection
// without triggering errgroup's context cancellation.
type prunedNodeSignal struct {
	mu           sync.Mutex
	detected     bool
	lowestHeight uint64
	cancel       context.CancelFunc
}

func (p *prunedNodeSignal) signal(lowestHeight uint64) bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.detected {
		return false
	}
	p.detected = true
	p.lowestHeight = lowestHeight
	if p.cancel != nil {
		p.cancel()
	}
	return true
}

func (p *prunedNodeSignal) isDetected() bool {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.detected
}

func (p *prunedNodeSignal) getLowestHeight() uint64 {
	p.mu.Lock()
	defer p.mu.Unlock()
	return p.lowestHeight
}

// extractBlocksAndTransactions extracts blocks and transactions from the gRPC server.
// It automatically handles pruned nodes by detecting "lowest height" errors and
// restarting extraction from the lowest available height.
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
// It uses a separate signaling mechanism for pruned node detection to avoid
// errgroup's context cancellation race condition.
func processBlocks(gRPCClient *client.GRPCClient, start, stop uint64, outputHandler output.OutputHandler, maxConcurrency, maxRetries uint, bar *progressbar.ProgressBar) error {
	ctx, cancel := context.WithCancel(gRPCClient.Ctx)
	defer cancel()

	pruneSignal := &prunedNodeSignal{cancel: cancel}

	var eg errgroup.Group
	sem := make(chan struct{}, maxConcurrency)

	for height := start; height <= stop; height++ {
		if gRPCClient.Ctx.Err() != nil {
			slog.Info("Processing cancelled by user")
			return gRPCClient.Ctx.Err()
		}

		if pruneSignal.isDetected() {
			break
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

			if pruneSignal.isDetected() {
				return nil
			}

			err := processSingleBlockWithRetry(clientWithCtx, blockHeight, outputHandler, maxRetries)
			if err != nil {
				if pruneSignal.isDetected() && errors.Is(err, context.Canceled) {
					return nil
				}

				if errors.Is(err, context.Canceled) {
					return fmt.Errorf("failed to process block %d: %w", blockHeight, err)
				}

				if lowestHeight, ok := parseLowestHeight(err.Error()); ok {
					if pruneSignal.signal(lowestHeight) {
						slog.Warn("Pruned node detected - will restart from lowest available height",
							"requestedHeight", blockHeight,
							"lowestAvailable", lowestHeight)
					}
					return nil
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

	if pruneSignal.isDetected() {
		return &ErrHeightNotAvailable{
			LowestHeight: pruneSignal.getLowestHeight(),
		}
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
