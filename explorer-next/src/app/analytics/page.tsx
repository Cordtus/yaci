'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { YaciAPIClient } from '@/lib/api/client'
import { Skeleton } from '@/components/ui/skeleton'
import { BarChart3, PieChart, Clock, TrendingUp } from 'lucide-react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { getMessageTypeLabel } from '@/lib/utils'

const api = new YaciAPIClient()

const COLORS = [
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#10b981', // green-500
  '#f59e0b', // orange-500
  '#ec4899', // pink-500
  '#06b6d4', // cyan-500
  '#6366f1', // indigo-500
  '#14b8a6', // teal-500
  '#f97316', // orange-600
  '#a855f7', // purple-600
]

export default function AnalyticsPage() {
  const [volumeTimeRange, setVolumeTimeRange] = useState<'24h' | '7d'>('7d')

  const { data: volumeData, isLoading: volumeLoading } = useQuery({
    queryKey: ['transactionVolume', volumeTimeRange],
    queryFn: () =>
      volumeTimeRange === '24h'
        ? api.getHourlyTransactionVolume(24)
        : api.getTransactionVolumeOverTime(7),
  })

  const { data: typeData, isLoading: typeLoading } = useQuery({
    queryKey: ['transactionTypes'],
    queryFn: () => api.getTransactionTypeDistribution(),
  })

  const { data: blockTimeData, isLoading: blockTimeLoading } = useQuery({
    queryKey: ['blockTimeAnalysis'],
    queryFn: () => api.getBlockTimeAnalysis(100),
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Insights and metrics from blockchain data
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
          <TabsTrigger value="blocks">Blocks</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Transaction Volume Over Time */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Transaction Volume
                  </CardTitle>
                  <CardDescription>
                    Number of transactions over time
                  </CardDescription>
                </div>
                <Select
                  value={volumeTimeRange}
                  onValueChange={(v: any) => setVolumeTimeRange(v)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="24h">Last 24 Hours</SelectItem>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {volumeLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : volumeData && volumeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={volumeData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey={volumeTimeRange === '24h' ? 'hour' : 'date'}
                      className="text-xs"
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      name="Transactions"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  No transaction data available
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Transaction Type Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Transaction Types
                </CardTitle>
                <CardDescription>
                  Distribution of transaction types
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typeLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : typeData && typeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <RechartsPieChart>
                      <Pie
                        data={typeData}
                        dataKey="count"
                        nameKey="type"
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        label={({ type }) => getMessageTypeLabel(type)}
                      >
                        {typeData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                        formatter={(value: any, name: string) => [
                          value,
                          getMessageTypeLabel(name),
                        ]}
                      />
                      <Legend
                        formatter={(value) => getMessageTypeLabel(value)}
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No transaction type data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Block Time Analysis */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Block Time Analysis
                </CardTitle>
                <CardDescription>
                  Block production time statistics
                </CardDescription>
              </CardHeader>
              <CardContent>
                {blockTimeLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : blockTimeData ? (
                  <div className="space-y-8 pt-8">
                    <div className="text-center">
                      <div className="text-5xl font-bold text-primary mb-2">
                        {blockTimeData.avg.toFixed(2)}s
                      </div>
                      <p className="text-sm text-muted-foreground">Average Block Time</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-green-500 mb-1">
                          {blockTimeData.min.toFixed(2)}s
                        </div>
                        <p className="text-xs text-muted-foreground">Minimum</p>
                      </div>
                      <div className="text-center p-4 border rounded-lg">
                        <div className="text-2xl font-bold text-orange-500 mb-1">
                          {blockTimeData.max.toFixed(2)}s
                        </div>
                        <p className="text-xs text-muted-foreground">Maximum</p>
                      </div>
                    </div>
                    <p className="text-xs text-center text-muted-foreground">
                      Based on last 100 blocks
                    </p>
                  </div>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    No block time data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="transactions" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Transaction Volume Bar Chart */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Transaction Volume (Bar Chart)
                </CardTitle>
                <CardDescription>
                  Daily transaction volume breakdown
                </CardDescription>
              </CardHeader>
              <CardContent>
                {volumeLoading ? (
                  <Skeleton className="h-[400px] w-full" />
                ) : volumeData && volumeData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={volumeData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey={volumeTimeRange === '24h' ? 'hour' : 'date'}
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                      />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="count" fill="#3b82f6" name="Transactions" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    No transaction data available
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Transaction Type Table */}
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>Transaction Type Breakdown</CardTitle>
                <CardDescription>
                  Detailed count of each transaction type
                </CardDescription>
              </CardHeader>
              <CardContent>
                {typeLoading ? (
                  <Skeleton className="h-[300px] w-full" />
                ) : typeData && typeData.length > 0 ? (
                  <div className="space-y-2">
                    {typeData.map((item, index) => (
                      <div
                        key={item.type}
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="h-4 w-4 rounded"
                            style={{ backgroundColor: COLORS[index % COLORS.length] }}
                          />
                          <span className="font-medium text-sm">
                            {getMessageTypeLabel(item.type)}
                          </span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{item.count.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            {((item.count / typeData.reduce((sum, t) => sum + t.count, 0)) * 100).toFixed(1)}%
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    No transaction type data available
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="blocks" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Block Performance Metrics</CardTitle>
              <CardDescription>
                Detailed analysis of block production
              </CardDescription>
            </CardHeader>
            <CardContent>
              {blockTimeLoading ? (
                <Skeleton className="h-[400px] w-full" />
              ) : blockTimeData ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-3 gap-6">
                    <div className="text-center p-6 border rounded-lg bg-muted/50">
                      <div className="text-4xl font-bold text-primary mb-2">
                        {blockTimeData.avg.toFixed(2)}s
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Average Block Time</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Mean time between blocks
                      </p>
                    </div>
                    <div className="text-center p-6 border rounded-lg bg-green-500/10">
                      <div className="text-4xl font-bold text-green-500 mb-2">
                        {blockTimeData.min.toFixed(2)}s
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Fastest Block</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Minimum observed time
                      </p>
                    </div>
                    <div className="text-center p-6 border rounded-lg bg-orange-500/10">
                      <div className="text-4xl font-bold text-orange-500 mb-2">
                        {blockTimeData.max.toFixed(2)}s
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">Slowest Block</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Maximum observed time
                      </p>
                    </div>
                  </div>

                  <div className="p-6 border rounded-lg bg-muted/30">
                    <h3 className="font-semibold mb-4">Analysis Details</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sample Size:</span>
                        <span className="font-medium">Last 100 blocks</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Time Range:</span>
                        <span className="font-medium">
                          ~{((blockTimeData.avg * 100) / 60).toFixed(1)} minutes
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Variance:</span>
                        <span className="font-medium">
                          {(blockTimeData.max - blockTimeData.min).toFixed(2)}s
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Expected Blocks/Hour:</span>
                        <span className="font-medium">
                          ~{Math.floor(3600 / blockTimeData.avg)} blocks
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                  No block data available
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
