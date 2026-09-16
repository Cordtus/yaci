package models

// Block represents a blockchain block.
type Block struct {
	ID   uint64
	Data []byte
}

// Transaction represents a blockchain transaction.
type Transaction struct {
	Hash string
	Data []byte
}

// BlockResults represents the results of block finalization.
// Contains finalize_block_events (slashing, jailing, validator updates),
// transaction results, and validator updates.
type BlockResults struct {
	Height uint64
	Data   []byte
}
