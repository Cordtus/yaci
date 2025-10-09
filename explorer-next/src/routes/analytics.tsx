import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Activity, DollarSign, Zap } from 'lucide-react'
import { NetworkHealthCard } from '@/components/analytics/NetworkHealthCard'
import { BlockIntervalChart } from '@/components/analytics/BlockIntervalChart'
import { FeeRevenueChart } from '@/components/analytics/FeeRevenueChart'
import { GasEfficiencyChart } from '@/components/analytics/GasEfficiencyChart'

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Comprehensive insights combining database and Prometheus metrics
          </p>
        </div>
      </div>

      <Tabs defaultValue="network" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="network" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Network Health
          </TabsTrigger>
          <TabsTrigger value="economics" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Economics
          </TabsTrigger>
          <TabsTrigger value="performance" className="flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Performance
          </TabsTrigger>
        </TabsList>

        {/* Network Health Tab */}
        <TabsContent value="network" className="space-y-6">
          <NetworkHealthCard />
          <BlockIntervalChart />
        </TabsContent>

        {/* Transaction Economics Tab */}
        <TabsContent value="economics" className="space-y-6">
          <FeeRevenueChart days={7} />
          <GasEfficiencyChart />
        </TabsContent>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            <BlockIntervalChart />
            <GasEfficiencyChart />
          </div>
          <NetworkHealthCard />
        </TabsContent>
      </Tabs>
    </div>
  )
}
