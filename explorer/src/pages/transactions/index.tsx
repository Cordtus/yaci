import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { Header } from '@/components/layout/header.js'
import { Button } from '@/components/ui/button.js'
import { trpc } from '@/lib/utils/trpc.js'
import { 
  formatAddress, formatTimestamp, formatBlockHeight, 
  formatMessageType, getMessageCategory, cn 
} from '@/lib/utils/index.js'
import { ChevronLeft, ChevronRight, RefreshCw, CheckCircle, XCircle } from 'lucide-react'

export default function TransactionsPage() {
  const [currentPage, setCurrentPage] = useState(0)
  const limit = 20

  const { data: transactions, isLoading, refetch, isRefetching } = trpc.transactions.getLatest.useQuery({
    limit,
    offset: currentPage * limit,
  })

  const { data: stats } = trpc.transactions.getStats.useQuery()

  return (
    <>
      <Head>
        <title>Transactions - Yaci Explorer</title>
        <meta name="description" content="Browse all transactions on the blockchain" />
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Transactions</h1>
              <p className="text-muted-foreground mt-1">
                {stats ? `${stats.totalTransactions.toLocaleString()} total transactions` : 'Loading...'}
              </p>
            </div>
            
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isRefetching}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>

          {/* Stats Summary */}
          {stats && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-card rounded-lg p-4 border text-center">
                <p className="text-2xl font-bold">{stats.totalTransactions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Total Transactions</p>
              </div>
              <div className="bg-card rounded-lg p-4 border text-center">
                <p className="text-2xl font-bold text-green-600">{stats.successfulTransactions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Successful</p>
              </div>
              <div className="bg-card rounded-lg p-4 border text-center">
                <p className="text-2xl font-bold">{stats.blocksWithTransactions.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">Blocks with Txs</p>
              </div>
              <div className="bg-card rounded-lg p-4 border text-center">
                <p className="text-2xl font-bold">
                  {stats.totalTransactions > 0 
                    ? `${((stats.successfulTransactions / stats.totalTransactions) * 100).toFixed(1)}%`
                    : '—'}
                </p>
                <p className="text-sm text-muted-foreground">Success Rate</p>
              </div>
            </div>
          )}

          {/* Transactions Table */}
          <div className="bg-card rounded-lg border">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Recent Transactions</h2>
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(Math.max(0, currentPage - 1))}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage + 1}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(currentPage + 1)}
                    disabled={!transactions || transactions.length < limit}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
            
            {isLoading ? (
              <div className="p-8">
                <div className="animate-pulse space-y-4">
                  {Array.from({ length: limit }).map((_, i) => (
                    <div key={i} className="h-20 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {transactions?.map((tx) => (
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
                          <div className="flex items-center space-x-1">
                            {tx.success ? (
                              <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                              <XCircle className="h-4 w-4 text-red-600" />
                            )}
                            <span className={cn(
                              "px-2 py-0.5 rounded text-xs font-medium",
                              tx.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                            )}>
                              {tx.success ? 'Success' : 'Failed'}
                            </span>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-sm text-muted-foreground">
                            {tx.messageCount} message{tx.messageCount !== 1 ? 's' : ''}
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {tx.messageTypes?.slice(0, 3).map((type, idx) => (
                              <span 
                                key={idx}
                                className={cn(
                                  "px-2 py-0.5 rounded text-xs font-medium",
                                  getMessageCategory(type) === 'bank' ? 'bg-blue-100 text-blue-700' :
                                  getMessageCategory(type) === 'tokenfactory' ? 'bg-purple-100 text-purple-700' :
                                  getMessageCategory(type) === 'staking' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                )}
                              >
                                {formatMessageType(type)}
                              </span>
                            ))}
                            {tx.messageTypes && tx.messageTypes.length > 3 && (
                              <span className="text-xs text-muted-foreground">
                                +{tx.messageTypes.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>

                        {tx.memo && (
                          <div className="text-xs text-muted-foreground bg-gray-50 px-2 py-1 rounded">
                            {tx.memo}
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right ml-4 flex-shrink-0">
                        <div className="text-sm font-medium mb-1">
                          <Link 
                            href={`/blocks/${tx.height}`}
                            className="text-primary hover:text-primary/80"
                          >
                            Block {formatBlockHeight(tx.height)}
                          </Link>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(tx.timestamp, true)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(tx.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                )) || []}
                
                {transactions && transactions.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground">
                    No transactions found.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-center space-x-2 mt-6">
            <Button
              variant="outline"
              onClick={handlePreviousPage}
              disabled={currentPage === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            
            <span className="text-sm text-muted-foreground px-4">
              Page {currentPage + 1} {stats && `of ${Math.ceil(stats.totalTransactions / limit)}`}
            </span>
            
            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={!transactions || transactions.length < limit}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </main>
      </div>
    </>
  )
}