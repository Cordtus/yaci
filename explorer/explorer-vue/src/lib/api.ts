import { QueryClient } from '@tanstack/vue-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5000, // 5 seconds
      refetchInterval: 10000, // 10 seconds for live updates
    },
  },
})

// PostgREST API base URL
export const API_BASE_URL = 'http://localhost:3000'

// API fetch wrapper
export async function fetchAPI(endpoint: string, params?: Record<string, string>) {
  const url = new URL(endpoint, API_BASE_URL)
  
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.append(key, value)
    })
  }
  
  const response = await fetch(url.toString())
  
  if (!response.ok) {
    throw new Error(`API request failed: ${response.statusText}`)
  }
  
  return response.json()
}

// Typed API functions
export interface Block {
  id: number
  data: any
}

export interface Transaction {
  id: string
  height: number
  fee: any
  memo?: string
  error?: string
  timestamp: string
}

export interface Message {
  id: string
  message_index: number
  type?: string
  sender?: string
  mentions?: string[]
  metadata?: any
}

export const api = {
  getBlocks: (limit = 20, offset = 0) => 
    fetchAPI('/blocks_raw', { 
      limit: limit.toString(),
      offset: offset.toString(),
      order: 'id.desc'
    }),
    
  getTransactions: (limit = 20, offset = 0) =>
    fetchAPI('/transactions_main', {
      limit: limit.toString(), 
      offset: offset.toString(),
      order: 'height.desc'
    }),
    
  getMessages: (limit = 20, offset = 0) =>
    fetchAPI('/messages_main', {
      limit: limit.toString(),
      offset: offset.toString(), 
      order: 'id.desc'
    }),
    
  getTransactionById: (id: string) =>
    fetchAPI(`/transactions_raw?id=eq.${id}`),
    
  getBlockById: (id: number) =>
    fetchAPI(`/blocks_raw?id=eq.${id}`)
}