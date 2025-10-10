export interface Block {
  id: number
  data: {
    block: {
      header: {
        height: string
        time: string
        chainId: string
        proposerAddress: string
        appHash: string
        dataHash: string
        validatorsHash: string
      }
      data: any
      evidence: any
      lastCommit: any
    }
    blockId: {
      hash: string
      partSetHeader: {
        hash: string
        total: number
      }
    }
    pagination: any
  }
}

export interface Transaction {
  id: string
  height: number
  fee?: {
    amount: Array<{
      denom: string
      amount: string
    }>
    gas_limit?: string
  }
  memo?: string
  error?: string
  timestamp: string
  proposal_ids?: string[]
}

export interface Message {
  id: string
  message_index: number
  type?: string
  sender?: string
  mentions?: string[]
  metadata?: any
}

export interface ChainStats {
  latestBlock: number
  totalTransactions: number
  avgBlockTime: number
  chainId: string
}