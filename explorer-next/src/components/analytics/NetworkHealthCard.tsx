import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { getNetworkHealth } from '@/lib/api/prometheus'

export function NetworkHealthCard() {
  const { data: health, isLoading } = useQuery({
    queryKey: ['network-health'],
    queryFn: () => getNetworkHealth(),
    refetchInterval: 6000, // Poll every 6 seconds (typical block time)
  })

  if (isLoading || !health) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Network Health</CardTitle>
          <CardDescription>Real-time network status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground">Loading...</div>
        </CardContent>
      </Card>
    )
  }

  const healthScore =
    health.byzantineValidators === 0 && health.missingValidators === 0 ? 100 : 75

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Network Health
          {healthScore === 100 ? (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          ) : healthScore >= 75 ? (
            <AlertCircle className="h-5 w-5 text-yellow-500" />
          ) : (
            <XCircle className="h-5 w-5 text-red-500" />
          )}
        </CardTitle>
        <CardDescription>Real-time consensus metrics from Prometheus</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <div>
            <div className="text-2xl font-bold">{health.validators}</div>
            <div className="text-sm text-muted-foreground">Active Validators</div>
          </div>

          <div>
            <div className="text-2xl font-bold">{health.height.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Current Height</div>
          </div>

          <div>
            <div className="text-2xl font-bold">
              {health.blockInterval.toFixed(2)}s
            </div>
            <div className="text-sm text-muted-foreground">Block Interval</div>
          </div>

          <div>
            <div className="text-2xl font-bold">{health.mempoolSize}</div>
            <div className="text-sm text-muted-foreground">Mempool Size</div>
          </div>

          <div>
            <div className="text-2xl font-bold">{health.peers}</div>
            <div className="text-sm text-muted-foreground">Connected Peers</div>
          </div>

          <div>
            <div className="text-2xl font-bold text-red-500">
              {health.byzantineValidators}
            </div>
            <div className="text-sm text-muted-foreground">Byzantine</div>
          </div>

          {health.missingValidators > 0 && (
            <div>
              <div className="text-2xl font-bold text-yellow-500">
                {health.missingValidators}
              </div>
              <div className="text-sm text-muted-foreground">Missing</div>
            </div>
          )}

          <div>
            <div className="text-2xl font-bold">{health.rounds}</div>
            <div className="text-sm text-muted-foreground">Consensus Rounds</div>
          </div>

          <div>
            <div className="text-2xl font-bold">
              {(health.blockSize / 1024).toFixed(1)}KB
            </div>
            <div className="text-sm text-muted-foreground">Latest Block Size</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
