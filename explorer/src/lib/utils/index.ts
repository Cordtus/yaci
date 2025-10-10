import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow } from 'date-fns'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// Format addresses for display
export function formatAddress(address: string, length = 8): string {
  if (!address) return ''
  if (address.length <= length * 2) return address
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

// Format token amounts
export function formatTokenAmount(amount: string | number, decimals = 6, symbol?: string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  const formatted = (num / Math.pow(10, decimals)).toLocaleString(undefined, {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  })
  return symbol ? `${formatted} ${symbol}` : formatted
}

// Format block heights
export function formatBlockHeight(height: number): string {
  return height.toLocaleString()
}

// Format timestamps
export function formatTimestamp(timestamp: string | Date, relative = false): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
  if (relative) {
    return formatDistanceToNow(date, { addSuffix: true })
  }
  return format(date, 'MMM dd, yyyy HH:mm:ss')
}

// Format transaction hashes
export function formatTxHash(hash: string, length = 16): string {
  if (!hash) return ''
  if (hash.length <= length * 2) return hash
  return `${hash.slice(0, length)}...${hash.slice(-length)}`
}

// Parse message type for display
export function formatMessageType(type: string): string {
  if (!type) return 'Unknown'
  
  // Remove the leading slash and module path
  const cleanType = type.replace(/^\//, '').split('.').pop() || type
  
  // Convert to human-readable format
  return cleanType
    .replace(/^Msg/, '')
    .replace(/([A-Z])/g, ' $1')
    .trim()
}

// Determine message category/color
export function getMessageCategory(type: string): 'bank' | 'gov' | 'staking' | 'tokenfactory' | 'evm' | 'ibc' | 'other' {
  if (type.includes('bank')) return 'bank'
  if (type.includes('gov') || type.includes('group')) return 'gov'
  if (type.includes('staking') || type.includes('vesting')) return 'staking'
  if (type.includes('tokenfactory')) return 'tokenfactory'
  if (type.includes('evm') || type.includes('ethereum')) return 'evm'
  if (type.includes('ibc')) return 'ibc'
  return 'other'
}

// Format gas and fees
export function formatGas(gas: number): string {
  return gas.toLocaleString()
}

// Check if address is a contract (simple heuristic)
export function isContractAddress(address: string): boolean {
  // For Cosmos chains, contracts often have specific prefixes or patterns
  // This is a simple heuristic that can be improved
  return address.length === 42 && address.startsWith('0x')
}