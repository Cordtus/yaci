package extractor

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/config"
	"github.com/manifest-network/yaci/internal/models"
	"github.com/manifest-network/yaci/internal/output"
	"github.com/manifest-network/yaci/internal/utils"
	"github.com/schollz/progressbar/v3"
	"golang.org/x/sync/errgroup"
)

// extractBlocksAndTransactions extracts blocks and transactions from the gRPC server.
func extractBlocksAndTransactions(gRPCClient *client.GRPCClient, start, stop uint64, outputHandler output.OutputHandler, cfg config.ExtractConfig) error {
	displayProgress := start != stop
	if displayProgress {
		slog.Info("Extracting blocks and transactions", "range", fmt.Sprintf("[%d, %d]", start, stop))
	} else {
		slog.Info("Extracting blocks and transactions", "height", start)
	}

	var bar *progressbar.ProgressBar
	if displayProgress {
		bar = progressbar.NewOptions64(
			int64(stop-start+1),
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

	if err := processBlocks(gRPCClient, start, stop, outputHandler, cfg, bar); err != nil {
		return fmt.Errorf("failed to process blocks and transactions: %w", err)
	}

	if bar != nil {
		if err := bar.Finish(); err != nil {
			return fmt.Errorf("failed to finish progress bar: %w", err)
		}
	}

	return nil
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
			var processErr error
			if cfg.EnableBlockResults {
				processErr = processSingleBlockWithResultsAndRetry(gRPCClient, blockID, outputHandler, cfg.MaxRetries)
			} else {
				processErr = processSingleBlockWithRetry(gRPCClient, blockID, outputHandler, cfg.MaxRetries)
			}
			if processErr != nil {
				return fmt.Errorf("failed to process missing block %d: %w", blockID, processErr)
			}
		}
	}
	return nil
}

// processBlocks processes blocks in parallel using goroutines.
func processBlocks(gRPCClient *client.GRPCClient, start, stop uint64, outputHandler output.OutputHandler, cfg config.ExtractConfig, bar *progressbar.ProgressBar) error {
	eg, ctx := errgroup.WithContext(gRPCClient.Ctx)
	sem := make(chan struct{}, cfg.MaxConcurrency)

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

			var err error
			if cfg.EnableBlockResults {
				// Fetch blocks, transactions, AND block results (finalize_block_events)
				err = processSingleBlockWithResultsAndRetry(clientWithCtx, blockHeight, outputHandler, cfg.MaxRetries)
			} else {
				// Standard extraction: blocks and transactions only
				err = processSingleBlockWithRetry(clientWithCtx, blockHeight, outputHandler, cfg.MaxRetries)
			}

			if err != nil {
				if errors.Is(err, context.Canceled) {
					return fmt.Errorf("failed to process block %d: %w", blockHeight, err)
				}

				slog.Error("Block processing error",
					"height", blockHeight,
					"error", err,
					"errorType", fmt.Sprintf("%T", err),
					"retries", cfg.MaxRetries)
				return fmt.Errorf("failed to process block %d: %w", blockHeight, err)
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

// fetchBlockResults fetches block results (finalize_block_events) from the gRPC server.
// This requires republicd with the GetBlockResults gRPC endpoint (cosmos-sdk feat/grpc-block-results-main).
// Block results contain consensus-level events: slashing, jailing, validator updates.
func fetchBlockResults(gRPCClient *client.GRPCClient, blockHeight uint64, maxRetries uint) (*models.BlockResults, error) {
	blockResultsParams := []byte(fmt.Sprintf(`{"height": %d}`, blockHeight))

	blockResultsBytes, err := utils.GetGRPCResponse(
		gRPCClient,
		blockResultsMethodFullName,
		maxRetries,
		blockResultsParams,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get block results: %w", err)
	}

	return &models.BlockResults{
		Height: blockHeight,
		Data:   blockResultsBytes,
	}, nil
}

// processSingleBlockWithResultsAndRetry fetches a block, its transactions, and block results.
// Block results are fetched via the GetBlockResults gRPC endpoint which provides
// finalize_block_events (slashing, jailing, validator updates).
func processSingleBlockWithResultsAndRetry(gRPCClient *client.GRPCClient, blockHeight uint64, outputHandler output.OutputHandler, maxRetries uint) error {
	// First, process the block and transactions normally
	if err := processSingleBlockWithRetry(gRPCClient, blockHeight, outputHandler, maxRetries); err != nil {
		return err
	}

	// Then fetch and write block results
	blockResults, err := fetchBlockResults(gRPCClient, blockHeight, maxRetries)
	if err != nil {
		// Log warning but don't fail - node might not support GetBlockResults
		slog.Warn("Failed to fetch block results (node may not support GetBlockResults)", "height", blockHeight, "error", err)
		return nil
	}

	if err := outputHandler.WriteBlockResults(gRPCClient.Ctx, blockResults); err != nil {
		return fmt.Errorf("failed to write block results: %w", err)
	}

	return nil
}
