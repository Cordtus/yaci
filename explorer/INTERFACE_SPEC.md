# Yaci Explorer Interface Specification

## Data Models & Interfaces

### Core Types

```typescript
// Base blockchain types aligned with yaci indexer schema
export interface Block {
  id: number                    // Block height
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
        txs: string[]          // Base64 encoded transactions
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
  id: string                   // Transaction hash
  fee: {
    amount: Array<{
      denom: string
      amount: string
    }>
    gas_limit: string
    payer: string
    granter: string
  }
  memo: string
  error: string | null
  height: string
  timestamp: string
  proposal_id: string[] | null
}

export interface Message {
  id: string                   // Transaction hash
  message_index: number
  type: string                 // e.g., "/cosmos.bank.v1beta1.MsgSend"
  sender: string
  mentions: string[]           // All addresses mentioned
  metadata: any                // Chain-specific metadata
}

export interface Event {
  id: string                   // Transaction hash
  event_index: number
  attr_index: number
  event_type: string
  attr_key: string
  attr_value: string
  msg_index: number
}

// EVM-specific types
export interface EVMTransaction {
  hash: string                 // EVM transaction hash (0x...)
  tx_hash: string              // Cosmos transaction hash
  from_address: string
  to_address: string | null
  value: string                // Wei value as string
  gas_limit: number
  gas_price: string
  gas_used: number
  nonce: number
  input_data: string
  contract_address: string | null
  status: 0 | 1                // 0 = failed, 1 = success
  type: number                 // 0 = legacy, 2 = EIP-1559
  max_fee_per_gas?: string
  max_priority_fee_per_gas?: string
  access_list?: AccessListEntry[]
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
```

### API Response Types

```typescript
// Paginated response wrapper
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

// Enhanced transaction with decoded data
export interface EnhancedTransaction extends Transaction {
  messages: Message[]
  events: Event[]
  evm_data?: EVMTransaction
  logs?: EVMLog[]
  token_transfers?: TokenTransfer[]
  decoded_input?: DecodedInput
}

export interface DecodedInput {
  method_id: string
  method_name: string
  params: Array<{
    name: string
    type: string
    value: any
  }>
}

// Search results
export interface SearchResult {
  type: 'block' | 'transaction' | 'address' | 'contract'
  value: any
  score: number
}

// Chain statistics
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

export interface GasPrice {
  slow: string
  standard: string
  fast: string
  block_number: number
  timestamp: string
}
```

### API Client Interface

```typescript
export interface YaciAPIClient {
  // Block methods
  getBlocks(params?: BlockQueryParams): Promise<PaginatedResponse<Block>>
  getBlock(height: number): Promise<Block>
  getLatestBlock(): Promise<Block>

  // Transaction methods
  getTransactions(params?: TransactionQueryParams): Promise<PaginatedResponse<EnhancedTransaction>>
  getTransaction(hash: string): Promise<EnhancedTransaction>
  getPendingTransactions(): Promise<EnhancedTransaction[]>

  // Address methods
  getAddress(address: string): Promise<Address>
  getAddressTransactions(address: string, params?: PaginationParams): Promise<PaginatedResponse<EnhancedTransaction>>
  getAddressTokens(address: string): Promise<TokenBalance[]>
  getAddressBalance(address: string, tokenAddress?: string): Promise<string>

  // Contract methods
  getContract(address: string): Promise<Contract>
  verifyContract(address: string, verification: ContractVerification): Promise<boolean>
  readContract(address: string, method: string, args: any[]): Promise<any>
  getContractEvents(address: string, params?: EventQueryParams): Promise<EVMLog[]>

  // Search
  search(query: string): Promise<SearchResult[]>

  // Statistics
  getStats(): Promise<ChainStats>
  getGasPrice(): Promise<GasPrice>
  getValidators(): Promise<Validator[]>

  // Real-time subscriptions
  subscribeToBlocks(callback: (block: Block) => void): () => void
  subscribeToTransactions(callback: (tx: EnhancedTransaction) => void): () => void
  subscribeToAddress(address: string, callback: (event: AddressEvent) => void): () => void
}

// Query parameter types
export interface BlockQueryParams extends PaginationParams {
  from_height?: number
  to_height?: number
  proposer?: string
}

export interface TransactionQueryParams extends PaginationParams {
  block_height?: number
  from_address?: string
  to_address?: string
  message_type?: string
  status?: 'success' | 'failed'
  is_evm?: boolean
  sort_by?: 'height' | 'timestamp' | 'gas_used'
  sort_order?: 'asc' | 'desc'
}

export interface EventQueryParams extends PaginationParams {
  from_block?: number
  to_block?: number
  topics?: string[]
  event_type?: string
}

export interface PaginationParams {
  limit?: number
  offset?: number
}

export interface ContractVerification {
  source_code: string
  contract_name: string
  compiler_version: string
  optimization_enabled: boolean
  runs?: number
  constructor_args?: string
  libraries?: Record<string, string>
}
```

### WebSocket Events

```typescript
// WebSocket message types
export type WSMessage =
  | { type: 'new_block'; data: Block }
  | { type: 'new_transaction'; data: EnhancedTransaction }
  | { type: 'address_activity'; data: AddressEvent }
  | { type: 'contract_event'; data: ContractEvent }
  | { type: 'chain_stats_update'; data: ChainStats }
  | { type: 'ping'; data: { timestamp: number } }
  | { type: 'error'; data: { message: string; code: string } }

export interface AddressEvent {
  address: string
  event_type: 'incoming' | 'outgoing' | 'contract_interaction'
  transaction: EnhancedTransaction
  balance_change?: {
    token: string
    amount: string
    direction: 'in' | 'out'
  }
}

export interface ContractEvent {
  contract_address: string
  event: EVMLog
  decoded?: {
    event_name: string
    params: Record<string, any>
  }
}

// WebSocket client interface
export interface WSClient {
  connect(): Promise<void>
  disconnect(): void
  subscribe(channel: string, params?: any): void
  unsubscribe(channel: string): void
  on(event: string, handler: (data: any) => void): void
  off(event: string, handler: (data: any) => void): void
}
```

### Database Access Layer

```typescript
// Direct database access for optimal performance
export interface DatabaseClient {
  // Raw query execution
  query<T>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>

  // Transaction support
  transaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T>
}

export interface DatabaseTransaction {
  query<T>(sql: string, params?: any[]): Promise<T[]>
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>
  commit(): Promise<void>
  rollback(): Promise<void>
}

// Repository pattern for common queries
export interface BlockRepository {
  findById(height: number): Promise<Block | null>
  findLatest(): Promise<Block>
  findMany(params: BlockQueryParams): Promise<PaginatedResponse<Block>>
  countByTimeRange(from: Date, to: Date): Promise<number>
}

export interface TransactionRepository {
  findByHash(hash: string): Promise<EnhancedTransaction | null>
  findMany(params: TransactionQueryParams): Promise<PaginatedResponse<EnhancedTransaction>>
  findByAddress(address: string, params: PaginationParams): Promise<PaginatedResponse<EnhancedTransaction>>
  findPending(): Promise<EnhancedTransaction[]>
}

export interface EVMRepository {
  findTransaction(hash: string): Promise<EVMTransaction | null>
  findLogs(params: EventQueryParams): Promise<EVMLog[]>
  findTokenTransfers(address: string, params: PaginationParams): Promise<TokenTransfer[]>
  findContract(address: string): Promise<Contract | null>
  saveContract(contract: Contract): Promise<void>
  updateContractVerification(address: string, verification: Partial<Contract>): Promise<void>
}
```

### Configuration Interfaces

```typescript
export interface ExplorerConfig {
  // Database configuration
  database: {
    url: string
    max_connections: number
    idle_timeout: number
    ssl?: boolean
  }

  // API configuration
  api: {
    port: number
    cors_origins: string[]
    rate_limit: {
      enabled: boolean
      max_requests: number
      window_ms: number
    }
    cache: {
      enabled: boolean
      ttl: number
      redis_url?: string
    }
  }

  // Chain configuration
  chain: ChainConfig

  // Feature flags
  features: {
    evm_support: boolean
    contract_verification: boolean
    websocket_enabled: boolean
    search_enabled: boolean
    analytics_enabled: boolean
  }

  // UI configuration
  ui: {
    theme: 'light' | 'dark' | 'auto'
    logo_url: string
    favicon_url: string
    title: string
    description: string
    social_links?: {
      twitter?: string
      discord?: string
      telegram?: string
      github?: string
    }
  }
}

export interface ChainConfig {
  id: string
  name: string
  rpc_url: string
  grpc_url: string
  indexer_db_url: string

  network_type: 'mainnet' | 'testnet' | 'devnet'

  native_token: {
    symbol: string
    name: string
    decimals: number
  }

  modules: {
    bank: boolean
    staking: boolean
    governance: boolean
    ibc: boolean
    wasm: boolean
    evm: boolean
  }

  evm?: {
    chain_id: number
    multicall_address?: string
    explorer_api?: string
  }

  external_apis?: {
    coingecko_id?: string
    mintscan_url?: string
    cosmos_directory_url?: string
  }
}
```

### Error Handling

```typescript
export class ExplorerError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message)
    this.name = 'ExplorerError'
  }
}

export enum ErrorCode {
  // Client errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  NOT_FOUND = 'NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  RATE_LIMITED = 'RATE_LIMITED',

  // Server errors
  DATABASE_ERROR = 'DATABASE_ERROR',
  INDEXER_ERROR = 'INDEXER_ERROR',
  EXTERNAL_API_ERROR = 'EXTERNAL_API_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',

  // Business logic errors
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  INVALID_TRANSACTION = 'INVALID_TRANSACTION',
  CONTRACT_NOT_VERIFIED = 'CONTRACT_NOT_VERIFIED',
  INSUFFICIENT_DATA = 'INSUFFICIENT_DATA',
}

export interface ErrorResponse {
  error: {
    code: string
    message: string
    details?: any
    timestamp: string
    request_id: string
  }
}
```

### React Hooks Interface

```typescript
// Data fetching hooks
export function useBlock(height: number): {
  data: Block | undefined
  error: Error | null
  isLoading: boolean
}

export function useBlocks(params?: BlockQueryParams): {
  data: PaginatedResponse<Block> | undefined
  error: Error | null
  isLoading: boolean
  fetchNextPage: () => void
  hasNextPage: boolean
}

export function useTransaction(hash: string): {
  data: EnhancedTransaction | undefined
  error: Error | null
  isLoading: boolean
}

export function useAddress(address: string): {
  data: Address | undefined
  error: Error | null
  isLoading: boolean
  refetch: () => void
}

export function useContract(address: string): {
  data: Contract | undefined
  error: Error | null
  isLoading: boolean
  verifyContract: (verification: ContractVerification) => Promise<void>
}

// Real-time hooks
export function useLatestBlock(): Block | null
export function useRecentTransactions(limit?: number): EnhancedTransaction[]
export function useAddressActivity(address: string): AddressEvent[]

// Utility hooks
export function useChainConfig(): ChainConfig
export function useWebSocket(): WSClient
export function useNotifications(): {
  notify: (message: string, type?: 'info' | 'success' | 'error') => void
  notifications: Notification[]
}
```

## UI Component Props

```typescript
// Common component props
export interface BlockListProps {
  blocks: Block[]
  onBlockClick?: (block: Block) => void
  loading?: boolean
  className?: string
}

export interface TransactionTableProps {
  transactions: EnhancedTransaction[]
  onTransactionClick?: (tx: EnhancedTransaction) => void
  showEVMBadge?: boolean
  loading?: boolean
  pagination?: {
    total: number
    limit: number
    offset: number
    onChange: (offset: number) => void
  }
}

export interface AddressOverviewProps {
  address: Address
  showQRCode?: boolean
  showTokens?: boolean
  onTokenClick?: (token: TokenBalance) => void
}

export interface ContractInterfaceProps {
  contract: Contract
  abi: any[]
  onMethodCall?: (method: string, args: any[]) => void
  readOnly?: boolean
}

export interface SearchBarProps {
  onSearch: (query: string) => void
  placeholder?: string
  suggestions?: SearchResult[]
  loading?: boolean
}

export interface ChartProps {
  data: any[]
  type: 'line' | 'bar' | 'pie' | 'area'
  xAxis: string
  yAxis: string
  title?: string
  height?: number
  responsive?: boolean
}
```