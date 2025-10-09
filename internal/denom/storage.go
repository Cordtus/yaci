package denom

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"
)

// Storage handles PostgreSQL persistence of denom metadata
type Storage struct {
	db *sql.DB
}

// NewStorage creates a new denom storage handler
func NewStorage(db *sql.DB) *Storage {
	return &Storage{db: db}
}

// StoreDenomMetadata inserts or updates denom metadata in the database
func (s *Storage) StoreDenomMetadata(ctx context.Context, metadata *Metadata) error {
	query := `
		INSERT INTO api.denom_metadata (
			denom,
			base_denom,
			display_name,
			symbol,
			decimals,
			is_ibc,
			ibc_hash,
			ibc_path,
			chain_id,
			last_updated
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		ON CONFLICT (denom) DO UPDATE SET
			base_denom = EXCLUDED.base_denom,
			display_name = EXCLUDED.display_name,
			symbol = EXCLUDED.symbol,
			decimals = EXCLUDED.decimals,
			ibc_path = EXCLUDED.ibc_path,
			chain_id = EXCLUDED.chain_id,
			last_updated = EXCLUDED.last_updated
	`

	_, err := s.db.ExecContext(ctx, query,
		metadata.Denom,
		nullString(metadata.BaseDenom),
		metadata.DisplayName,
		metadata.Symbol,
		metadata.Decimals,
		metadata.IsIBC,
		nullString(metadata.IBCHash),
		nullString(metadata.IBCPath),
		nullString(metadata.ChainID),
		time.Now(),
	)

	if err != nil {
		return fmt.Errorf("failed to store denom metadata: %w", err)
	}

	slog.Debug("Stored denom metadata",
		"denom", metadata.Denom,
		"symbol", metadata.Symbol,
		"is_ibc", metadata.IsIBC)

	return nil
}

// GetDenomMetadata retrieves denom metadata from the database
func (s *Storage) GetDenomMetadata(ctx context.Context, denom string) (*Metadata, error) {
	query := `
		SELECT
			denom,
			base_denom,
			display_name,
			symbol,
			decimals,
			is_ibc,
			ibc_hash,
			ibc_path,
			chain_id
		FROM api.denom_metadata
		WHERE denom = $1
	`

	var metadata Metadata
	var baseDenom, ibcHash, ibcPath, chainID sql.NullString

	err := s.db.QueryRowContext(ctx, query, denom).Scan(
		&metadata.Denom,
		&baseDenom,
		&metadata.DisplayName,
		&metadata.Symbol,
		&metadata.Decimals,
		&metadata.IsIBC,
		&ibcHash,
		&ibcPath,
		&chainID,
	)

	if err == sql.ErrNoRows {
		return nil, nil // Not found, not an error
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get denom metadata: %w", err)
	}

	metadata.BaseDenom = baseDenom.String
	metadata.IBCHash = ibcHash.String
	metadata.IBCPath = ibcPath.String
	metadata.ChainID = chainID.String

	return &metadata, nil
}

// GetDenomMetadataByIBCHash retrieves denom metadata by IBC hash
func (s *Storage) GetDenomMetadataByIBCHash(ctx context.Context, hash string) (*Metadata, error) {
	query := `
		SELECT
			denom,
			base_denom,
			display_name,
			symbol,
			decimals,
			is_ibc,
			ibc_hash,
			ibc_path,
			chain_id
		FROM api.denom_metadata
		WHERE ibc_hash = $1
	`

	var metadata Metadata
	var baseDenom, ibcHash, ibcPath, chainID sql.NullString

	err := s.db.QueryRowContext(ctx, query, hash).Scan(
		&metadata.Denom,
		&baseDenom,
		&metadata.DisplayName,
		&metadata.Symbol,
		&metadata.Decimals,
		&metadata.IsIBC,
		&ibcHash,
		&ibcPath,
		&chainID,
	)

	if err == sql.ErrNoRows {
		return nil, nil
	}

	if err != nil {
		return nil, fmt.Errorf("failed to get denom metadata by hash: %w", err)
	}

	metadata.BaseDenom = baseDenom.String
	metadata.IBCHash = ibcHash.String
	metadata.IBCPath = ibcPath.String
	metadata.ChainID = chainID.String

	return &metadata, nil
}

// nullString converts an empty string to sql.NullString
func nullString(s string) sql.NullString {
	if s == "" {
		return sql.NullString{Valid: false}
	}
	return sql.NullString{String: s, Valid: true}
}
