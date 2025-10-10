import { useState, useEffect, useRef } from 'react'

interface LiveBlock {
  height: number
  timestamp: string
  proposer: string
  txCount: number
  blockHash: string
}

interface LiveTransaction {
  hash: string
  height: number
  timestamp: string
  success: boolean
  messageType: string
  memo?: string
}

export function useLiveBlocks() {
  const [latestBlock, setLatestBlock] = useState<LiveBlock | null>(null)
  const [recentBlocks, setRecentBlocks] = useState<LiveBlock[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Set up Server-Sent Events connection
    eventSourceRef.current = new EventSource('/api/live/blocks')
    
    eventSourceRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'block') {
          const newBlock: LiveBlock = message.data
          setLatestBlock(newBlock)
          
          setRecentBlocks(prev => {
            const updated = [newBlock, ...prev.filter(b => b.height !== newBlock.height)]
            return updated.slice(0, 10) // Keep only last 10 blocks
          })
        }
      } catch (error) {
        console.error('Error parsing live block data:', error)
      }
    }

    eventSourceRef.current.onerror = (error) => {
      console.error('EventSource failed:', error)
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    latestBlock,
    recentBlocks,
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  }
}

export function useLiveTransactions() {
  const [recentTransactions, setRecentTransactions] = useState<LiveTransaction[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    eventSourceRef.current = new EventSource('/api/live/transactions')
    
    eventSourceRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'transaction') {
          const newTx: LiveTransaction = message.data
          
          setRecentTransactions(prev => {
            const updated = [newTx, ...prev.filter(t => t.hash !== newTx.hash)]
            return updated.slice(0, 20) // Keep only last 20 transactions
          })
        }
      } catch (error) {
        console.error('Error parsing live transaction data:', error)
      }
    }

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
      }
    }
  }, [])

  return {
    recentTransactions,
    isConnected: eventSourceRef.current?.readyState === EventSource.OPEN,
  }
}