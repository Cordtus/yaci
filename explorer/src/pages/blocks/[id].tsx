import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/layout/header.js'
import { Button } from '@/components/ui/button.js'
import { trpc } from '@/lib/utils/trpc.js'
import { formatBlockHeight, formatTimestamp, formatAddress, cn } from '@/lib/utils/index.js'
import { ChevronLeft, ChevronRight, Copy, Eye, Code } from 'lucide-react'

export default function BlockDetail() {
  const router = useRouter()
  const { id } = router.query
  const [showRawData, setShowRawData] = useState(false)
  
  const { data: block, isLoading, error } = trpc.blocks.getByHeightOrHash.useQuery(
    { identifier: id as string },
    { enabled: !!id }
  )

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </main>
      </div>
    )
  }

  if (error || !block) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Block Not Found</h1>
            <p className="text-gray-600 mb-8">The requested block could not be found.</p>
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
        <title>Block {formatBlockHeight(block.height)} - Yaci Explorer</title>
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold">Block {formatBlockHeight(block.height)}</h1>
              <p className="text-muted-foreground mt-1">
                {formatTimestamp(block.timestamp)}
              </p>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push(`/blocks/${block.height - 1}`)}
                disabled={block.height <= 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => router.push(`/blocks/${block.height + 1}`)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Block Details */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <div className="bg-card rounded-lg border">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">Block Information</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Height</label>
                      <p className="text-lg font-mono">{formatBlockHeight(block.height)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Transactions</label>
                      <p className="text-lg">{block.txCount}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                      <p className="text-sm">{formatTimestamp(block.timestamp)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Chain ID</label>
                      <p className="text-sm font-mono">{block.chainId}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Block Hash</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-sm font-mono break-all">{block.blockHash}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(block.blockHash)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">App Hash</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-sm font-mono break-all">{block.appHash}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(block.appHash)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Proposer</label>
                    <div className="flex items-center space-x-2 mt-1">
                      <p className="text-sm font-mono">{formatAddress(block.proposer)}</p>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={() => copyToClipboard(block.proposer)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Raw Data */}
              <div className="mt-6 bg-card rounded-lg border">
                <div className="p-6 border-b">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold">Raw Block Data</h2>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowRawData(!showRawData)}
                    >
                      {showRawData ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                      {showRawData ? 'Hide' : 'Show'} Raw Data
                    </Button>
                  </div>
                </div>
                {showRawData && (
                  <div className="p-6">
                    <pre className="text-xs bg-gray-50 p-4 rounded overflow-auto max-h-96">
                      {JSON.stringify(block.rawData, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            </div>

            {/* Side Panel */}
            <div className="space-y-6">
              {/* Navigation */}
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Block Navigation</h3>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => router.push(`/blocks/${block.height - 1}`)}
                    disabled={block.height <= 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous Block
                  </Button>
                  <Button 
                    variant="outline" 
                    className="w-full justify-start"
                    onClick={() => router.push(`/blocks/${block.height + 1}`)}
                  >
                    <ChevronRight className="h-4 w-4 mr-2" />
                    Next Block
                  </Button>
                </div>
              </div>

              {/* Quick Stats */}
              {block.txCount > 0 && (
                <div className="bg-card rounded-lg border p-6">
                  <h3 className="font-semibold mb-4">Block Stats</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Transactions</span>
                      <span className="font-medium">{block.txCount}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size</span>
                      <span className="font-medium">—</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </>
  )
}