import type {
  Block,
  Transaction,
  EnhancedTransaction,
  Message,
  Event,
  PaginatedResponse,
  ChainStats
} from '@/types/blockchain'

export class YaciAPIClient {
  private baseUrl: string
  private cache = new Map<string, { data: any; timestamp: number }>()
  private cacheTimeout = 10000 // 10 seconds

  constructor(baseUrl = process.env.NEXT_PUBLIC_POSTGREST_URL || 'http://localhost:3000') {
    this.baseUrl = baseUrl
  }

  private async fetchWithCache<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key)
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data as T
    }

    const data = await fetcher()
    this.cache.set(key, { data, timestamp: Date.now() })
    return data
  }

  // Block methods
  async getBlocks(limit = 20, offset = 0): Promise<PaginatedResponse<Block>> {
    const response = await fetch(
      `${this.baseUrl}/blocks_raw?limit=${limit}&offset=${offset}&order=id.desc`
    )

    if (!response.ok) {
      throw new Error(`Failed to fetch blocks: ${response.statusText}`)
    }

    const data = await response.json()
    const totalHeader = response.headers.get('Content-Range')
    const total = totalHeader ? parseInt(totalHeader.split('/')[1]) : data.length

    return {
      data,
      pagination: {
        total,
        limit,
        offset,
        has_next: offset + limit < total,
        has_prev: offset > 0
      }
    }
  }

  async getBlock(height: number): Promise<Block | null> {
    return this.fetchWithCache(`block:${height}`, async () => {
      const response = await fetch(`${this.baseUrl}/blocks_raw?id=eq.${height}`)
      if (!response.ok) {
        throw new Error(`Failed to fetch block: ${response.statusText}`)
      }
      const blocks = await response.json()
      return blocks[0] || null
    })
  }

  async getLatestBlock(): Promise<Block> {
    const response = await fetch(`${this.baseUrl}/blocks_raw?order=id.desc&limit=1`)
    if (!response.ok) {
      throw new Error(`Failed to fetch latest block: ${response.statusText}`)
    }
    const blocks = await response.json()
    return blocks[0]
  }

  // Transaction methods
  async getTransactions(
    limit = 20,
    offset = 0,
    filters: {
      status?: 'success' | 'failed'
      block_height?: number
      message_type?: string
    } = {}
  ): Promise<PaginatedResponse<EnhancedTransaction>> {
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      order: 'height.desc'
    })

    if (filters.status === 'success') {
      params.append('error', 'is.null')
    } else if (filters.status === 'failed') {
      params.append('error', 'not.is.null')
    }

    if (filters.block_height) {
      params.append('height', `eq.${filters.block_height}`)
    }

    const response = await fetch(`${this.baseUrl}/transactions_main?${params}`)
    if (!response.ok) {
      throw new Error('Failed to fetch transactions')
    }

    const transactions = await response.json()
    const totalHeader = response.headers.get('Content-Range')
    const total = totalHeader ? parseInt(totalHeader.split('/')[1]) : transactions.length

    // Enhance transactions with messages
    const enhanced = await Promise.all(
      transactions.map(async (tx: Transaction) => {
        const [messages, events] = await Promise.all([
          this.getTransactionMessages(tx.id),
          this.getTransactionEvents(tx.id)
        ])

        return {
          ...tx,
          messages,
          events
        } as EnhancedTransaction
      })
    )

    return {
      data: enhanced,
      pagination: {
        total,
        limit,
        offset,
        has_next: offset + limit < total,
        has_prev: offset > 0
      }
    }
  }

  async getTransaction(hash: string): Promise<EnhancedTransaction> {
    const [mainResponse, rawResponse] = await Promise.all([
      fetch(`${this.baseUrl}/transactions_main?id=eq.${hash}`),
      fetch(`${this.baseUrl}/transactions_raw?id=eq.${hash}`)
    ])

    if (!mainResponse.ok || !rawResponse.ok) {
      throw new Error('Failed to fetch transaction')
    }

    const [main, raw] = await Promise.all([
      mainResponse.json(),
      rawResponse.json()
    ])

    const transaction = main[0]
    if (!transaction) {
      throw new Error('Transaction not found')
    }

    const [messages, events] = await Promise.all([
      this.getTransactionMessages(hash),
      this.getTransactionEvents(hash)
    ])

    // Check for EVM data
    const evmData = await this.getEVMTransactionData(hash)

    return {
      ...transaction,
      messages,
      events,
      evm_data: evmData,
      raw_data: raw[0]?.data
    } as EnhancedTransaction
  }

  private async getTransactionMessages(txHash: string): Promise<Message[]> {
    const response = await fetch(
      `${this.baseUrl}/messages_main?id=eq.${txHash}&order=message_index.asc`
    )
    if (!response.ok) {
      return []
    }
    return response.json()
  }

  private async getTransactionEvents(txHash: string): Promise<Event[]> {
    const response = await fetch(
      `${this.baseUrl}/events_main?id=eq.${txHash}&order=event_index.asc,attr_index.asc`
    )
    if (!response.ok) {
      return []
    }
    return response.json()
  }

  private async getEVMTransactionData(txHash: string): Promise<any | null> {
    // Check if transaction contains EVM data by looking at message types
    const messages = await this.getTransactionMessages(txHash)
    const hasEVM = messages.some(msg =>
      msg.type?.includes('MsgEthereumTx') ||
      msg.type?.includes('evm')
    )

    if (!hasEVM) {
      return null
    }

    // Parse EVM data from events
    const events = await this.getTransactionEvents(txHash)
    const evmEvents = events.filter(e => e.event_type === 'ethereum_tx')

    if (evmEvents.length === 0) {
      return null
    }

    // Build EVM transaction object from events
    const evmData: any = {}
    evmEvents.forEach(event => {
      switch (event.attr_key) {
        case 'hash':
          evmData.hash = event.attr_value
          break
        case 'from':
          evmData.from_address = event.attr_value
          break
        case 'to':
          evmData.to_address = event.attr_value
          break
        case 'gas_used':
          evmData.gas_used = parseInt(event.attr_value)
          break
        case 'contract_address':
          evmData.contract_address = event.attr_value
          break
      }
    })

    return Object.keys(evmData).length > 0 ? evmData : null
  }

  // Stats methods
  async getChainStats(): Promise<ChainStats> {
    const [latestBlock, recentTxResponse] = await Promise.all([
      this.getLatestBlock(),
      fetch(`${this.baseUrl}/transactions_main?order=height.desc&limit=100`)
    ])

    const recentTxs = await recentTxResponse.json()

    // Calculate TPS from recent transactions
    const now = Date.now()
    const oneMinuteAgo = now - 60000
    const txsLastMinute = recentTxs.filter((tx: Transaction) =>
      new Date(tx.timestamp).getTime() > oneMinuteAgo
    )

    return {
      latest_block: latestBlock.id,
      total_transactions: recentTxs.length,
      avg_block_time: 2.0, // Default, could be calculated
      tps: txsLastMinute.length / 60,
      active_validators: 100, // Would need to query validator set
      total_supply: '1000000000', // Would need to query bank module
    }
  }

  // Search functionality
  async search(query: string): Promise<any[]> {
    const results = []

    // Try to parse as number for block height
    const blockHeight = parseInt(query)
    if (!isNaN(blockHeight)) {
      try {
        const block = await this.getBlock(blockHeight)
        if (block) {
          results.push({ type: 'block', value: block, score: 100 })
        }
      } catch {}
    }

    // Check if it's a transaction hash (64 chars hex)
    if (query.length === 64 && /^[a-fA-F0-9]+$/.test(query)) {
      try {
        const tx = await this.getTransaction(query)
        if (tx) {
          results.push({ type: 'transaction', value: tx, score: 100 })
        }
      } catch {}
    }

    // Check if it's an address (starts with chain prefix or 0x for EVM)
    if (query.startsWith('manifest') || query.startsWith('0x')) {
      results.push({ type: 'address', value: { address: query }, score: 90 })
    }

    return results
  }

  // WebSocket connection for real-time updates
  createLiveConnection(
    endpoint: string,
    callback: (data: any) => void
  ): EventSource | null {
    if (typeof window === 'undefined') {
      return null
    }

    const eventSource = new EventSource(`${this.baseUrl}/${endpoint}`)

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        callback(data)
      } catch (error) {
        console.error('Failed to parse SSE data:', error)
      }
    }

    eventSource.onerror = (error) => {
      console.error('SSE connection error:', error)
    }

    return eventSource
  }
}