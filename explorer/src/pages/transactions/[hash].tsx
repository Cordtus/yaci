import { useState } from 'react'
import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { Header } from '@/components/layout/header.js'
import { Button } from '@/components/ui/button.js'
import { trpc } from '@/lib/utils/trpc.js'
import { 
  formatAddress, formatTimestamp, formatTokenAmount, 
  formatMessageType, getMessageCategory, cn 
} from '@/lib/utils/index.js'
import { Copy, Eye, Code, ExternalLink, CheckCircle, XCircle } from 'lucide-react'

export default function TransactionDetail() {
  const router = useRouter()
  const { hash } = router.query
  const [showRawData, setShowRawData] = useState<{[key: number]: boolean}>({})
  
  const { data: transaction, isLoading, error } = trpc.transactions.getByHash.useQuery(
    { hash: hash as string },
    { enabled: !!hash }
  )

  if (isLoading) {
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

  if (error || !transaction) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold text-gray-900 mb-4">Transaction Not Found</h1>
            <p className="text-gray-600 mb-8">The requested transaction could not be found.</p>
            <Button onClick={() => router.back()}>Go Back</Button>
          </div>
        </main>
      </div>
    )
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  const toggleRawData = (messageIndex: number) => {
    setShowRawData(prev => ({
      ...prev,
      [messageIndex]: !prev[messageIndex]
    }))
  }

  return (
    <>
      <Head>
        <title>Transaction {formatAddress(transaction.txHash)} - Yaci Explorer</title>
      </Head>

      <div className="min-h-screen bg-background">
        <Header />
        
        <main className="container py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center space-x-3 mb-2">
              <h1 className="text-3xl font-bold">Transaction</h1>
              <div className={cn(
                "px-3 py-1 rounded-full text-sm font-medium",
                transaction.success 
                  ? "bg-green-100 text-green-800" 
                  : "bg-red-100 text-red-800"
              )}>
                {transaction.success ? (
                  <><CheckCircle className="h-4 w-4 inline mr-1" /> Success</>
                ) : (
                  <><XCircle className="h-4 w-4 inline mr-1" /> Failed</>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <p className="font-mono text-sm text-muted-foreground break-all">
                {transaction.txHash}
              </p>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => copyToClipboard(transaction.txHash)}
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              {/* Transaction Overview */}
              <div className="bg-card rounded-lg border">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">Transaction Overview</h2>
                </div>
                <div className="p-6 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Block Height</label>
                      <p className="text-lg">
                        <Link 
                          href={`/blocks/${transaction.height}`}
                          className="text-primary hover:text-primary/80"
                        >
                          {formatBlockHeight(transaction.height)}
                        </Link>
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Timestamp</label>
                      <p className="text-sm">{formatTimestamp(transaction.timestamp)}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Fee</label>
                      <p className="text-sm">
                        {transaction.fee?.amount?.map((fee: any, idx: number) => (
                          <span key={idx}>
                            {formatTokenAmount(fee.amount, 6, fee.denom === 'umfx' ? 'MFX' : fee.denom)}
                            {idx < transaction.fee.amount.length - 1 && ', '}
                          </span>
                        )) || '—'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Gas Limit</label>
                      <p className="text-sm">{transaction.fee?.gasLimit || '—'}</p>
                    </div>
                  </div>
                  
                  {transaction.memo && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Memo</label>
                      <p className="text-sm bg-gray-50 p-3 rounded font-mono">
                        {transaction.memo}
                      </p>
                    </div>
                  )}

                  {transaction.error && (
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Error</label>
                      <p className="text-sm bg-red-50 text-red-900 p-3 rounded">
                        {transaction.error}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div className="bg-card rounded-lg border">
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">
                    Messages ({transaction.messages.length})
                  </h2>
                </div>
                <div className="divide-y">
                  {transaction.messages.map((message, idx) => (
                    <div key={idx} className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <span className="text-sm text-muted-foreground">#{idx}</span>
                          <span className={cn(
                            "px-2 py-1 rounded text-xs font-medium",
                            getMessageCategory(message.type) === 'bank' ? 'bg-blue-100 text-blue-700' :
                            getMessageCategory(message.type) === 'tokenfactory' ? 'bg-purple-100 text-purple-700' :
                            getMessageCategory(message.type) === 'staking' ? 'bg-green-100 text-green-700' :
                            'bg-gray-100 text-gray-700'
                          )}>
                            {formatMessageType(message.type)}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => toggleRawData(idx)}
                        >
                          {showRawData[idx] ? <Eye className="h-4 w-4" /> : <Code className="h-4 w-4" />}
                          {showRawData[idx] ? 'Hide' : 'Show'} Raw
                        </Button>
                      </div>

                      <div className="space-y-3">
                        {message.sender && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Sender</label>
                            <div className="flex items-center space-x-2">
                              <Link 
                                href={`/addresses/${message.sender}`}
                                className="text-sm font-mono text-primary hover:text-primary/80"
                              >
                                {formatAddress(message.sender)}
                              </Link>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                onClick={() => copyToClipboard(message.sender)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}

                        {message.mentions && message.mentions.length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">
                              Addresses Mentioned ({message.mentions.length})
                            </label>
                            <div className="flex flex-wrap gap-2 mt-1">
                              {message.mentions.map((addr, addrIdx) => (
                                <Link 
                                  key={addrIdx}
                                  href={`/addresses/${addr}`}
                                  className="text-xs font-mono bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
                                >
                                  {formatAddress(addr, 4)}
                                </Link>
                              ))}
                            </div>
                          </div>
                        )}

                        {message.metadata && Object.keys(message.metadata).length > 0 && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Metadata</label>
                            <div className="mt-1 text-xs bg-gray-50 p-3 rounded">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(message.metadata, null, 2)}
                              </pre>
                            </div>
                          </div>
                        )}

                        {showRawData[idx] && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">Raw Message Data</label>
                            <div className="mt-1 text-xs bg-gray-50 p-3 rounded overflow-auto max-h-48">
                              <pre>{JSON.stringify(message.rawData, null, 2)}</pre>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Side Panel - Transaction Summary */}
            <div className="space-y-6">
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Summary</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={cn(
                      "font-medium",
                      transaction.success ? "text-green-600" : "text-red-600"
                    )}>
                      {transaction.success ? 'Success' : 'Failed'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Messages</span>
                    <span className="font-medium">{transaction.messages.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Block</span>
                    <Link 
                      href={`/blocks/${transaction.height}`}
                      className="font-medium text-primary hover:text-primary/80"
                    >
                      #{formatBlockHeight(transaction.height)}
                    </Link>
                  </div>
                </div>
              </div>

              {/* Related Links */}
              <div className="bg-card rounded-lg border p-6">
                <h3 className="font-semibold mb-4">Related</h3>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    className="w-full justify-start text-xs"
                    onClick={() => router.push(`/blocks/${transaction.height}`)}
                  >
                    <ExternalLink className="h-3 w-3 mr-2" />
                    View Block
                  </Button>
                  {transaction.messages[0]?.sender && (
                    <Button 
                      variant="outline" 
                      className="w-full justify-start text-xs"
                      onClick={() => router.push(`/addresses/${transaction.messages[0].sender}`)}
                    >
                      <ExternalLink className="h-3 w-3 mr-2" />
                      Sender Details
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  )
}