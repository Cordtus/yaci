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

		// Handle transaction fetch failures gracefully
		if err != nil {
			// Create minimal transaction record with error metadata
			errorJSON := []byte(fmt.Sprintf(`{"error": "failed to fetch transaction details", "hash": "%s", "reason": %q}`, hashStr, err.Error()))
			transaction := &models.Transaction{
				Hash: hashStr,
				Data: errorJSON,
			}
			transactions = append(transactions, transaction)

			// Log warning for monitoring and debugging
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
