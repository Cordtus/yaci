package evm

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/manifest-network/yaci/internal/models"
)

// EVMTransactionExtractor integrates EVM parsing with existing yaci transaction processing
type EVMTransactionExtractor struct {
	parser    *EVMParser
	processor *BlockscoutProcessor
}

// NewEVMTransactionExtractor creates a new EVM transaction extractor
func NewEVMTransactionExtractor() *EVMTransactionExtractor {
	return &EVMTransactionExtractor{
		parser:    NewEVMParser(),
		processor: NewBlockscoutProcessor(),
	}
}

// EnhancedTransaction represents the enhanced transaction model with EVM data
type EnhancedTransaction struct {
	*models.Transaction
	
	// EVM-specific fields
	IsEVM               bool                       `json:"is_evm" db:"is_evm"`
	EVMTransactionData  *BlockscoutTransactionView `json:"evm_data,omitempty"`
	DecodingStatus      *DecodingStatus            `json:"decoding_status,omitempty"`
}

// ProcessTransactionWithEVM processes a transaction and extracts EVM data if present
func (e *EVMTransactionExtractor) ProcessTransactionWithEVM(
	tx *models.Transaction,
	blockNumber uint64,
	blockHash string,
	txIndex uint32,
	timestamp time.Time,
) (*EnhancedTransaction, error) {
	
	enhanced := &EnhancedTransaction{
		Transaction: tx,
		IsEVM:      false,
	}
	
	// Parse transaction data to check for EVM messages
	var txData map[string]interface{}
	if err := json.Unmarshal(tx.Data, &txData); err != nil {
		slog.Debug("Failed to parse transaction data", "hash", tx.Hash, "error", err)
		return enhanced, nil
	}
	
	// Check if transaction contains EVM messages
	evmTx, hasEVM := e.extractEVMTransaction(txData)
	if !hasEVM {
		return enhanced, nil
	}
	
	// Mark as EVM transaction
	enhanced.IsEVM = true
	
	// Process the EVM transaction into Blockscout format
	blockscoutView, err := e.processor.ProcessTransaction(evmTx, blockNumber, blockHash, txIndex, timestamp)
	if err != nil {
		slog.Error("Failed to process EVM transaction", "hash", tx.Hash, "error", err)
		return enhanced, err
	}
	
	enhanced.EVMTransactionData = blockscoutView
	enhanced.DecodingStatus = e.getDecodingStatus(blockscoutView)
	
	slog.Debug("Processed EVM transaction", 
		"hash", tx.Hash,
		"from", evmTx.From,
		"to", evmTx.To,
		"value", evmTx.Value,
		"logs_count", len(evmTx.Logs))
	
	return enhanced, nil
}

// extractEVMTransaction looks for MsgEthereumTx in the cosmos transaction
func (e *EVMTransactionExtractor) extractEVMTransaction(txData map[string]interface{}) (*EVMTransactionData, bool) {
	// Look for transaction body
	body, ok := txData["body"].(map[string]interface{})
	if !ok {
		return nil, false
	}
	
	// Look for messages array
	messages, ok := body["messages"].([]interface{})
	if !ok {
		return nil, false
	}
	
	// Find MsgEthereumTx message
	for _, msg := range messages {
		msgMap, ok := msg.(map[string]interface{})
		if !ok {
			continue
		}
		
		msgType, ok := msgMap["@type"].(string)
		if !ok {
			continue
		}
		
		// Check if this is an EVM transaction
		if IsEVMTransaction(msgType) {
			evmTx, err := e.parser.ParseMsgEthereumTx(msgMap)
			if err != nil {
				slog.Error("Failed to parse MsgEthereumTx", "error", err)
				continue
			}
			
			// Also look for transaction response in logs/events
			e.extractTransactionResponse(txData, evmTx)
			
			return evmTx, true
		}
	}
	
	return nil, false
}

// extractTransactionResponse extracts execution results from transaction logs
func (e *EVMTransactionExtractor) extractTransactionResponse(txData map[string]interface{}, evmTx *EVMTransactionData) {
	// Look for transaction response in logs/events
	// This is cosmos-specific - transaction results are stored in logs
	
	if logs, ok := txData["logs"].([]interface{}); ok {
		for _, log := range logs {
			if logMap, ok := log.(map[string]interface{}); ok {
				if events, ok := logMap["events"].([]interface{}); ok {
					e.extractEVMResponseFromEvents(events, evmTx)
				}
			}
		}
	}
}

// extractEVMResponseFromEvents extracts EVM execution results from cosmos events
func (e *EVMTransactionExtractor) extractEVMResponseFromEvents(events []interface{}, evmTx *EVMTransactionData) {
	for _, event := range events {
		eventMap, ok := event.(map[string]interface{})
		if !ok {
			continue
		}
		
		eventType, ok := eventMap["type"].(string)
		if !ok {
			continue
		}
		
		// Look for ethereum_tx event which contains execution results
		if eventType == "ethereum_tx" {
			e.parseEthereumTxEvent(eventMap, evmTx)
		}
		
		// Look for other relevant events
		if eventType == "message" {
			e.parseMessageEvent(eventMap, evmTx)
		}
	}
}

// parseEthereumTxEvent parses the ethereum_tx event for execution results
func (e *EVMTransactionExtractor) parseEthereumTxEvent(event map[string]interface{}, evmTx *EVMTransactionData) {
	attributes, ok := event["attributes"].([]interface{})
	if !ok {
		return
	}
	
	for _, attr := range attributes {
		attrMap, ok := attr.(map[string]interface{})
		if !ok {
			continue
		}
		
		key, _ := attrMap["key"].(string)
		value, _ := attrMap["value"].(string)
		
		switch key {
		case "hash":
			evmTx.Hash = ensureHexPrefix(value)
		case "gas_used":
			// Parse gas used
			// Implementation depends on how it's encoded
		case "contract_address":
			if value != "" {
				evmTx.ContractAddress = ensureHexPrefix(value)
			}
		case "logs":
			// Parse logs if they're in the event
			// This might be JSON-encoded
			if value != "" {
				e.parseLogsFromEventValue(value, evmTx)
			}
		}
	}
}

// parseMessageEvent extracts additional information from message events
func (e *EVMTransactionExtractor) parseMessageEvent(event map[string]interface{}, evmTx *EVMTransactionData) {
	// Extract any additional message-level information
	// Implementation depends on the specific cosmos-evm implementation
}

// parseLogsFromEventValue parses EVM logs from event attribute value
func (e *EVMTransactionExtractor) parseLogsFromEventValue(value string, evmTx *EVMTransactionData) {
	// The logs might be JSON-encoded in the event value
	var logsData []interface{}
	if err := json.Unmarshal([]byte(value), &logsData); err != nil {
		slog.Debug("Failed to parse logs from event value", "error", err)
		return
	}
	
	evmTx.Logs = e.parser.parseLogs(logsData)
}

// getDecodingStatus determines the decoding status of the transaction
func (e *EVMTransactionExtractor) getDecodingStatus(view *BlockscoutTransactionView) *DecodingStatus {
	status := &DecodingStatus{
		LastUpdated: time.Now(),
	}
	
	if view.Transaction != nil {
		status.HasDecodedInput = view.Transaction.DecodedInput != nil
		
		// Count decoded logs
		decodedLogs := 0
		for _, log := range view.Logs {
			if log.DecodedEvent != nil {
				decodedLogs++
			}
		}
		status.HasDecodedLogs = decodedLogs > 0
		
		// For now, no traces
		status.HasDecodedTraces = false
		
		// Contract verification status (future implementation)
		status.TotalContracts = 0
		status.VerifiedContracts = 0
		
		// Count unique contract addresses
		contracts := make(map[string]bool)
		if view.Transaction.To != "" {
			contracts[view.Transaction.To] = true
		}
		if view.Transaction.CreatedContract != "" {
			contracts[view.Transaction.CreatedContract] = true
		}
		for _, log := range view.Logs {
			contracts[log.Address] = true
		}
		
		status.TotalContracts = len(contracts)
		
		// Future: query database for verified contracts
		// For now, assume none are verified
		status.VerifiedContracts = 0
	}
	
	return status
}

// BatchProcessTransactions processes multiple transactions efficiently
func (e *EVMTransactionExtractor) BatchProcessTransactions(
	transactions []*models.Transaction,
	blockNumber uint64,
	blockHash string,
	timestamp time.Time,
) ([]*EnhancedTransaction, error) {
	
	enhanced := make([]*EnhancedTransaction, len(transactions))
	
	for i, tx := range transactions {
		processedTx, err := e.ProcessTransactionWithEVM(tx, blockNumber, blockHash, uint32(i), timestamp)
		if err != nil {
			return nil, fmt.Errorf("failed to process transaction %s: %w", tx.Hash, err)
		}
		enhanced[i] = processedTx
	}
	
	return enhanced, nil
}

// GetEVMTransactionSummary provides a summary of EVM transactions in a batch
func (e *EVMTransactionExtractor) GetEVMTransactionSummary(enhanced []*EnhancedTransaction) *EVMBatchSummary {
	summary := &EVMBatchSummary{
		TotalTransactions: len(enhanced),
	}
	
	for _, tx := range enhanced {
		if tx.IsEVM {
			summary.EVMTransactions++
			
			if tx.EVMTransactionData != nil {
				if tx.EVMTransactionData.Transaction.CreatedContract != "" {
					summary.ContractCreations++
				}
				summary.TotalLogs += len(tx.EVMTransactionData.Logs)
				summary.TotalTokenTransfers += len(tx.EVMTransactionData.TokenTransfers)
				
				if tx.DecodingStatus != nil {
					if tx.DecodingStatus.HasDecodedInput {
						summary.DecodedTransactions++
					}
				}
			}
		} else {
			summary.CosmosTransactions++
		}
	}
	
	return summary
}

// EVMBatchSummary provides statistics about processed transactions
type EVMBatchSummary struct {
	TotalTransactions    int `json:"total_transactions"`
	EVMTransactions      int `json:"evm_transactions"`
	CosmosTransactions   int `json:"cosmos_transactions"`
	ContractCreations    int `json:"contract_creations"`
	DecodedTransactions  int `json:"decoded_transactions"`
	TotalLogs           int `json:"total_logs"`
	TotalTokenTransfers int `json:"total_token_transfers"`
}

// Future: Integration point for ABI contract verification
type ABIContractVerifier struct {
	abiRepo ABIRepository
}

// VerifyAndDecodeTransaction re-processes a transaction with newly available ABI
func (v *ABIContractVerifier) VerifyAndDecodeTransaction(
	txHash string, 
	contractAddress string, 
	abi string,
) error {
	// Future implementation:
	// 1. Store ABI in repository
	// 2. Re-process the transaction with the new ABI
	// 3. Update decoded data in database
	// 4. Emit events for UI updates
	
	slog.Info("Contract verification requested", 
		"tx_hash", txHash,
		"contract", contractAddress)
	
	return fmt.Errorf("ABI contract verification not yet implemented")
}

// IsEVMTransaction checks if a message type indicates an EVM transaction
// Extended to support different cosmos-evm implementations
func IsEVMTransaction(msgType string) bool {
	evmMsgTypes := []string{
		"/cosmos.evm.vm.v1.MsgEthereumTx",        // cosmos-evm
		"/ethermint.evm.v1.MsgEthereumTx",       // ethermint
		"/injective.evm.v1beta1.MsgEthereumTx",  // injective
	}
	
	for _, evmType := range evmMsgTypes {
		if msgType == evmType {
			return true
		}
	}
	
	return false
}