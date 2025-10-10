import { ethers } from 'ethers'

export interface ContractABI {
  type: 'function' | 'event' | 'constructor' | 'fallback' | 'receive'
  name?: string
  inputs: Array<{
    name: string
    type: string
    indexed?: boolean
  }>
  outputs?: Array<{
    name: string
    type: string
  }>
  stateMutability?: 'pure' | 'view' | 'nonpayable' | 'payable'
}

export interface DecodedCallData {
  functionName: string
  functionSignature: string
  parameters: Array<{
    name: string
    type: string
    value: any
  }>
  rawData: string
}

export interface DecodedLogData {
  eventName: string
  eventSignature: string
  parameters: Array<{
    name: string
    type: string
    value: any
    indexed: boolean
  }>
  rawData: string
}

export class ContractDecoder {
  private interface: ethers.Interface | null = null

  constructor(abi?: ContractABI[]) {
    if (abi) {
      this.interface = new ethers.Interface(abi)
    }
  }

  // Decode transaction input data
  decodeCallData(data: string): DecodedCallData | null {
    if (!this.interface || !data || data === '0x') {
      return null
    }

    try {
      const decoded = this.interface.parseTransaction({ data })
      if (!decoded) return null

      const parameters = decoded.args.map((value, index) => {
        const input = decoded.fragment.inputs[index]
        return {
          name: input.name,
          type: input.type,
          value: this.formatValue(value, input.type),
        }
      })

      return {
        functionName: decoded.name,
        functionSignature: decoded.signature,
        parameters,
        rawData: data,
      }
    } catch (error) {
      console.warn('Failed to decode call data:', error)
      return null
    }
  }

  // Decode event log data
  decodeLogData(topics: string[], data: string): DecodedLogData | null {
    if (!this.interface) {
      return null
    }

    try {
      const decoded = this.interface.parseLog({ topics, data })
      if (!decoded) return null

      const parameters = decoded.args.map((value, index) => {
        const input = decoded.fragment.inputs[index]
        return {
          name: input.name,
          type: input.type,
          value: this.formatValue(value, input.type),
          indexed: input.indexed || false,
        }
      })

      return {
        eventName: decoded.name,
        eventSignature: decoded.signature,
        parameters,
        rawData: data,
      }
    } catch (error) {
      console.warn('Failed to decode log data:', error)
      return null
    }
  }

  // Format values for display
  private formatValue(value: any, type: string): any {
    if (type.startsWith('uint') || type.startsWith('int')) {
      return value.toString()
    }
    if (type === 'address') {
      return value.toLowerCase()
    }
    if (type === 'bytes' || type.startsWith('bytes')) {
      return value
    }
    if (type === 'bool') {
      return Boolean(value)
    }
    if (type.includes('[]')) {
      return Array.isArray(value) ? value.map(v => this.formatValue(v, type.replace('[]', ''))) : value
    }
    return value
  }

  // Get function selector from data
  static getFunctionSelector(data: string): string {
    if (!data || data === '0x' || data.length < 10) {
      return ''
    }
    return data.slice(0, 10)
  }

  // Get event signature from topics
  static getEventSignature(topics: string[]): string {
    return topics[0] || ''
  }
}

// Common ERC20 ABI for basic token interactions
export const ERC20_ABI: ContractABI[] = [
  {
    type: 'function',
    name: 'transfer',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'transferFrom',
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'function',
    name: 'approve',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable'
  },
  {
    type: 'event',
    name: 'Transfer',
    inputs: [
      { name: 'from', type: 'address', indexed: true },
      { name: 'to', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  },
  {
    type: 'event',
    name: 'Approval',
    inputs: [
      { name: 'owner', type: 'address', indexed: true },
      { name: 'spender', type: 'address', indexed: true },
      { name: 'value', type: 'uint256', indexed: false }
    ]
  }
]

// Utility to detect contract type from bytecode or ABI
export function detectContractType(abi?: ContractABI[]): 'erc20' | 'erc721' | 'erc1155' | 'multisig' | 'unknown' {
  if (!abi) return 'unknown'
  
  const functionNames = abi.filter(item => item.type === 'function').map(item => item.name)
  const eventNames = abi.filter(item => item.type === 'event').map(item => item.name)
  
  // ERC20 detection
  if (functionNames.includes('transfer') && 
      functionNames.includes('approve') && 
      eventNames.includes('Transfer')) {
    return 'erc20'
  }
  
  // ERC721 detection
  if (functionNames.includes('transferFrom') && 
      functionNames.includes('approve') && 
      eventNames.includes('Transfer') &&
      functionNames.includes('tokenURI')) {
    return 'erc721'
  }
  
  // ERC1155 detection
  if (functionNames.includes('safeTransferFrom') && 
      eventNames.includes('TransferSingle')) {
    return 'erc1155'
  }
  
  return 'unknown'
}