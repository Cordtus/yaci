import Head from 'next/head'
import Link from 'next/link'
import { useState } from 'react'
import { Header } from '@/components/layout/header.js'
import { Button } from '@/components/ui/button.js'
import { NetworkStats } from '@/components/dashboard/network-stats.js'
import { trpc } from '@/lib/utils/trpc.js'
import { formatBlockHeight, formatTimestamp, formatAddress } from '@/lib/utils/index.js'
import { ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react'

export default function BlocksPage() {
  const [currentPage, setCurrentPage] = useState(0)
  const limit = 20

  const { data: blocks, isLoading, refetch, isRefetching } = trpc.blocks.getLatest.useQuery({
    limit,
    offset: currentPage * limit,
  })

  const { data: stats } = trpc.blocks.getStats.useQuery()

  const handlePreviousPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (stats && currentPage < Math.ceil(stats.totalBlocks / limit) - 1) {
      setCurrentPage(currentPage + 1)
    }
  }

  return (
    <>
      <Head>
        <title>Blocks - Yaci Explorer</title>
        <meta name="description" content="Browse all blocks on the blockchain" />
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Blocks</h1>
              <p className="text-muted-foreground mt-1">
                {stats ? `${stats.totalBlocks.toLocaleString()} total blocks` : 'Loading...'}
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

          {/* Network Stats */}
          <div className="mb-8">
            <NetworkStats />
          </div>

          {/* Blocks Table */}
          <div className="bg-card rounded-lg border">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Block List</h2>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage + 1} of {stats ? Math.ceil(stats.totalBlocks / limit) : '—'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePreviousPage}
                    disabled={currentPage === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleNextPage}
                    disabled={!stats || currentPage >= Math.ceil(stats.totalBlocks / limit) - 1}
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
                    <div key={i} className="h-16 bg-gray-200 rounded"></div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="divide-y">
                {blocks?.map((block) => (
                  <div key={block.id} className="p-4 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex-shrink-0">
                          <Link 
                            href={`/blocks/${block.height}`}
                            className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-medium hover:bg-blue-200 transition-colors"
                          >
                            {formatBlockHeight(block.height)}
                          </Link>
                        </div>
                        
                        <div className="min-w-0">
                          <div className="flex items-center space-x-2 mb-1">
                            <span className="text-sm font-medium">
                              {block.txCount} transactions
                            </span>
                            {block.txCount === 0 && (
                              <span className="text-xs text-muted-foreground bg-gray-100 px-2 py-0.5 rounded">
                                Empty
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground font-mono">
                            Hash: {formatAddress(block.blockHash, 8)}
                          </div>
                        </div>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm text-muted-foreground">
                          {formatTimestamp(block.timestamp, true)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatTimestamp(block.timestamp)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
              Page {currentPage + 1} of {stats ? Math.ceil(stats.totalBlocks / limit) : '—'}
            </span>
            
            <Button
              variant="outline"
              onClick={handleNextPage}
              disabled={!stats || currentPage >= Math.ceil(stats.totalBlocks / limit) - 1}
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