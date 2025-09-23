// Core blockchain types aligned with yaci indexer schema

export interface Block {
  id: number
  data: {
    block: {
      header: {
        version: any
        chain_id: string
        height: string
        time: string
        last_block_id: any
        last_commit_hash: string
        data_hash: string
        validators_hash: string
        next_validators_hash: string
        consensus_hash: string
        app_hash: string
        last_results_hash: string
        evidence_hash: string
        proposer_address: string
      }
      data: {
        txs: string[]
      }
      evidence: any
      last_commit: any
    }
    block_id: {
      hash: string
      part_set_header: any
    }
  }
}

export interface Transaction {
  id: string
  fee: {
    amount: Array<{
      denom: string
      amount: string
    }>
    gas_limit: string
    payer?: string
    granter?: string
  }
  memo: string
  error: string | null
  height: string
  timestamp: string
  proposal_id: string[] | null
}

export interface Message {
  id: string
  message_index: number
  type: string
  sender: string
  mentions: string[]
  metadata: any
}

export interface Event {
  id: string
  event_index: number
  attr_index: number
  event_type: string
  attr_key: string
  attr_value: string
  msg_index: number
}

// EVM-specific types
export interface EVMTransaction {
  hash: string
  tx_hash: string
  from_address: string
  to_address: string | null
  value: string
  gas_limit: number
  gas_price: string
  gas_used: number
  nonce: number
  input_data: string
  contract_address: string | null
  status: 0 | 1
  type: number
  max_fee_per_gas?: string
  max_priority_fee_per_gas?: string
  access_list?: Array<{
    address: string
    storage_keys: string[]
  }>
}

export interface EVMLog {
  tx_hash: string
  log_index: number
  address: string
  topics: string[]
  data: string
  removed: boolean
}

export interface TokenTransfer {
  tx_hash: string
  log_index: number
  token_address: string
  from_address: string
  to_address: string
  value: string
  token_id?: string
  token_type: 'ERC20' | 'ERC721' | 'ERC1155'
  block_number: number
  timestamp: string
}

export interface Contract {
  address: string
  creator_address: string
  creation_tx_hash: string
  bytecode: string
  is_verified: boolean
  contract_name?: string
  compiler_version?: string
  optimization_enabled?: boolean
  runs?: number
  source_code?: string
  abi?: any[]
  constructor_args?: string
  verified_at?: string
}

export interface Address {
  address: string
  balance: {
    native: string
    tokens: Array<{
      token_address: string
      symbol: string
      name: string
      decimals: number
      balance: string
    }>
  }
  transaction_count: number
  first_seen: string
  last_seen: string
  is_contract: boolean
  contract_info?: Contract
}

// Enhanced types
export interface EnhancedTransaction extends Transaction {
  messages: Message[]
  events: Event[]
  evm_data?: EVMTransaction
  logs?: EVMLog[]
  token_transfers?: TokenTransfer[]
  decoded_input?: {
    method_id: string
    method_name: string
    params: Array<{
      name: string
      type: string
      value: any
    }>
  }
}

// API response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    total: number
    limit: number
    offset: number
    has_next: boolean
    has_prev: boolean
  }
}

export interface ChainStats {
  latest_block: number
  total_transactions: number
  avg_block_time: number
  tps: number
  active_validators: number
  total_supply: string
  market_cap?: string
  price?: number
}

export interface SearchResult {
  type: 'block' | 'transaction' | 'address' | 'contract'
  value: any
  score: number
}