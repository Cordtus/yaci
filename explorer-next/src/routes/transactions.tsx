import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Activity, Filter, Check, X, Calendar, Layers } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { YaciAPIClient } from '@/lib/api/client'
import { formatHash, formatTimeAgo, getTransactionStatus, getMessageTypeLabel, isEVMTransaction } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const api = new YaciAPIClient()

// Common message types for the filter dropdown
const MESSAGE_TYPES = [
  { value: 'all', label: 'All Types' },
  { value: '/cosmos.bank.v1beta1.MsgSend', label: 'Bank Send' },
  { value: '/cosmos.staking.v1beta1.MsgDelegate', label: 'Delegate' },
  { value: '/cosmos.staking.v1beta1.MsgUndelegate', label: 'Undelegate' },
  { value: '/cosmos.staking.v1beta1.MsgBeginRedelegate', label: 'Redelegate' },
  { value: '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward', label: 'Claim Rewards' },
  { value: '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission', label: 'Claim Commission' },
  { value: '/cosmos.gov.v1beta1.MsgVote', label: 'Vote' },
  { value: '/ibc.applications.transfer.v1.MsgTransfer', label: 'IBC Transfer' },
  { value: '/cosmwasm.wasm.v1.MsgExecuteContract', label: 'Execute Contract' },
]

export default function TransactionsPage() {
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all')
  const [messageTypeFilter, setMessageTypeFilter] = useState<string>('all')
  const [blockFilter, setBlockFilter] = useState('')
  const [blockRangeMin, setBlockRangeMin] = useState('')
  const [blockRangeMax, setBlockRangeMax] = useState('')
  const [timeRangeMin, setTimeRangeMin] = useState('')
  const [timeRangeMax, setTimeRangeMax] = useState('')
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false)
  const limit = 20

  // Build filters object
  const buildFilters = () => {
    const filters: any = {}

    if (statusFilter !== 'all') {
      filters.status = statusFilter
    }

    // Block filters
    if (blockFilter) {
      const parsed = parseInt(blockFilter)
      if (!isNaN(parsed)) {
        filters.block_height = parsed
      }
    } else {
      if (blockRangeMin) {
        const parsed = parseInt(blockRangeMin)
        if (!isNaN(parsed)) {
          filters.block_height_min = parsed
        }
      }
      if (blockRangeMax) {
        const parsed = parseInt(blockRangeMax)
        if (!isNaN(parsed)) {
          filters.block_height_max = parsed
        }
      }
    }

    // Time range filters
    if (timeRangeMin) {
      filters.timestamp_min = new Date(timeRangeMin).toISOString()
    }
    if (timeRangeMax) {
      filters.timestamp_max = new Date(timeRangeMax).toISOString()
    }

    if (messageTypeFilter !== 'all') {
      filters.message_type = messageTypeFilter
    }

    return filters
  }

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', page, statusFilter, messageTypeFilter, blockFilter, blockRangeMin, blockRangeMax, timeRangeMin, timeRangeMax],
    queryFn: () => api.getTransactions(limit, page * limit, buildFilters()),
  })

  const handleClearFilters = () => {
    setStatusFilter('all')
    setMessageTypeFilter('all')
    setBlockFilter('')
    setBlockRangeMin('')
    setBlockRangeMax('')
    setTimeRangeMin('')
    setTimeRangeMax('')
    setPage(0)
  }

  const hasActiveFilters = statusFilter !== 'all' || messageTypeFilter !== 'all' || blockFilter || blockRangeMin || blockRangeMax || timeRangeMin || timeRangeMax

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            Browse and filter transactions on the blockchain
          </p>
        </div>
      </div>

      {/* Filters Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Filters</CardTitle>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters}>
                Clear All
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Basic Filters Row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={(v: any) => { setStatusFilter(v); setPage(0) }}>
                <SelectTrigger>
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="success">Success Only</SelectItem>
                  <SelectItem value="failed">Failed Only</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Message Type Filter */}
            <div className="space-y-2">
              <Label>Message Type</Label>
              <Select value={messageTypeFilter} onValueChange={(v) => { setMessageTypeFilter(v); setPage(0) }}>
                <SelectTrigger>
                  <Activity className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MESSAGE_TYPES.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Single Block Filter */}
            <div className="space-y-2">
              <Label>Block Height</Label>
              <Input
                type="number"
                placeholder="Enter block number"
                value={blockFilter}
                onChange={(e) => { setBlockFilter(e.target.value); setPage(0) }}
              />
            </div>
          </div>

          {/* Advanced Filters Toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
            className="w-full"
          >
            {showAdvancedFilters ? 'Hide' : 'Show'} Advanced Filters
          </Button>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="space-y-4 pt-4 border-t">
              {/* Block Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Layers className="h-4 w-4" />
                  Block Height Range
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="number"
                    placeholder="Min block"
                    value={blockRangeMin}
                    onChange={(e) => { setBlockRangeMin(e.target.value); setBlockFilter(''); setPage(0) }}
                    disabled={!!blockFilter}
                  />
                  <Input
                    type="number"
                    placeholder="Max block"
                    value={blockRangeMax}
                    onChange={(e) => { setBlockRangeMax(e.target.value); setBlockFilter(''); setPage(0) }}
                    disabled={!!blockFilter}
                  />
                </div>
                {blockFilter && (
                  <p className="text-xs text-muted-foreground">Clear single block filter to use range</p>
                )}
              </div>

              {/* Time Range */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Time Range
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    type="datetime-local"
                    value={timeRangeMin}
                    onChange={(e) => { setTimeRangeMin(e.target.value); setPage(0) }}
                  />
                  <Input
                    type="datetime-local"
                    value={timeRangeMax}
                    onChange={(e) => { setTimeRangeMax(e.target.value); setPage(0) }}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
          <CardDescription>
            {data ? `Showing ${data.data.length} of ${data.pagination.total.toLocaleString()} transactions` : 'Loading...'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Transaction Hash</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Block</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Fee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}>
                      <Skeleton className="h-12 w-full" />
                    </TableCell>
                  </TableRow>
                ))
              ) : error ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    Error loading transactions
                  </TableCell>
                </TableRow>
              ) : data?.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    No transactions found matching your filters
                  </TableCell>
                </TableRow>
              ) : (
                data?.data.map((tx) => {
                  const status = getTransactionStatus(tx.error)
                  const isEVM = isEVMTransaction(tx.messages)

                  return (
                    <TableRow key={tx.id}>
                      <TableCell>
                        <Link
                          to={`/transactions/${tx.id}`}
                          className="flex items-center gap-2 font-medium hover:text-primary"
                        >
                          <Activity className="h-4 w-4" />
                          <code className="text-xs">{formatHash(tx.id, 10)}</code>
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {isEVM && (
                            <Badge variant="outline" className="text-xs">
                              EVM
                            </Badge>
                          )}
                          <span className="text-sm">
                            {tx.messages.length > 0
                              ? getMessageTypeLabel(tx.messages[0].type || '')
                              : 'Unknown'}
                          </span>
                          {tx.messages.length > 1 && (
                            <Badge variant="secondary" className="text-xs">
                              +{tx.messages.length - 1}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/blocks/${tx.height}`}
                          className="text-sm hover:text-primary"
                        >
                          {tx.height}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="text-sm">{formatTimeAgo(tx.timestamp)}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={tx.error ? 'destructive' : 'success'}
                          className="flex items-center gap-1 w-fit"
                        >
                          {tx.error ? (
                            <X className="h-3 w-3" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">
                          {tx.fee?.amount?.[0]?.amount || '0'} {tx.fee?.amount?.[0]?.denom || ''}
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>

          {data && data.data.length > 0 && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {page + 1} of {Math.ceil(data.pagination.total / limit)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || isLoading}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.pagination.has_next || isLoading}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
