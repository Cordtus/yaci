package evm

import (
	"encoding/hex"
	"fmt"
	"log/slog"
	"math/big"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/crypto"
)

// BlockscoutProcessor handles processing transactions into Blockscout-like format
type BlockscoutProcessor struct {
	parser       *EVMParser
	abiRepo      ABIRepository  // Future: contract ABI repository
	decoder      TransactionDecoder // Future: advanced transaction decoder
	
	// Known method signatures for basic decoding without ABI
	knownMethods map[string]string
	// Known event signatures for basic decoding without ABI  
	knownEvents  map[string]string
	// Token contract cache
	tokenCache   map[string]*TokenInfo
}

// NewBlockscoutProcessor creates a new processor instance
func NewBlockscoutProcessor() *BlockscoutProcessor {
	p := &BlockscoutProcessor{
		parser:       NewEVMParser(),
		knownMethods: make(map[string]string),
		knownEvents:  make(map[string]string),
		tokenCache:   make(map[string]*TokenInfo),
	}
	
	p.initializeKnownSignatures()
	return p
}

// ProcessTransaction converts parsed EVM transaction to Blockscout format
func (p *BlockscoutProcessor) ProcessTransaction(
	evmTx *EVMTransactionData, 
	blockNumber uint64, 
	blockHash string, 
	txIndex uint32, 
	timestamp time.Time,
) (*BlockscoutTransactionView, error) {
	
	// Create base transaction
	bsTx := &BlockscoutTransaction{
		Hash:             evmTx.Hash,
		BlockNumber:      blockNumber,
		BlockHash:        blockHash,
		TransactionIndex: txIndex,
		Timestamp:        timestamp,
		From:             evmTx.From,
		To:               evmTx.To,
		Value:            evmTx.Value,
		Gas:              evmTx.Gas,
		GasPrice:         evmTx.GasPrice,
		GasUsed:          evmTx.GasUsed,
		MaxFeePerGas:     evmTx.MaxFeePerGas,
		MaxPriorityFeePerGas: evmTx.MaxPriorityFeePerGas,
		Nonce:            evmTx.Nonce,
		Type:             evmTx.Type,
		Status:           evmTx.Status,
		Error:            evmTx.VMError,
		InputData:        evmTx.Data,
		CreatedContract:  evmTx.ContractAddress,
		AccessList:       evmTx.AccessList,
		LogsCount:        len(evmTx.Logs),
	}
	
	// Calculate effective gas price and transaction fee
	p.calculateFees(bsTx)
	
	// Decode input data (basic decoding without ABI first)
	if bsTx.InputData != "" {
		p.decodeBasicInput(bsTx)
	}
	
	// Process logs
	logs := p.processLogs(evmTx.Logs, blockNumber, blockHash, txIndex)
	
	// Extract token transfers from logs
	tokenTransfers := p.extractTokenTransfers(logs)
	
	// Create the complete view
	view := &BlockscoutTransactionView{
		Transaction:    bsTx,
		Logs:          logs,
		TokenTransfers: tokenTransfers,
	}
	
	// Add contract information if available
	if bsTx.To != "" {
		// Future: retrieve from contract repository
		view.ContractInfo = p.getBasicContractInfo(bsTx.To)
	}
	
	return view, nil
}

// calculateFees computes various fee-related fields
func (p *BlockscoutProcessor) calculateFees(tx *BlockscoutTransaction) {
	gasUsed := new(big.Int).SetUint64(tx.GasUsed)
	
	switch tx.Type {
	case 0, 1: // Legacy and Access List
		if tx.GasPrice != "" {
			gasPrice, ok := new(big.Int).SetString(tx.GasPrice, 10)
			if ok {
				tx.EffectiveGasPrice = gasPrice.String()
				fee := new(big.Int).Mul(gasPrice, gasUsed)
				tx.TransactionFee = fee.String()
			}
		}
	case 2: // Dynamic Fee (EIP-1559)
		// For now, use maxFeePerGas as effective price
		// In a full implementation, we'd need the block's base fee
		if tx.MaxFeePerGas != "" {
			maxFee, ok := new(big.Int).SetString(tx.MaxFeePerGas, 10)
			if ok {
				tx.EffectiveGasPrice = maxFee.String()
				fee := new(big.Int).Mul(maxFee, gasUsed)
				tx.TransactionFee = fee.String()
			}
		}
	}
}

// decodeBasicInput performs basic input decoding without full ABI
func (p *BlockscoutProcessor) decodeBasicInput(tx *BlockscoutTransaction) {
	if len(tx.InputData) < 8 { // Need at least 4 bytes for method signature
		return
	}
	
	methodSig := tx.InputData[:8] // First 4 bytes as hex string
	
	// Check if we know this method signature
	if methodName, known := p.knownMethods[methodSig]; known {
		tx.DecodedInput = &DecodedInput{
			MethodName: methodName,
			MethodID:   "0x" + methodSig,
			Parameters: p.decodeKnownMethod(methodSig, tx.InputData[8:]),
		}
		
		tx.MethodCall = &MethodCall{
			Name:      methodName,
			Signature: p.getMethodSignature(methodSig),
			Inputs:    tx.DecodedInput.Parameters,
		}
	} else {
		// Unknown method - provide basic info
		tx.DecodedInput = &DecodedInput{
			MethodName: "Unknown",
			MethodID:   "0x" + methodSig,
			Parameters: []DecodedParameter{
				{
					Name:  "data",
					Type:  "bytes",
					Value: "0x" + tx.InputData[8:],
				},
			},
		}
	}
}

// decodeKnownMethod decodes parameters for known method signatures
func (p *BlockscoutProcessor) decodeKnownMethod(methodSig string, paramData string) []DecodedParameter {
	switch methodSig {
	case "a9059cbb": // transfer(address,uint256)
		return p.decodeERC20Transfer(paramData)
	case "095ea7b3": // approve(address,uint256)
		return p.decodeERC20Approve(paramData)
	case "23b872dd": // transferFrom(address,address,uint256)
		return p.decodeERC20TransferFrom(paramData)
	case "42842e0e": // safeTransferFrom(address,address,uint256)
		return p.decodeERC721SafeTransfer(paramData)
	default:
		return []DecodedParameter{}
	}
}

// ERC20 transfer decoding
func (p *BlockscoutProcessor) decodeERC20Transfer(paramData string) []DecodedParameter {
	if len(paramData) < 128 { // Need 64 chars (32 bytes) for address + 64 chars for uint256
		return []DecodedParameter{}
	}
	
	// Decode address (first 32 bytes, take last 20 bytes)
	addressHex := paramData[24:64] // Skip padding, take last 40 chars
	address := "0x" + addressHex
	
	// Decode amount (next 32 bytes)
	amountHex := paramData[64:128]
	amount := new(big.Int)
	if amountBytes, err := hex.DecodeString(amountHex); err == nil {
		amount.SetBytes(amountBytes)
	}
	
	return []DecodedParameter{
		{
			Name:  "to",
			Type:  "address",
			Value: address,
		},
		{
			Name:  "amount",
			Type:  "uint256",
			Value: amount.String(),
		},
	}
}

// ERC20 approve decoding
func (p *BlockscoutProcessor) decodeERC20Approve(paramData string) []DecodedParameter {
	if len(paramData) < 128 {
		return []DecodedParameter{}
	}
	
	addressHex := paramData[24:64]
	address := "0x" + addressHex
	
	amountHex := paramData[64:128]
	amount := new(big.Int)
	if amountBytes, err := hex.DecodeString(amountHex); err == nil {
		amount.SetBytes(amountBytes)
	}
	
	return []DecodedParameter{
		{
			Name:  "spender",
			Type:  "address",
			Value: address,
		},
		{
			Name:  "amount",
			Type:  "uint256",
			Value: amount.String(),
		},
	}
}

// ERC20 transferFrom decoding
func (p *BlockscoutProcessor) decodeERC20TransferFrom(paramData string) []DecodedParameter {
	if len(paramData) < 192 { // Need 96 chars for 3 parameters
		return []DecodedParameter{}
	}
	
	fromHex := paramData[24:64]
	from := "0x" + fromHex
	
	toHex := paramData[88:128]
	to := "0x" + toHex
	
	amountHex := paramData[128:192]
	amount := new(big.Int)
	if amountBytes, err := hex.DecodeString(amountHex); err == nil {
		amount.SetBytes(amountBytes)
	}
	
	return []DecodedParameter{
		{
			Name:  "from",
			Type:  "address",
			Value: from,
		},
		{
			Name:  "to", 
			Type:  "address",
			Value: to,
		},
		{
			Name:  "amount",
			Type:  "uint256",
			Value: amount.String(),
		},
	}
}

// ERC721 safeTransferFrom decoding
func (p *BlockscoutProcessor) decodeERC721SafeTransfer(paramData string) []DecodedParameter {
	if len(paramData) < 192 {
		return []DecodedParameter{}
	}
	
	fromHex := paramData[24:64]
	from := "0x" + fromHex
	
	toHex := paramData[88:128]
	to := "0x" + toHex
	
	tokenIdHex := paramData[128:192]
	tokenId := new(big.Int)
	if tokenIdBytes, err := hex.DecodeString(tokenIdHex); err == nil {
		tokenId.SetBytes(tokenIdBytes)
	}
	
	return []DecodedParameter{
		{
			Name:  "from",
			Type:  "address", 
			Value: from,
		},
		{
			Name:  "to",
			Type:  "address",
			Value: to,
		},
		{
			Name:  "tokenId",
			Type:  "uint256",
			Value: tokenId.String(),
		},
	}
}

// processLogs converts EVM logs to Blockscout format
func (p *BlockscoutProcessor) processLogs(evmLogs []EVMLog, blockNumber uint64, blockHash string, txIndex uint32) []BlockscoutLog {
	logs := make([]BlockscoutLog, len(evmLogs))
	
	for i, evmLog := range evmLogs {
		log := BlockscoutLog{
			Address:          evmLog.Address,
			BlockHash:        blockHash,
			BlockNumber:      blockNumber,
			TransactionHash:  evmLog.TransactionHash,
			TransactionIndex: txIndex,
			LogIndex:         uint32(evmLog.LogIndex),
			Data:             evmLog.Data,
			Topics:           evmLog.Topics,
			Removed:          evmLog.Removed,
		}
		
		// Basic event decoding without ABI
		if len(evmLog.Topics) > 0 {
			eventSig := evmLog.Topics[0][2:] // Remove 0x prefix
			if eventName, known := p.knownEvents[eventSig]; known {
				log.DecodedEvent = p.decodeKnownEvent(eventName, evmLog)
			}
		}
		
		logs[i] = log
	}
	
	return logs
}

// decodeKnownEvent decodes common events without full ABI
func (p *BlockscoutProcessor) decodeKnownEvent(eventName string, evmLog EVMLog) *DecodedEvent {
	switch eventName {
	case "Transfer":
		if len(evmLog.Topics) >= 3 {
			return &DecodedEvent{
				Name:      "Transfer",
				Signature: evmLog.Topics[0],
				IndexedParams: []DecodedParameter{
					{Name: "from", Type: "address", Value: p.topicToAddress(evmLog.Topics[1])},
					{Name: "to", Type: "address", Value: p.topicToAddress(evmLog.Topics[2])},
				},
				NonIndexedParams: p.decodeTransferAmount(evmLog.Data),
			}
		}
	case "Approval":
		if len(evmLog.Topics) >= 3 {
			return &DecodedEvent{
				Name:      "Approval",
				Signature: evmLog.Topics[0],
				IndexedParams: []DecodedParameter{
					{Name: "owner", Type: "address", Value: p.topicToAddress(evmLog.Topics[1])},
					{Name: "spender", Type: "address", Value: p.topicToAddress(evmLog.Topics[2])},
				},
				NonIndexedParams: p.decodeTransferAmount(evmLog.Data),
			}
		}
	}
	
	return &DecodedEvent{
		Name:      eventName,
		Signature: evmLog.Topics[0],
		Parameters: []DecodedParameter{},
	}
}

// extractTokenTransfers identifies token transfers from logs
func (p *BlockscoutProcessor) extractTokenTransfers(logs []BlockscoutLog) []BlockscoutTokenTransfer {
	var transfers []BlockscoutTokenTransfer
	
	for _, log := range logs {
		if log.DecodedEvent != nil && log.DecodedEvent.Name == "Transfer" {
			transfer := p.createTokenTransfer(log)
			if transfer != nil {
				transfers = append(transfers, *transfer)
			}
		}
	}
	
	return transfers
}

// createTokenTransfer creates token transfer from decoded Transfer event
func (p *BlockscoutProcessor) createTokenTransfer(log BlockscoutLog) *BlockscoutTokenTransfer {
	if log.DecodedEvent == nil {
		return nil
	}
	
	var from, to, amount string
	
	// Extract from indexed parameters
	for _, param := range log.DecodedEvent.IndexedParams {
		switch param.Name {
		case "from":
			from = param.Value.(string)
		case "to":
			to = param.Value.(string)
		}
	}
	
	// Extract amount from non-indexed parameters
	for _, param := range log.DecodedEvent.NonIndexedParams {
		if param.Name == "value" || param.Name == "amount" {
			amount = param.Value.(string)
			break
		}
	}
	
	transfer := &BlockscoutTokenTransfer{
		TransactionHash: log.TransactionHash,
		LogIndex:        log.LogIndex,
		BlockNumber:     log.BlockNumber,
		BlockHash:       log.BlockHash,
		TokenAddress:    log.Address,
		TokenType:       "ERC20", // Default assumption, could be refined
		From:            from,
		To:              to,
		Amount:          amount,
	}
	
	// Try to get token info from cache or detect
	if tokenInfo := p.getTokenInfo(log.Address); tokenInfo != nil {
		transfer.TokenName = tokenInfo.Name
		transfer.TokenSymbol = tokenInfo.Symbol
		transfer.TokenDecimals = &tokenInfo.Decimals
		
		// Format amount with decimals
		if amount != "" && tokenInfo.Decimals > 0 {
			transfer.AmountFormatted = p.formatTokenAmount(amount, tokenInfo.Decimals, tokenInfo.Symbol)
		}
	}
	
	return transfer
}

// Helper functions
func (p *BlockscoutProcessor) topicToAddress(topic string) string {
	if len(topic) >= 42 {
		return "0x" + topic[26:] // Take last 20 bytes (40 chars) as address
	}
	return topic
}

func (p *BlockscoutProcessor) decodeTransferAmount(data string) []DecodedParameter {
	if len(data) < 66 { // 0x + 64 chars for uint256
		return []DecodedParameter{}
	}
	
	amountHex := data[2:] // Remove 0x prefix
	amount := new(big.Int)
	if amountBytes, err := hex.DecodeString(amountHex); err == nil {
		amount.SetBytes(amountBytes)
	}
	
	return []DecodedParameter{
		{
			Name:  "value",
			Type:  "uint256",
			Value: amount.String(),
		},
	}
}

func (p *BlockscoutProcessor) formatTokenAmount(amount string, decimals int, symbol string) string {
	amountBig, ok := new(big.Int).SetString(amount, 10)
	if !ok {
		return amount
	}
	
	divisor := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	quotient := new(big.Int).Div(amountBig, divisor)
	remainder := new(big.Int).Mod(amountBig, divisor)
	
	if remainder.Sign() == 0 {
		return fmt.Sprintf("%s %s", quotient.String(), symbol)
	}
	
	// Format with decimals
	quotientFloat := new(big.Float).SetInt(quotient)
	remainderFloat := new(big.Float).SetInt(remainder)
	divisorFloat := new(big.Float).SetInt(divisor)
	remainderFloat.Quo(remainderFloat, divisorFloat)
	
	result := new(big.Float).Add(quotientFloat, remainderFloat)
	return fmt.Sprintf("%.6f %s", result, symbol)
}

// getTokenInfo retrieves token information (future: from database)
func (p *BlockscoutProcessor) getTokenInfo(address string) *TokenInfo {
	// Future: query from database or cache
	// For now, return nil - will be populated when ABI system is implemented
	return p.tokenCache[strings.ToLower(address)]
}

// getBasicContractInfo creates basic contract info (future: from repository)
func (p *BlockscoutProcessor) getBasicContractInfo(address string) *ContractInfo {
	// Future: query from contract repository
	// For now, return basic info
	return &ContractInfo{
		Address:    address,
		IsVerified: false, // Will be updated when ABI verification is implemented
		CreatedAt:  time.Now(),
		UpdatedAt:  time.Now(),
	}
}

func (p *BlockscoutProcessor) getMethodSignature(methodSig string) string {
	signatures := map[string]string{
		"a9059cbb": "transfer(address,uint256)",
		"095ea7b3": "approve(address,uint256)", 
		"23b872dd": "transferFrom(address,address,uint256)",
		"42842e0e": "safeTransferFrom(address,address,uint256)",
	}
	return signatures[methodSig]
}

// initializeKnownSignatures sets up common method and event signatures
func (p *BlockscoutProcessor) initializeKnownSignatures() {
	// Common ERC20/ERC721 method signatures
	p.knownMethods["a9059cbb"] = "transfer"
	p.knownMethods["095ea7b3"] = "approve"
	p.knownMethods["23b872dd"] = "transferFrom"
	p.knownMethods["42842e0e"] = "safeTransferFrom"
	p.knownMethods["70a08231"] = "balanceOf"
	p.knownMethods["dd62ed3e"] = "allowance"
	p.knownMethods["06fdde03"] = "name"
	p.knownMethods["95d89b41"] = "symbol"
	p.knownMethods["313ce567"] = "decimals"
	
	// Common event signatures (keccak256 hash of event signature)
	transferSig := crypto.Keccak256Hash([]byte("Transfer(address,address,uint256)")).Hex()[2:]
	approvalSig := crypto.Keccak256Hash([]byte("Approval(address,address,uint256)")).Hex()[2:]
	
	p.knownEvents[transferSig] = "Transfer"
	p.knownEvents[approvalSig] = "Approval"
	
	slog.Debug("Initialized known signatures", 
		"methods", len(p.knownMethods), 
		"events", len(p.knownEvents))
}