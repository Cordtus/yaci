package extractor

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log/slog"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/models"
	"github.com/manifest-network/yaci/internal/utils"
)

func extractTransactions(gRPCClient *client.GRPCClient, data map[string]interface{}, maxRetries uint) ([]*models.Transaction, error) {
	blockData, exists := data["block"].(map[string]interface{})
	if !exists || blockData == nil {
		return nil, nil
	}

	dataField, exists := blockData["data"].(map[string]interface{})
	if !exists || dataField == nil {
		return nil, nil
	}

	txs, exists := dataField["txs"].([]interface{})
	if !exists {
		return nil, nil
	}

	var transactions []*models.Transaction
	for _, tx := range txs {
		txStr, ok := tx.(string)
		if !ok {
			continue
		}
		decodedBytes, err := base64.StdEncoding.DecodeString(txStr)
		if err != nil {
			return nil, fmt.Errorf("failed to decode tx: %w", err)
		}
		hash := sha256.Sum256(decodedBytes)
		hashStr := hex.EncodeToString(hash[:])

		txJsonParams := []byte(fmt.Sprintf(`{"hash": "%s"}`, hashStr))
		txJsonBytes, err := utils.GetGRPCResponse(
			gRPCClient,
			txMethodFullName,
			maxRetries,
			txJsonParams,
		)

		// Graceful degradation: store error metadata instead of failing the entire block.
		// This handles edge cases discovered in production:
		// - Oversized transactions exceeding max gRPC message size (seen on Mantrachain)
		// - Transient RPC failures for individual transactions
		// - Malformed transaction data on certain chains
		// The block is still recorded, and downstream consumers can identify failed
		// transactions by checking for the "error" field in the JSON data.
		if err != nil {
			errorJSON := []byte(fmt.Sprintf(`{"error": "failed to fetch transaction details", "hash": "%s", "reason": %q}`, hashStr, err.Error()))
			transaction := &models.Transaction{
				Hash: hashStr,
				Data: errorJSON,
			}
			transactions = append(transactions, transaction)

			slog.Warn("Failed to fetch transaction details, storing with error metadata",
				"hash", hashStr,
				"error", err)
			continue
		}

		transaction := &models.Transaction{
			Hash: hashStr,
			Data: txJsonBytes,
		}

		transactions = append(transactions, transaction)
	}

	return transactions, nil
}
