import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Activity, Filter, Check, X } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { YaciAPIClient } from '@/lib/api/client'
import { formatHash, formatTimeAgo, getTransactionStatus, getMessageTypeLabel, isEVMTransaction } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

const api = new YaciAPIClient()

export default function TransactionsPage() {
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'success' | 'failed'>('all')
  const limit = 20

  const { data, isLoading, error } = useQuery({
    queryKey: ['transactions', page, statusFilter],
    queryFn: () => api.getTransactions(
      limit,
      page * limit,
      statusFilter === 'all' ? {} : { status: statusFilter }
    ),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Transactions</h1>
          <p className="text-muted-foreground">
            Browse all transactions on the blockchain
          </p>
        </div>

        <div className="flex items-center gap-4">
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[180px]">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Transactions</SelectItem>
              <SelectItem value="success">Success Only</SelectItem>
              <SelectItem value="failed">Failed Only</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>
            Showing {data?.data.length || 0} transactions
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
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No transactions found
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

          {data && (
            <div className="flex items-center justify-between mt-6">
              <div className="text-sm text-muted-foreground">
                Page {page + 1}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={!data.pagination.has_prev}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data.pagination.has_next}
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
