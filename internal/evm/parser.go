package evm

import (
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/rlp"
)

// EVMTransactionData represents parsed EVM transaction information
type EVMTransactionData struct {
	// Basic transaction fields
	From     string `json:"from"`
	To       string `json:"to,omitempty"`
	Value    string `json:"value"`
	Data     string `json:"data,omitempty"`
	Gas      uint64 `json:"gas"`
	GasPrice string `json:"gasPrice,omitempty"`
	Nonce    uint64 `json:"nonce"`
	
	// EIP-1559 fields
	MaxFeePerGas         string `json:"maxFeePerGas,omitempty"`
	MaxPriorityFeePerGas string `json:"maxPriorityFeePerGas,omitempty"`
	
	// EIP-2930 access list
	AccessList []AccessTuple `json:"accessList,omitempty"`
	
	// Transaction metadata
	Type     uint8  `json:"type"`
	TypeName string `json:"typeName"`
	Hash     string `json:"hash"`
	ChainID  string `json:"chainId,omitempty"`
	
	// Execution results
	ContractAddress string    `json:"contractAddress,omitempty"`
	GasUsed         uint64    `json:"gasUsed,omitempty"`
	Status          string    `json:"status"`
	Logs            []EVMLog  `json:"logs,omitempty"`
	ReturnData      string    `json:"returnData,omitempty"`
	VMError         string    `json:"vmError,omitempty"`
}

// AccessTuple represents an EIP-2930 access list entry
type AccessTuple struct {
	Address     string   `json:"address"`
	StorageKeys []string `json:"storageKeys"`
}

// EVMLog represents an Ethereum event log
type EVMLog struct {
	Address          string   `json:"address"`
	Topics           []string `json:"topics"`
	Data             string   `json:"data"`
	BlockNumber      uint64   `json:"blockNumber"`
	TransactionHash  string   `json:"transactionHash"`
	TransactionIndex uint64   `json:"transactionIndex"`
	BlockHash        string   `json:"blockHash"`
	LogIndex         uint64   `json:"logIndex"`
	Removed          bool     `json:"removed"`
}

// EVMParser handles parsing of EVM transactions from Cosmos messages
type EVMParser struct{}

// NewEVMParser creates a new EVM transaction parser
func NewEVMParser() *EVMParser {
	return &EVMParser{}
}

// ParseMsgEthereumTx extracts EVM transaction data from a MsgEthereumTx cosmos message
func (p *EVMParser) ParseMsgEthereumTx(msgData map[string]interface{}) (*EVMTransactionData, error) {
	evmTx := &EVMTransactionData{}
	
	// Extract basic fields from cosmos message
	if from, ok := msgData["from"].(string); ok && from != "" {
		evmTx.From = strings.ToLower(ensureHexPrefix(from))
	}
	
	// Parse raw ethereum transaction
	rawTx, ok := msgData["raw"].(string)
	if !ok || rawTx == "" {
		return nil, fmt.Errorf("missing or empty raw transaction data")
	}
	
	// Decode hex string
	rawBytes, err := hex.DecodeString(strings.TrimPrefix(rawTx, "0x"))
	if err != nil {
		return nil, fmt.Errorf("failed to decode raw transaction hex: %w", err)
	}
	
	// Parse Ethereum transaction
	ethTx, err := p.parseEthereumTransaction(rawBytes)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ethereum transaction: %w", err)
	}
	
	// Populate transaction data
	p.populateTransactionData(evmTx, ethTx)
	
	return evmTx, nil
}

// ParseMsgEthereumTxResponse extracts execution results from transaction response
func (p *EVMParser) ParseMsgEthereumTxResponse(evmTx *EVMTransactionData, responseData map[string]interface{}) error {
	// Extract transaction hash
	if hash, ok := responseData["hash"].(string); ok {
		evmTx.Hash = ensureHexPrefix(hash)
	}
	
	// Extract gas used
	if gasUsed, ok := responseData["gas_used"].(float64); ok {
		evmTx.GasUsed = uint64(gasUsed)
	}
	
	// Extract contract address (for contract creation)
	if contractAddr, ok := responseData["contract_address"].(string); ok && contractAddr != "" {
		evmTx.ContractAddress = ensureHexPrefix(contractAddr)
	}
	
	// Extract return data
	if retData, ok := responseData["ret"].(string); ok && retData != "" {
		evmTx.ReturnData = ensureHexPrefix(retData)
	}
	
	// Extract VM error
	if vmError, ok := responseData["vm_error"].(string); ok {
		evmTx.VMError = vmError
		evmTx.Status = "failed"
	} else {
		evmTx.Status = "success"
	}
	
	// Parse logs
	if logsData, ok := responseData["logs"].([]interface{}); ok {
		evmTx.Logs = p.parseLogs(logsData)
	}
	
	return nil
}

// parseEthereumTransaction decodes RLP-encoded Ethereum transaction
func (p *EVMParser) parseEthereumTransaction(rawBytes []byte) (*types.Transaction, error) {
	var ethTx types.Transaction
	err := rlp.DecodeBytes(rawBytes, &ethTx)
	if err != nil {
		return nil, fmt.Errorf("failed to RLP decode transaction: %w", err)
	}
	return &ethTx, nil
}

// populateTransactionData fills EVMTransactionData from go-ethereum transaction
func (p *EVMParser) populateTransactionData(evmTx *EVMTransactionData, ethTx *types.Transaction) {
	evmTx.Type = ethTx.Type()
	evmTx.TypeName = p.getTransactionTypeName(ethTx.Type())
	evmTx.Nonce = ethTx.Nonce()
	evmTx.Gas = ethTx.Gas()
	evmTx.Value = ethTx.Value().String()
	
	// Handle recipient (contract creation vs call)
	if ethTx.To() != nil {
		evmTx.To = strings.ToLower(ethTx.To().Hex())
	}
	
	// Transaction data
	if len(ethTx.Data()) > 0 {
		evmTx.Data = hex.EncodeToString(ethTx.Data())
	}
	
	// Chain ID
	if chainID := ethTx.ChainId(); chainID != nil {
		evmTx.ChainID = chainID.String()
	}
	
	// Handle different transaction types
	switch ethTx.Type() {
	case types.LegacyTxType:
		evmTx.GasPrice = ethTx.GasPrice().String()
		
	case types.AccessListTxType:
		evmTx.GasPrice = ethTx.GasPrice().String()
		evmTx.AccessList = p.convertAccessList(ethTx.AccessList())
		
	case types.DynamicFeeTxType:
		evmTx.MaxFeePerGas = ethTx.GasFeeCap().String()
		evmTx.MaxPriorityFeePerGas = ethTx.GasTipCap().String()
		evmTx.AccessList = p.convertAccessList(ethTx.AccessList())
	}
}

// convertAccessList converts go-ethereum AccessList to our format
func (p *EVMParser) convertAccessList(accessList types.AccessList) []AccessTuple {
	if len(accessList) == 0 {
		return nil
	}
	
	result := make([]AccessTuple, len(accessList))
	for i, tuple := range accessList {
		storageKeys := make([]string, len(tuple.StorageKeys))
		for j, key := range tuple.StorageKeys {
			storageKeys[j] = key.Hex()
		}
		result[i] = AccessTuple{
			Address:     strings.ToLower(tuple.Address.Hex()),
			StorageKeys: storageKeys,
		}
	}
	return result
}

// parseLogs converts log data to EVMLog format
func (p *EVMParser) parseLogs(logsData []interface{}) []EVMLog {
	logs := make([]EVMLog, 0, len(logsData))
	
	for _, logData := range logsData {
		logMap, ok := logData.(map[string]interface{})
		if !ok {
			continue
		}
		
		log := EVMLog{}
		
		if address, ok := logMap["address"].(string); ok {
			log.Address = strings.ToLower(ensureHexPrefix(address))
		}
		
		if topics, ok := logMap["topics"].([]interface{}); ok {
			log.Topics = make([]string, len(topics))
			for i, topic := range topics {
				if topicStr, ok := topic.(string); ok {
					log.Topics[i] = ensureHexPrefix(topicStr)
				}
			}
		}
		
		if data, ok := logMap["data"].(string); ok {
			// Data might be base64 encoded bytes, try to decode
			if dataBytes, err := hex.DecodeString(strings.TrimPrefix(data, "0x")); err == nil {
				log.Data = "0x" + hex.EncodeToString(dataBytes)
			} else {
				log.Data = data
			}
		}
		
		if blockNum, ok := logMap["block_number"].(float64); ok {
			log.BlockNumber = uint64(blockNum)
		}
		
		if txHash, ok := logMap["tx_hash"].(string); ok {
			log.TransactionHash = ensureHexPrefix(txHash)
		}
		
		if txIndex, ok := logMap["tx_index"].(float64); ok {
			log.TransactionIndex = uint64(txIndex)
		}
		
		if blockHash, ok := logMap["block_hash"].(string); ok {
			log.BlockHash = ensureHexPrefix(blockHash)
		}
		
		if logIndex, ok := logMap["index"].(float64); ok {
			log.LogIndex = uint64(logIndex)
		}
		
		if removed, ok := logMap["removed"].(bool); ok {
			log.Removed = removed
		}
		
		logs = append(logs, log)
	}
	
	return logs
}

// getTransactionTypeName returns human-readable transaction type name
func (p *EVMParser) getTransactionTypeName(txType uint8) string {
	switch txType {
	case types.LegacyTxType:
		return "Legacy"
	case types.AccessListTxType:
		return "AccessList"
	case types.DynamicFeeTxType:
		return "DynamicFee"
	default:
		return fmt.Sprintf("Unknown(%d)", txType)
	}
}

// ensureHexPrefix ensures the string has 0x prefix
func ensureHexPrefix(s string) string {
	if s == "" {
		return s
	}
	if strings.HasPrefix(s, "0x") {
		return s
	}
	return "0x" + s
}


// ExtractEVMTransactions processes messages and extracts EVM transaction data
func (p *EVMParser) ExtractEVMTransactions(messages []map[string]interface{}) ([]*EVMTransactionData, error) {
	var evmTransactions []*EVMTransactionData
	
	for _, msg := range messages {
		msgType, ok := msg["type"].(string)
		if !ok || !IsEVMTransaction(msgType) {
			continue
		}
		
		// Parse the EVM transaction
		evmTx, err := p.ParseMsgEthereumTx(msg)
		if err != nil {
			return nil, fmt.Errorf("failed to parse EVM transaction: %w", err)
		}
		
		evmTransactions = append(evmTransactions, evmTx)
	}
	
	return evmTransactions, nil
}