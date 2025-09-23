package evm

import (
	"encoding/json"
	"time"
)

// BlockscoutTransaction represents a transaction in Blockscout-like format
type BlockscoutTransaction struct {
	// Basic Transaction Info
	Hash             string    `json:"hash" db:"hash"`
	BlockNumber      uint64    `json:"block_number" db:"block_number"`
	BlockHash        string    `json:"block_hash" db:"block_hash"`
	TransactionIndex uint32    `json:"transaction_index" db:"transaction_index"`
	Timestamp        time.Time `json:"timestamp" db:"timestamp"`
	
	// Transaction Details
	From                     string `json:"from" db:"from_address"`
	To                       string `json:"to" db:"to_address"`
	Value                    string `json:"value" db:"value"`
	Gas                      uint64 `json:"gas" db:"gas"`
	GasPrice                 string `json:"gas_price" db:"gas_price"`
	GasUsed                  uint64 `json:"gas_used" db:"gas_used"`
	MaxFeePerGas             string `json:"max_fee_per_gas" db:"max_fee_per_gas"`
	MaxPriorityFeePerGas     string `json:"max_priority_fee_per_gas" db:"max_priority_fee_per_gas"`
	Nonce                    uint64 `json:"nonce" db:"nonce"`
	
	// Transaction Type & Status
	Type           uint8  `json:"type" db:"transaction_type"`
	Status         string `json:"status" db:"status"` // success, failed, pending
	Error          string `json:"error,omitempty" db:"error"`
	RevertReason   string `json:"revert_reason,omitempty" db:"revert_reason"`
	
	// Input Data & Contract Creation
	InputData         string `json:"input" db:"input"`
	CreatedContract   string `json:"created_contract_address,omitempty" db:"created_contract_address"`
	
	// Decoded Information (populated when ABI available)
	DecodedInput      *DecodedInput  `json:"decoded_input,omitempty"`
	MethodCall        *MethodCall    `json:"method_call,omitempty"`
	
	// Access List (EIP-2930, EIP-1559)
	AccessList        []AccessTuple  `json:"access_list,omitempty"`
	
	// Fees & Pricing
	BaseFeePerGas     string         `json:"base_fee_per_gas,omitempty" db:"base_fee_per_gas"`
	PriorityFeePerGas string         `json:"priority_fee_per_gas,omitempty" db:"priority_fee_per_gas"`
	EffectiveGasPrice string         `json:"effective_gas_price" db:"effective_gas_price"`
	TransactionFee    string         `json:"transaction_fee" db:"transaction_fee"`
	
	// Logs & Events Count
	LogsCount         int            `json:"logs_count" db:"logs_count"`
	
	// Raw Data (for debugging/advanced users)
	RawTransaction    string         `json:"raw_transaction,omitempty"`
}

// DecodedParameter represents a decoded function/event parameter
type DecodedParameter struct {
	Name  string      `json:"name"`
	Type  string      `json:"type"`
	Value interface{} `json:"value"`
}

// TokenInfo represents token metadata
type TokenInfo struct {
	Symbol   string `json:"symbol"`
	Decimals int    `json:"decimals"`
	Name     string `json:"name"`
}

// DecodedInput represents decoded transaction input data
type DecodedInput struct {
	MethodName   string                    `json:"method_name"`
	MethodID     string                    `json:"method_id"`
	Parameters   []DecodedParameter        `json:"parameters"`
	Types        map[string]string         `json:"types"`
}

// MethodCall represents a decoded contract method call
type MethodCall struct {
	Name        string                 `json:"name"`
	Signature   string                 `json:"signature"`
	Inputs      []DecodedParameter     `json:"inputs"`
	Outputs     []DecodedParameter     `json:"outputs,omitempty"`
	Payable     bool                   `json:"payable"`
	StateMutability string             `json:"state_mutability"`
}

// BlockscoutLog represents an event log in Blockscout format
type BlockscoutLog struct {
	// Log Identity
	Address          string `json:"address" db:"address"`
	BlockHash        string `json:"block_hash" db:"block_hash"`
	BlockNumber      uint64 `json:"block_number" db:"block_number"`
	TransactionHash  string `json:"transaction_hash" db:"transaction_hash"`
	TransactionIndex uint32 `json:"transaction_index" db:"transaction_index"`
	LogIndex         uint32 `json:"log_index" db:"log_index"`
	
	// Log Data
	Data             string   `json:"data" db:"data"`
	Topics           []string `json:"topics" db:"topics"`
	
	// Decoded Event (populated when ABI available)
	DecodedEvent     *DecodedEvent `json:"decoded,omitempty"`
	
	// Contract Information
	ContractName     string `json:"contract_name,omitempty" db:"contract_name"`
	IsVerified       bool   `json:"is_verified" db:"is_verified"`
	
	// Additional metadata
	Removed          bool   `json:"removed" db:"removed"`
	Type             string `json:"type,omitempty"` // contract, token, etc.
}

// DecodedEvent represents a decoded contract event
type DecodedEvent struct {
	Name            string             `json:"name"`
	Signature       string             `json:"signature"`
	Parameters      []DecodedParameter `json:"parameters"`
	IndexedParams   []DecodedParameter `json:"indexed_parameters"`
	NonIndexedParams []DecodedParameter `json:"non_indexed_parameters"`
}

// BlockscoutTrace represents internal transactions/traces
type BlockscoutTrace struct {
	// Trace Identity
	TransactionHash   string `json:"transaction_hash" db:"transaction_hash"`
	BlockNumber       uint64 `json:"block_number" db:"block_number"`
	BlockHash         string `json:"block_hash" db:"block_hash"`
	TraceAddress      string `json:"trace_address" db:"trace_address"` // e.g., "0,1,2"
	Subtraces         int    `json:"subtraces" db:"subtraces"`
	
	// Trace Type & Action
	Type              string `json:"type" db:"type"` // call, create, suicide, reward
	CallType          string `json:"call_type,omitempty" db:"call_type"` // call, delegatecall, staticcall
	
	// Call Details
	From              string `json:"from" db:"from_address"`
	To                string `json:"to" db:"to_address"`
	Value             string `json:"value" db:"value"`
	Gas               uint64 `json:"gas" db:"gas"`
	GasUsed           uint64 `json:"gas_used" db:"gas_used"`
	Input             string `json:"input" db:"input"`
	Output            string `json:"output" db:"output"`
	
	// Execution Result
	Error             string `json:"error,omitempty" db:"error"`
	RevertReason      string `json:"revert_reason,omitempty" db:"revert_reason"`
	
	// Contract Creation
	CreatedContract   string `json:"created_contract_address,omitempty" db:"created_contract_address"`
	
	// Decoded Information (when ABI available)
	DecodedInput      *DecodedInput `json:"decoded_input,omitempty"`
	DecodedOutput     *DecodedOutput `json:"decoded_output,omitempty"`
}

// DecodedOutput represents decoded function output
type DecodedOutput struct {
	Parameters []DecodedParameter `json:"parameters"`
	Types      map[string]string  `json:"types"`
}

// BlockscoutToken represents token transfer information
type BlockscoutTokenTransfer struct {
	// Transfer Identity
	TransactionHash  string `json:"transaction_hash" db:"transaction_hash"`
	LogIndex         uint32 `json:"log_index" db:"log_index"`
	BlockNumber      uint64 `json:"block_number" db:"block_number"`
	BlockHash        string `json:"block_hash" db:"block_hash"`
	
	// Token Information
	TokenAddress     string `json:"token_address" db:"token_address"`
	TokenType        string `json:"token_type" db:"token_type"` // ERC20, ERC721, ERC1155
	TokenName        string `json:"token_name,omitempty" db:"token_name"`
	TokenSymbol      string `json:"token_symbol,omitempty" db:"token_symbol"`
	TokenDecimals    *int   `json:"token_decimals,omitempty" db:"token_decimals"`
	
	// Transfer Details
	From             string `json:"from" db:"from_address"`
	To               string `json:"to" db:"to_address"`
	Amount           string `json:"amount" db:"amount"`
	TokenID          string `json:"token_id,omitempty" db:"token_id"` // for NFTs
	
	// Human Readable
	AmountFormatted  string `json:"amount_formatted,omitempty"`
}

// ContractInfo represents verified contract information
type ContractInfo struct {
	// Contract Identity
	Address          string    `json:"address" db:"address"`
	Name             string    `json:"name,omitempty" db:"name"`
	
	// Verification Status
	IsVerified       bool      `json:"is_verified" db:"is_verified"`
	VerificationDate *time.Time `json:"verification_date,omitempty" db:"verification_date"`
	
	// Contract Details
	CompilerVersion  string    `json:"compiler_version,omitempty" db:"compiler_version"`
	OptimizationUsed bool      `json:"optimization_used" db:"optimization_used"`
	OptimizationRuns int       `json:"optimization_runs,omitempty" db:"optimization_runs"`
	
	// Source Code & ABI (stored separately for performance)
	HasSourceCode    bool      `json:"has_source_code" db:"has_source_code"`
	HasABI          bool      `json:"has_abi" db:"has_abi"`
	
	// Contract Type Detection
	ContractType     string    `json:"contract_type,omitempty" db:"contract_type"` // ERC20, ERC721, etc.
	IsProxy          bool      `json:"is_proxy" db:"is_proxy"`
	ImplementationAddress string `json:"implementation_address,omitempty" db:"implementation_address"`
	
	// Creation Info
	CreatorAddress   string    `json:"creator_address,omitempty" db:"creator_address"`
	CreationTxHash   string    `json:"creation_tx_hash,omitempty" db:"creation_tx_hash"`
	CreationBlock    uint64    `json:"creation_block,omitempty" db:"creation_block"`
	
	// Statistics
	TransactionCount uint64    `json:"transaction_count" db:"transaction_count"`
	
	// Metadata
	CreatedAt        time.Time `json:"created_at" db:"created_at"`
	UpdatedAt        time.Time `json:"updated_at" db:"updated_at"`
}

// ContractABI represents stored contract ABI for decoding
type ContractABI struct {
	Address     string          `json:"address" db:"address"`
	ABI         json.RawMessage `json:"abi" db:"abi"`
	SourceCode  string          `json:"source_code,omitempty" db:"source_code"`
	UpdatedAt   time.Time       `json:"updated_at" db:"updated_at"`
}

// BlockscoutState represents the overall state for Blockscout-like interface
type BlockscoutTransactionView struct {
	Transaction    *BlockscoutTransaction      `json:"transaction"`
	Logs          []BlockscoutLog             `json:"logs,omitempty"`
	Traces        []BlockscoutTrace           `json:"traces,omitempty"`
	TokenTransfers []BlockscoutTokenTransfer  `json:"token_transfers,omitempty"`
	ContractInfo  *ContractInfo               `json:"contract_info,omitempty"`
}

// DecodingStatus represents the status of transaction decoding
type DecodingStatus struct {
	HasDecodedInput   bool `json:"has_decoded_input"`
	HasDecodedLogs    bool `json:"has_decoded_logs"`
	HasDecodedTraces  bool `json:"has_decoded_traces"`
	VerifiedContracts int  `json:"verified_contracts_count"`
	TotalContracts    int  `json:"total_contracts_count"`
	LastUpdated       time.Time `json:"last_updated"`
}

// Interface for future ABI contract verification system
type ABIRepository interface {
	// Contract verification
	VerifyContract(address string, sourceCode string, abi string, compilerVersion string) error
	GetContractABI(address string) (*ContractABI, error)
	IsContractVerified(address string) bool
	
	// Batch operations for efficiency
	GetContractABIs(addresses []string) (map[string]*ContractABI, error)
	
	// Contract detection and classification
	DetectContractType(address string, abi string) (string, error)
	DetectProxyPattern(address string) (*ProxyInfo, error)
}

// ProxyInfo represents proxy contract information
type ProxyInfo struct {
	IsProxy               bool   `json:"is_proxy"`
	ProxyType            string `json:"proxy_type"` // EIP-1167, EIP-1822, etc.
	ImplementationAddress string `json:"implementation_address"`
	AdminAddress         string `json:"admin_address,omitempty"`
}

// Interface for transaction decoding service
type TransactionDecoder interface {
	// Core decoding functions
	DecodeTransaction(tx *BlockscoutTransaction) error
	DecodeLogs(logs []BlockscoutLog) error
	DecodeTraces(traces []BlockscoutTrace) error
	
	// Batch decoding for performance
	DecodeTransactionBatch(txs []*BlockscoutTransaction) error
	
	// Token transfer detection
	ExtractTokenTransfers(logs []BlockscoutLog) ([]BlockscoutTokenTransfer, error)
	
	// Update decoding when new ABIs are added
	ReprocessTransactionWithNewABI(txHash string, contractAddress string) error
}

// Future extension: Contract interaction analysis
type ContractInteractionAnalyzer interface {
	AnalyzeContractInteractions(address string) (*InteractionSummary, error)
	GetMethodCallFrequency(address string) (map[string]int, error)
	GetEventEmissionFrequency(address string) (map[string]int, error)
}

type InteractionSummary struct {
	TotalTransactions int                    `json:"total_transactions"`
	UniqueCallers     int                    `json:"unique_callers"`
	MethodCalls       map[string]int         `json:"method_calls"`
	Events            map[string]int         `json:"events"`
	LastActivity      time.Time              `json:"last_activity"`
	TopCallers        []AddressActivityInfo  `json:"top_callers"`
}

type AddressActivityInfo struct {
	Address           string `json:"address"`
	TransactionCount  int    `json:"transaction_count"`
	LastTransaction   time.Time `json:"last_transaction"`
}