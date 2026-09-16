package output

import (
	"context"

	"github.com/manifest-network/yaci/internal/models"
)

type OutputHandler interface {
	// WriteBlockWithTransactions writes a block and its transactions to the output.
	WriteBlockWithTransactions(ctx context.Context, block *models.Block, transactions []*models.Transaction) error

	// WriteBlockResults writes block results (finalize_block_events) to the output.
	// Block results contain consensus-level events like slashing, jailing, and validator updates.
	WriteBlockResults(ctx context.Context, blockResults *models.BlockResults) error

	// GetLatestBlock returns the latest block from the output.
	GetLatestBlock(ctx context.Context) (*models.Block, error)

	// GetEarliestBlock returns the earliest block from the output.
	GetEarliestBlock(ctx context.Context) (*models.Block, error)

	// GetMissingBlockIds returns the missing block IDs from the output.
	GetMissingBlockIds(ctx context.Context) ([]uint64, error)

	// Close closes the output handler.
	Close() error
}
