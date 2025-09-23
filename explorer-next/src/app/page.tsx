'use client'

import { useQuery } from '@tanstack/react-query'
import Link from 'next/link'
import { ArrowRight, Blocks, Activity, TrendingUp, Users } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { YaciAPIClient } from '@/lib/api/client'
import { formatNumber, formatTimeAgo, formatHash, getTransactionStatus } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const api = new YaciAPIClient()

export default function DashboardPage() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['chainStats'],
    queryFn: () => api.getChainStats(),
    refetchInterval: 5000,
  })

  const { data: blocks, isLoading: blocksLoading } = useQuery({
    queryKey: ['latestBlocks'],
    queryFn: () => api.getBlocks(5, 0),
    refetchInterval: 2000,
  })

  const { data: transactions, isLoading: txLoading } = useQuery({
    queryKey: ['latestTransactions'],
    queryFn: () => api.getTransactions(5, 0),
    refetchInterval: 2000,
  })

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Latest Block</CardTitle>
            <Blocks className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(stats?.latest_block || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats?.avg_block_time}s avg block time
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transactions</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(stats?.total_transactions || 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(stats?.tps || 0, 2)} TPS
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Validators</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(stats?.active_validators || 0)}
            </div>
            <p className="text-xs text-muted-foreground">Active set</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Supply</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {statsLoading ? <Skeleton className="h-8 w-24" /> : formatNumber(stats?.total_supply || '0')}
            </div>
            <p className="text-xs text-muted-foreground">MFX</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* Latest Blocks */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest Blocks</CardTitle>
            <Link
              href="/blocks"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {blocksLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : (
                blocks?.data.map((block) => (
                  <div
                    key={block.id}
                    className="flex items-center justify-between py-3 border-b last:border-0"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Blocks className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <Link
                          href={`/blocks/${block.id}`}
                          className="font-medium hover:text-primary"
                        >
                          Block #{block.id}
                        </Link>
                        <div className="text-sm text-muted-foreground">
                          {formatTimeAgo(block.data.block.header.time)}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm">
                        {block.data.block.data.txs.length} txs
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatHash(block.data.block_id.hash, 6)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Latest Transactions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Latest Transactions</CardTitle>
            <Link
              href="/transactions"
              className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
            >
              View all <ArrowRight className="h-4 w-4" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {txLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))
              ) : (
                transactions?.data.map((tx) => {
                  const status = getTransactionStatus(tx.error)
                  return (
                    <div
                      key={tx.id}
                      className="flex items-center justify-between py-3 border-b last:border-0"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <Activity className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Link
                            href={`/transactions/${tx.id}`}
                            className="font-medium hover:text-primary"
                          >
                            {formatHash(tx.id, 8)}
                          </Link>
                          <div className="text-sm text-muted-foreground">
                            {formatTimeAgo(tx.timestamp)}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge
                          variant={tx.error ? 'destructive' : 'success'}
                          className="mb-1"
                        >
                          {status.label}
                        </Badge>
                        <div className="text-xs text-muted-foreground">
                          Block #{tx.height}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}