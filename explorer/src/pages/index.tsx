import Head from 'next/head'
import Link from 'next/link'
import { Header } from '@/components/layout/header.js'
import { trpc } from '@/lib/utils/trpc.js'
import { formatBlockHeight, formatTimestamp, formatAddress, formatMessageType, getMessageCategory } from '@/lib/utils/index.js'
import { Clock, Blocks, Activity, TrendingUp } from 'lucide-react'

export default function Home() {
  const { data: blockStats } = trpc.blocks.getStats.useQuery()
  const { data: txStats } = trpc.transactions.getStats.useQuery()
  const { data: latestBlocks } = trpc.blocks.getLatest.useQuery({ limit: 5 })
  const { data: latestTxs } = trpc.transactions.getLatest.useQuery({ limit: 5 })

  return (
    <>
      <Head>
        <title>Yaci Explorer - Blockchain Explorer</title>
        <meta name="description" content="Comprehensive blockchain explorer powered by Yaci indexer" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8">
          {/* Hero Section */}
          <div className="text-center py-12">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
              Yaci Explorer
            </h1>
            <p className="mt-6 text-lg leading-8 text-gray-600 max-w-2xl mx-auto">
              Comprehensive blockchain explorer for Cosmos and EVM-compatible chains.
              Real-time indexing and advanced transaction analysis.
            </p>
          </div>

          {/* Network Statistics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <Blocks className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Latest Block</p>
                  <p className="text-2xl font-bold">
                    {blockStats ? formatBlockHeight(blockStats.latestHeight) : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <Activity className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Total Transactions</p>
                  <p className="text-2xl font-bold">
                    {txStats ? txStats.totalTransactions.toLocaleString() : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Avg Block Time</p>
                  <p className="text-2xl font-bold">
                    {blockStats ? `${(blockStats.avgBlockTimeMs / 1000).toFixed(1)}s` : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-lg p-6 border">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-muted-foreground">Success Rate</p>
                  <p className="text-2xl font-bold">
                    {txStats && txStats.totalTransactions > 0 
                      ? `${((txStats.successfulTransactions / txStats.totalTransactions) * 100).toFixed(1)}%`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Latest Blocks and Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Latest Blocks */}
            <div className="bg-card rounded-lg border">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Latest Blocks</h2>
                  <Link 
                    href="/blocks" 
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    View all →
                  </Link>
                </div>
              </div>
              <div className="divide-y">
                {latestBlocks?.map((block) => (
                  <div key={block.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                          {formatBlockHeight(block.height)}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {block.txCount} txs
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(block.timestamp, true)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatAddress(block.blockHash)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest Transactions */}
            <div className="bg-card rounded-lg border">
              <div className="p-6 border-b">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Latest Transactions</h2>
                  <Link 
                    href="/transactions" 
                    className="text-sm text-primary hover:text-primary/80"
                  >
                    View all →
                  </Link>
                </div>
              </div>
              <div className="divide-y">
                {latestTxs?.map((tx) => (
                  <div key={tx.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <Link 
                            href={`/transactions/${tx.txHash}`}
                            className="font-mono text-sm text-primary hover:text-primary/80 truncate"
                          >
                            {formatAddress(tx.txHash, 6)}
                          </Link>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            tx.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {tx.success ? 'Success' : 'Failed'}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                          {tx.messageTypes?.map((type, idx) => (
                            <span key={idx} className={`px-2 py-1 rounded text-xs ${
                              getMessageCategory(type) === 'bank' ? 'bg-blue-100 text-blue-700' :
                              getMessageCategory(type) === 'tokenfactory' ? 'bg-purple-100 text-purple-700' :
                              'bg-gray-100 text-gray-700'
                            }`}>
                              {formatMessageType(type)}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="text-right ml-4">
                        <div className="text-sm text-muted-foreground">
                          Block {formatBlockHeight(tx.height)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(tx.timestamp, true)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Transaction Types Overview */}
          {txStats?.transactionTypes && (
            <div className="mt-8 bg-card rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4">Transaction Types</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {txStats.transactionTypes.filter(Boolean).map((type) => (
                  <div 
                    key={type}
                    className={`p-3 rounded-lg text-sm ${
                      getMessageCategory(type) === 'bank' ? 'bg-blue-50 text-blue-900 border-blue-200' :
                      getMessageCategory(type) === 'tokenfactory' ? 'bg-purple-50 text-purple-900 border-purple-200' :
                      getMessageCategory(type) === 'staking' ? 'bg-green-50 text-green-900 border-green-200' :
                      'bg-gray-50 text-gray-900 border-gray-200'
                    } border`}
                  >
                    {formatMessageType(type)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  )
}