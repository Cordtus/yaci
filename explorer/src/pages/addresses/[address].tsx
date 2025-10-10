import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/layout/header.js'
import { Button } from '@/components/ui/button.js'
import { trpc } from '@/lib/utils/trpc.js'
import { 
  formatAddress, formatTimestamp, formatTokenAmount, formatBlockHeight,
  formatMessageType, getMessageCategory, cn 
} from '@/lib/utils/index.js'
import { Copy, ExternalLink, TrendingUp, TrendingDown, Activity } from 'lucide-react'

export default function AddressDetail() {
  const router = useRouter()
  const { address } = router.query
  const [selectedTab, setSelectedTab] = useState<'transactions' | 'tokens' | 'contracts'>('transactions')
  
  const { data: addressDetails, isLoading: detailsLoading } = trpc.addresses.getDetails.useQuery(
    { address: address as string },
    { enabled: !!address }
  )

  const { data: transactions, isLoading: txLoading } = trpc.addresses.getTransactions.useQuery(
    { address: address as string, limit: 20 },
    { enabled: !!address }
  )

  if (detailsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/3"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  if (!addressDetails) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Address Not Found</h1>
            <p className="text-gray-600 mb-8">No transaction history found for this address.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </main>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  return (
    <>
      <Head>
        <title>Address {formatAddress(addressDetails.address)} - Yaci Explorer</title>
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Address Details</h1>
            <div className="flex items-center space-x-2 mb-4">
              <p className="font-mono text-sm bg-gray-100 p-2 rounded break-all">
                {addressDetails.address}
              </p>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => copyToClipboard(addressDetails.address)}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Address Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold">
                    {addressDetails.totalTransactions.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Sent</p>
                  <p className="text-2xl font-bold">
                    {addressDetails.sentTransactions.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <TrendingDown className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Received</p>
                  <p className="text-2xl font-bold">
                    {addressDetails.receivedTransactions.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">First Seen</p>
                  <p className="text-lg font-bold">
                    {addressDetails.firstSeenBlock ? `#${formatBlockHeight(addressDetails.firstSeenBlock)}` : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8">
                <button
                  onClick={() => setSelectedTab('transactions')}
                  className={cn(
                    "py-2 px-1 border-b-2 font-medium text-sm",
                    selectedTab === 'transactions'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                  )}
                >
                  Transactions ({addressDetails.totalTransactions})
                </button>
                <button
                  onClick={() => setSelectedTab('tokens')}
                  className={cn(
                    "py-2 px-1 border-b-2 font-medium text-sm",
                    selectedTab === 'tokens'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                  )}
                >
                  Tokens
                </button>
                <button
                  onClick={() => setSelectedTab('contracts')}
                  className={cn(
                    "py-2 px-1 border-b-2 font-medium text-sm",
                    selectedTab === 'contracts'
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-gray-300"
                  )}
                >
                  Contracts
                </button>
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          {selectedTab === 'transactions' && (
            <div className="bg-card rounded-lg border">
              <div className="p-6 border-b">
                <h2 className="text-lg font-semibold">Transaction History</h2>
              </div>
              <div className="divide-y">
                {txLoading ? (
                  <div className="p-8 text-center">
                    <div className="animate-pulse space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="h-16 bg-gray-200 rounded"></div>
                      ))}
                    </div>
                  </div>
                ) : transactions && transactions.length > 0 ? (
                  transactions.map((tx) => (
                    <div key={tx.id} className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <Link 
                              href={`/transactions/${tx.txHash}`}
                              className="font-mono text-sm text-primary hover:text-primary/80 truncate"
                            >
                              {formatAddress(tx.txHash, 8)}
                            </Link>
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs",
                              tx.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            )}>
                              {tx.success ? 'Success' : 'Failed'}
                            </span>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            <span className={cn(
                              "px-2 py-1 rounded text-xs font-medium",
                              getMessageCategory(tx.messageType) === 'bank' ? 'bg-blue-100 text-blue-700' :
                              getMessageCategory(tx.messageType) === 'tokenfactory' ? 'bg-purple-100 text-purple-700' :
                              getMessageCategory(tx.messageType) === 'staking' ? 'bg-green-100 text-green-700' :
                              'bg-gray-100 text-gray-700'
                            )}>
                              {formatMessageType(tx.messageType)}
                            </span>
                            {tx.memo && (
                              <span className="text-xs text-muted-foreground truncate">
                                {tx.memo}
                              </span>
                            )}
                          </div>
                        </div>
                        
                        <div className="text-right ml-4">
                          <div className="text-sm font-medium">
                            Block {formatBlockHeight(tx.height)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {formatTimestamp(tx.timestamp, true)}
                          </div>
                        </div>
                      </div>

                      {/* Transaction metadata preview */}
                      {tx.metadata && Object.keys(tx.metadata).length > 0 && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          {tx.messageType.includes('Send') && tx.metadata.amount && (
                            <span>
                              Amount: {tx.metadata.amount.map((amt: any) => 
                                formatTokenAmount(amt.amount, 6, amt.denom === 'umfx' ? 'MFX' : amt.denom)
                              ).join(', ')}
                            </span>
                          )}
                          {tx.metadata.toAddress && (
                            <span className="ml-3">
                              To: <Link 
                                href={`/addresses/${tx.metadata.toAddress}`}
                                className="text-primary hover:text-primary/80"
                              >
                                {formatAddress(tx.metadata.toAddress, 6)}
                              </Link>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground">
                    No transactions found for this address.
                  </div>
                )}
              </div>
            </div>
          )}

          {selectedTab === 'tokens' && (
            <div className="bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">Token balance tracking coming soon...</p>
            </div>
          )}

          {selectedTab === 'contracts' && (
            <div className="bg-card rounded-lg border p-8 text-center">
              <p className="text-muted-foreground">Contract verification and interaction coming soon...</p>
            </div>
          )}
        </main>
      </div>
    </>
  )
}