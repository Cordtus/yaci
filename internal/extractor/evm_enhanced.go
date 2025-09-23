package extractor

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"log/slog"
	"time"

	"github.com/manifest-network/yaci/internal/client"
	"github.com/manifest-network/yaci/internal/evm"
	"github.com/manifest-network/yaci/internal/models"
	"github.com/manifest-network/yaci/internal/utils"
)

// enhancedTransactionExtractor handles both cosmos and EVM transaction extraction
type enhancedTransactionExtractor struct {
	evmExtractor *evm.EVMTransactionExtractor
}

// newEnhancedTransactionExtractor creates a new enhanced transaction extractor
func newEnhancedTransactionExtractor() *enhancedTransactionExtractor {
	return &enhancedTransactionExtractor{
		evmExtractor: evm.NewEVMTransactionExtractor(),
	}
}

// extractTransactionsEnhanced extracts transactions with EVM processing capabilities
func extractTransactionsEnhanced(
	gRPCClient *client.GRPCClient, 
	data map[string]interface{}, 
	maxRetries uint,
) ([]*evm.EnhancedTransaction, error) {
	
	extractor := newEnhancedTransactionExtractor()
	
	// Extract block metadata
	blockInfo, err := extractor.extractBlockInfo(data)
	if err != nil {
		return nil, fmt.Errorf("failed to extract block info: %w", err)
	}
	
	slog.Debug("Extracting transactions from block", 
		"block_number", blockInfo.Number,
		"block_hash", blockInfo.Hash)
	
	// Get raw transaction data from block
	txs, err := extractor.getRawTransactions(data)
	if err != nil {
		return nil, err
	}
	
	if len(txs) == 0 {
		return []*evm.EnhancedTransaction{}, nil
	}
	
	// Process each transaction
	var enhancedTransactions []*evm.EnhancedTransaction
	for i, txStr := range txs {
		// Decode transaction hash
		decodedBytes, err := base64.StdEncoding.DecodeString(txStr)
		if err != nil {
			slog.Error("Failed to decode transaction", "index", i, "error", err)
			continue
		}
		
		hash := sha256.Sum256(decodedBytes)
		hashStr := hex.EncodeToString(hash[:])
		
		// Get full transaction data via gRPC
		txData, err := extractor.getTransactionData(gRPCClient, hashStr, maxRetries)
		if err != nil {
			slog.Error("Failed to get transaction data", "hash", hashStr, "error", err)
			continue
		}
		
		// Create base transaction model
		baseTx := &models.Transaction{
			Hash: hashStr,
			Data: txData,
		}
		
		// Process with EVM extractor (handles both cosmos and EVM transactions)
		enhancedTx, err := extractor.evmExtractor.ProcessTransactionWithEVM(
			baseTx,
			blockInfo.Number,
			blockInfo.Hash,
			uint32(i),
			blockInfo.Timestamp,
		)
		if err != nil {
			slog.Error("Failed to process transaction with EVM extractor", 
				"hash", hashStr, "error", err)
			continue
		}
		
		enhancedTransactions = append(enhancedTransactions, enhancedTx)
	}
	
	// Log summary
	summary := extractor.evmExtractor.GetEVMTransactionSummary(enhancedTransactions)
	slog.Info("Processed transactions", 
		"block", blockInfo.Number,
		"total", summary.TotalTransactions,
		"evm", summary.EVMTransactions,
		"cosmos", summary.CosmosTransactions,
		"decoded", summary.DecodedTransactions)
	
	return enhancedTransactions, nil
}

// BlockInfo contains metadata about the block being processed
type BlockInfo struct {
	Number    uint64
	Hash      string
	Timestamp time.Time
}

// extractBlockInfo gets block metadata from the block data
func (e *enhancedTransactionExtractor) extractBlockInfo(data map[string]interface{}) (*BlockInfo, error) {
	blockData, exists := data["block"].(map[string]interface{})
	if !exists || blockData == nil {
		return nil, fmt.Errorf("block data not found")
	}
	
	header, exists := blockData["header"].(map[string]interface{})
	if !exists {
		return nil, fmt.Errorf("block header not found")
	}
	
	blockInfo := &BlockInfo{}
	
	// Extract block number
	if heightStr, ok := header["height"].(string); ok {
		var height uint64
		fmt.Sscanf(heightStr, "%d", &height)
		blockInfo.Number = height
	}
	
	// Extract block hash (from block ID)
	if blockID, ok := data["block_id"].(map[string]interface{}); ok {
		if hash, ok := blockID["hash"].(string); ok {
			blockInfo.Hash = hash
		}
	}
	
	// Extract timestamp
	if timeStr, ok := header["time"].(string); ok {
		if timestamp, err := time.Parse(time.RFC3339, timeStr); err == nil {
			blockInfo.Timestamp = timestamp
		} else {
			blockInfo.Timestamp = time.Now()
		}
	} else {
		blockInfo.Timestamp = time.Now()
	}
	
	return blockInfo, nil
}

// getRawTransactions extracts the raw transaction data from block
func (e *enhancedTransactionExtractor) getRawTransactions(data map[string]interface{}) ([]string, error) {
	blockData, exists := data["block"].(map[string]interface{})
	if !exists || blockData == nil {
		return nil, fmt.Errorf("block data not found")
	}
	
	dataField, exists := blockData["data"].(map[string]interface{})
	if !exists || dataField == nil {
		return []string{}, nil // Empty block is valid
	}
	
	txs, exists := dataField["txs"].([]interface{})
	if !exists {
		return []string{}, nil
	}
	
	var rawTxs []string
	for _, tx := range txs {
		if txStr, ok := tx.(string); ok {
			rawTxs = append(rawTxs, txStr)
		}
	}
	
	return rawTxs, nil
}

// getTransactionData retrieves full transaction data via gRPC
func (e *enhancedTransactionExtractor) getTransactionData(
	gRPCClient *client.GRPCClient, 
	hash string, 
	maxRetries uint,
) ([]byte, error) {
	
	txJsonParams := []byte(fmt.Sprintf(`{"hash": "%s"}`, hash))
	
	txJsonBytes, err := utils.GetGRPCResponse(
		gRPCClient,
		txMethodFullName,
		maxRetries,
		txJsonParams,
	)
	if err != nil {
		return nil, fmt.Errorf("failed to get transaction via gRPC: %w", err)
	}
	
	return txJsonBytes, nil
}

// Alternative entry point that integrates with existing extractor
func extractTransactionsWithEVM(
	gRPCClient *client.GRPCClient, 
	data map[string]interface{}, 
	maxRetries uint,
) ([]*models.Transaction, []*evm.EnhancedTransaction, error) {
	
	// First, extract using the existing method to maintain compatibility
	basicTransactions, err := ExtractTransactions(gRPCClient, data, maxRetries)
	if err != nil {
		return nil, nil, err
	}
	
	// Then, extract with EVM enhancement
	enhancedTransactions, err := extractTransactionsEnhanced(gRPCClient, data, maxRetries)
	if err != nil {
		// If EVM processing fails, still return basic transactions
		slog.Error("EVM enhancement failed, returning basic transactions", "error", err)
		return basicTransactions, nil, nil
	}
	
	// Log EVM processing stats
	stats := getEVMTransactionStats(enhancedTransactions)
	slog.Debug("EVM transaction processing complete", "stats", stats)
	
	return basicTransactions, enhancedTransactions, nil
}

// getEVMTransactionStats provides statistics about EVM transactions in a block
func getEVMTransactionStats(enhanced []*evm.EnhancedTransaction) map[string]interface{} {
	if len(enhanced) == 0 {
		return map[string]interface{}{
			"total_transactions": 0,
			"evm_transactions": 0,
		}
	}
	
	// Create a simple stats function
	
	stats := map[string]interface{}{
		"total_transactions": len(enhanced),
		"evm_transactions": 0,
		"cosmos_transactions": 0,
		"contract_creations": 0,
		"decoded_transactions": 0,
		"total_logs": 0,
		"token_transfers": 0,
	}
	
	for _, tx := range enhanced {
		if tx.IsEVM {
			stats["evm_transactions"] = stats["evm_transactions"].(int) + 1
			
			if tx.EVMTransactionData != nil {
				if tx.EVMTransactionData.Transaction.CreatedContract != "" {
					stats["contract_creations"] = stats["contract_creations"].(int) + 1
				}
				
				stats["total_logs"] = stats["total_logs"].(int) + len(tx.EVMTransactionData.Logs)
				stats["token_transfers"] = stats["token_transfers"].(int) + len(tx.EVMTransactionData.TokenTransfers)
				
				if tx.DecodingStatus != nil && tx.DecodingStatus.HasDecodedInput {
					stats["decoded_transactions"] = stats["decoded_transactions"].(int) + 1
				}
			}
		} else {
			stats["cosmos_transactions"] = stats["cosmos_transactions"].(int) + 1
		}
	}
	
	return stats
}

// Helper function to pretty print EVM transaction for debugging
func debugEVMTransaction(tx *evm.EnhancedTransaction) {
	if !tx.IsEVM || tx.EVMTransactionData == nil {
		return
	}
	
	evmTx := tx.EVMTransactionData.Transaction
	slog.Debug("EVM Transaction Debug",
		"hash", evmTx.Hash,
		"from", evmTx.From,
		"to", evmTx.To,
		"value", evmTx.Value,
		"type", evmTx.Type,
		"gas", evmTx.Gas,
		"gas_used", evmTx.GasUsed,
		"status", evmTx.Status,
		"logs_count", len(tx.EVMTransactionData.Logs),
		"token_transfers", len(tx.EVMTransactionData.TokenTransfers),
		"has_decoded_input", evmTx.DecodedInput != nil,
	)
	
	// Log method call info if available
	if evmTx.MethodCall != nil {
		slog.Debug("Method Call", 
			"method", evmTx.MethodCall.Name,
			"signature", evmTx.MethodCall.Signature,
			"params_count", len(evmTx.MethodCall.Inputs))
	}
	
	// Log token transfers
	for i, transfer := range tx.EVMTransactionData.TokenTransfers {
		slog.Debug("Token Transfer",
			"index", i,
			"token", transfer.TokenAddress,
			"from", transfer.From,
			"to", transfer.To,
			"amount", transfer.Amount,
			"symbol", transfer.TokenSymbol)
	}
}