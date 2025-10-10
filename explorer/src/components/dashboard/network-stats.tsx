import { useLiveBlocks } from '@/lib/hooks/use-live-data.js'
import { trpc } from '@/lib/utils/trpc.js'
import { formatBlockHeight, formatTimestamp } from '@/lib/utils/index.js'
import { Activity, Clock, TrendingUp, Zap } from 'lucide-react'

export function NetworkStats() {
  const { latestBlock, recentBlocks, isConnected } = useLiveBlocks()
  const { data: blockStats } = trpc.blocks.getStats.useQuery()
  const { data: txStats } = trpc.transactions.getStats.useQuery()

  return (
    <div className="space-y-6">
      {/* Network Status Indicator */}
      <div className="bg-card rounded-lg border p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Network Status</h3>
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            <span className="text-sm text-muted-foreground">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
        </div>
        
        {latestBlock && (
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Latest Block</p>
              <p className="text-xl font-bold">{formatBlockHeight(latestBlock.height)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Transactions</p>
              <p className="text-xl font-bold">{latestBlock.txCount}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Block Time</p>
              <p className="text-xl font-bold">
                {blockStats ? `${(blockStats.avgBlockTimeMs / 1000).toFixed(1)}s` : '—'}
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Last Update</p>
              <p className="text-sm">{formatTimestamp(latestBlock.timestamp, true)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Overall Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-card rounded-lg p-6 border">
          <div className="flex items-center">
            <Activity className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-muted-foreground">Total Blocks</p>
              <p className="text-2xl font-bold">
                {blockStats ? formatBlockHeight(blockStats.totalBlocks) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-lg p-6 border">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-green-600" />
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
            <Zap className="h-8 w-8 text-purple-600" />
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

      {/* Recent Blocks */}
      {recentBlocks.length > 0 && (
        <div className="bg-card rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Recent Blocks (Live)</h3>
          </div>
          <div className="divide-y max-h-80 overflow-y-auto">
            {recentBlocks.map((block) => (
              <div key={block.height} className="p-4 hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">
                      #{formatBlockHeight(block.height)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {block.txCount} transactions
                    </div>
                    {isConnected && block.height === latestBlock?.height && (
                      <div className="flex items-center space-x-1">
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                        <span className="text-xs text-green-600 font-medium">NEW</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {formatTimestamp(block.timestamp, true)}
                    </div>
                    <div className="text-xs font-mono text-muted-foreground">
                      {block.blockHash.slice(0, 12)}...
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Message Type Distribution */}
      {txStats?.transactionTypes && (
        <div className="bg-card rounded-lg border">
          <div className="p-6 border-b">
            <h3 className="text-lg font-semibold">Transaction Type Distribution</h3>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {txStats.transactionTypes.filter(Boolean).map((type) => {
                const category = type.includes('bank') ? 'bank' :
                              type.includes('tokenfactory') ? 'tokenfactory' :
                              type.includes('staking') || type.includes('vesting') ? 'staking' :
                              type.includes('gov') || type.includes('group') ? 'governance' : 'other'
                
                const colors = {
                  bank: 'bg-blue-50 text-blue-900 border-blue-200',
                  tokenfactory: 'bg-purple-50 text-purple-900 border-purple-200',
                  staking: 'bg-green-50 text-green-900 border-green-200',
                  governance: 'bg-orange-50 text-orange-900 border-orange-200',
                  other: 'bg-gray-50 text-gray-900 border-gray-200'
                }

                return (
                  <div 
                    key={type}
                    className={`p-3 rounded-lg text-sm border ${colors[category]}`}
                  >
                    <div className="font-medium">
                      {type.split('.').pop()?.replace(/^Msg/, '') || type}
                    </div>
                    <div className="text-xs opacity-75 mt-1">
                      {type.includes('cosmos.bank') ? 'Token Transfer' :
                       type.includes('tokenfactory') ? 'Token Factory' :
                       type.includes('vesting') ? 'Vesting Account' :
                       type.includes('group') ? 'Group Governance' : 
                       'Other'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}