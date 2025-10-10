import type { Block, Transaction, Message, ChainStats } from '../types/blockchain.js'

export interface TransactionWithType extends Transaction {
  isEVMTransaction?: boolean
  messageTypes?: string[]
  senders?: string[]
}

export class ApiService {
  private baseUrl = 'http://localhost:3000'

  async getBlocks(limit = 20, offset = 0): Promise<Block[]> {
    const response = await fetch(
      `${this.baseUrl}/blocks_raw?limit=${limit}&offset=${offset}&order=id.desc`
    )
    if (!response.ok) {
      throw new Error(`Failed to fetch blocks: ${response.statusText}`)
    }
    return response.json()
  }

  async getBlock(id: number): Promise<Block | null> {
    const response = await fetch(`${this.baseUrl}/blocks_raw?id=eq.${id}`)
    if (!response.ok) {
      throw new Error(`Failed to fetch block: ${response.statusText}`)
    }
    const blocks = await response.json()
    return blocks[0] || null
  }

  async getTransactions(limit = 20, offset = 0, filters: any = {}): Promise<TransactionWithType[]> {
    // Build query parameters based on filters
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      order: `${filters.sortBy || 'height'}.${filters.sortOrder || 'desc'}`
    })

    // Add status filter
    if (filters.status === 'success') {
      params.append('error', 'is.null')
    } else if (filters.status === 'failed') {
      params.append('error', 'not.is.null')
    }

    // Add sender filter
    if (filters.sender) {
      // We'll need to join with messages table for sender filtering
      // For now, we'll filter after fetching
    }

    const transactionsResponse = await fetch(`${this.baseUrl}/transactions_main?${params}`)

    if (!transactionsResponse.ok) {
      throw new Error('Failed to fetch transactions')
    }

    const transactions = await transactionsResponse.json()

    // Enhance transactions with type information by fetching messages for each transaction
    const enhanced = await Promise.all(
      transactions.map(async (tx: Transaction) => {
        try {
          const messagesResponse = await fetch(`${this.baseUrl}/messages_main?id=eq.${tx.id}`)
          if (messagesResponse.ok) {
            const messages = await messagesResponse.json()
            const messageTypes = messages.map((msg: Message) => msg.type).filter(Boolean)
            const isEVMTransaction = messageTypes.some(type => 
              type?.includes('ethermint.evm.v1.MsgEthereumTx')
            )
            const senders = messages.map((msg: Message) => msg.sender).filter(Boolean)

            return {
              ...tx,
              isEVMTransaction,
              messageTypes,
              senders
            }
          }
        } catch (error) {
          console.warn('Failed to fetch messages for transaction:', tx.id)
        }

        return {
          ...tx,
          isEVMTransaction: false,
          messageTypes: [],
          senders: []
        }
      })
    )

    // Apply client-side filters
    let filtered = enhanced

    // Filter by transaction type
    if (filters.txType === 'evm') {
      filtered = filtered.filter(tx => tx.isEVMTransaction)
    } else if (filters.txType === 'cosmos') {
      filtered = filtered.filter(tx => !tx.isEVMTransaction)
    }

    // Filter by message type
    if (filters.messageType) {
      filtered = filtered.filter(tx => 
        tx.messageTypes.includes(filters.messageType)
      )
    }

    // Filter by sender
    if (filters.sender) {
      filtered = filtered.filter(tx => 
        tx.senders.some(sender => 
          sender?.toLowerCase().includes(filters.sender.toLowerCase())
        )
      )
    }

    return filtered
  }

  async getTransaction(id: string): Promise<{ raw: any; main: Transaction; messages: Message[] }> {
    const [rawResponse, mainResponse, messagesResponse] = await Promise.all([
      fetch(`${this.baseUrl}/transactions_raw?id=eq.${id}`),
      fetch(`${this.baseUrl}/transactions_main?id=eq.${id}`),
      fetch(`${this.baseUrl}/messages_main?id=eq.${id}&order=message_index.asc`)
    ])

    if (!rawResponse.ok || !mainResponse.ok || !messagesResponse.ok) {
      throw new Error('Failed to fetch transaction details')
    }

    const [raw, main, messages] = await Promise.all([
      rawResponse.json(),
      mainResponse.json(), 
      messagesResponse.json()
    ])

    return {
      raw: raw[0],
      main: main[0],
      messages
    }
  }

  async getChainStats(): Promise<ChainStats> {
    const [latestBlockResponse, recentTransactionsResponse] = await Promise.all([
      fetch(`${this.baseUrl}/blocks_raw?order=id.desc&limit=1`),
      fetch(`${this.baseUrl}/transactions_main?order=height.desc&limit=1000`)
    ])

    if (!latestBlockResponse.ok || !recentTransactionsResponse.ok) {
      throw new Error('Failed to fetch chain stats')
    }

    const [latestBlocks, recentTransactions] = await Promise.all([
      latestBlockResponse.json(),
      recentTransactionsResponse.json()
    ])

    return {
      latestBlock: latestBlocks[0]?.id || 0,
      totalTransactions: recentTransactions.length,
      avgBlockTime: 2.0, // Default 2 seconds
      chainId: latestBlocks[0]?.data?.block?.header?.chainId || 'unknown'
    }
  }

  // Create Server-Sent Events connection for real-time updates
  createLiveConnection(endpoint: string, callback: (data: any) => void): EventSource {
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

export const apiService = new ApiService()