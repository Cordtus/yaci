'use client'

import { useDenom } from '@/contexts/DenomContext'
import { formatNumber, formatHash } from '@/lib/utils'
import { Copy, ArrowRight, Coins, Users, Vote, Lock } from 'lucide-react'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

interface MessageMetadata {
  // Bank
  amount?: Array<{ denom: string; amount: string }>
  toAddress?: string
  fromAddress?: string

  // Staking
  delegatorAddress?: string
  validatorAddress?: string
  validatorSrcAddress?: string
  validatorDstAddress?: string

  // Distribution
  withdrawAddress?: string

  // Governance
  proposalId?: string
  voter?: string
  option?: string

  // IBC
  token?: { denom: string; amount: string }
  receiver?: string
  sender?: string
  sourceChannel?: string
  sourcePort?: string
  destinationChannel?: string
  destinationPort?: string

  // CosmWasm
  contract?: string
  msg?: string

  // Authz
  grantee?: string
  granter?: string
  msgs?: Array<any>
}

interface MessageDetailsProps {
  type: string
  metadata?: MessageMetadata
}

function formatDenom(amount: string, denom: string, getDenomDisplay: (d: string) => string): string {
  const num = parseInt(amount)
  if (isNaN(num)) return `${amount} ${denom}`

  // For micro denoms (6 decimals)
  if (denom.startsWith('u') || denom.startsWith('ibc/')) {
    const formatted = (num / 1_000_000).toFixed(6).replace(/\.?0+$/, '')
    const display = getDenomDisplay(denom)
    return `${formatted} ${display}`
  }
  // For atto denoms (18 decimals)
  if (denom.startsWith('a')) {
    const formatted = (num / 1e18).toFixed(6).replace(/\.?0+$/, '')
    const display = getDenomDisplay(denom)
    return `${formatted} ${display}`
  }

  return `${formatNumber(num)} ${getDenomDisplay(denom)}`
}

function DetailRow({ label, value, copyable, icon: Icon }: {
  label: string
  value: string
  copyable?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 bg-muted/30 rounded-lg">
      <div className="flex items-center gap-2 min-w-0">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground flex-shrink-0" />}
        <div className="min-w-0">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
            {label}
          </label>
          <p className="text-sm font-mono break-all mt-1">{value}</p>
        </div>
      </div>
      {copyable && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 flex-shrink-0"
          onClick={() => navigator.clipboard.writeText(value)}
        >
          <Copy className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}

export function MessageDetails({ type, metadata }: MessageDetailsProps) {
  const { getDenomDisplay } = useDenom()

  if (!metadata) return null

  // Bank Send
  if (type === '/cosmos.bank.v1beta1.MsgSend') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Token Transfer</span>
        </div>
        {metadata.fromAddress && (
          <DetailRow label="From" value={metadata.fromAddress} copyable icon={Users} />
        )}
        <div className="flex justify-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {metadata.toAddress && (
          <DetailRow label="To" value={metadata.toAddress} copyable icon={Users} />
        )}
        {metadata.amount && metadata.amount.length > 0 && (
          <div className="p-3 bg-primary/10 rounded-lg border border-primary/20">
            <label className="text-xs font-medium text-primary uppercase tracking-wider block mb-2">Amount</label>
            {metadata.amount.map((amt, idx) => (
              <div key={idx} className="text-lg font-bold text-primary">
                {formatDenom(amt.amount, amt.denom, getDenomDisplay)}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Staking - Delegate
  if (type === '/cosmos.staking.v1beta1.MsgDelegate') {
    const amount = metadata.amount
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-green-600" />
          <span className="text-sm font-semibold text-green-600">Delegate Tokens</span>
        </div>
        {metadata.delegatorAddress && (
          <DetailRow label="Delegator" value={metadata.delegatorAddress} copyable icon={Users} />
        )}
        <div className="flex justify-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {metadata.validatorAddress && (
          <DetailRow label="Validator" value={metadata.validatorAddress} copyable />
        )}
        {amount && (
          <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
            <label className="text-xs font-medium text-green-600 uppercase tracking-wider block mb-2">Staked Amount</label>
            <div className="text-lg font-bold text-green-600">
              {formatDenom(amount.amount, amount.denom, getDenomDisplay)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Staking - Undelegate
  if (type === '/cosmos.staking.v1beta1.MsgUndelegate') {
    const amount = metadata.amount
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-orange-600" />
          <span className="text-sm font-semibold text-orange-600">Undelegate Tokens</span>
        </div>
        {metadata.delegatorAddress && (
          <DetailRow label="Delegator" value={metadata.delegatorAddress} copyable icon={Users} />
        )}
        {metadata.validatorAddress && (
          <DetailRow label="Validator" value={metadata.validatorAddress} copyable />
        )}
        {amount && (
          <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
            <label className="text-xs font-medium text-orange-600 uppercase tracking-wider block mb-2">Unstaked Amount</label>
            <div className="text-lg font-bold text-orange-600">
              {formatDenom(amount.amount, amount.denom, getDenomDisplay)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Staking - Redelegate
  if (type === '/cosmos.staking.v1beta1.MsgBeginRedelegate') {
    const amount = metadata.amount
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Lock className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-600">Redelegate Tokens</span>
        </div>
        {metadata.delegatorAddress && (
          <DetailRow label="Delegator" value={metadata.delegatorAddress} copyable icon={Users} />
        )}
        {metadata.validatorSrcAddress && (
          <DetailRow label="From Validator" value={metadata.validatorSrcAddress} copyable />
        )}
        <div className="flex justify-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {metadata.validatorDstAddress && (
          <DetailRow label="To Validator" value={metadata.validatorDstAddress} copyable />
        )}
        {amount && (
          <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
            <label className="text-xs font-medium text-blue-600 uppercase tracking-wider block mb-2">Redelegated Amount</label>
            <div className="text-lg font-bold text-blue-600">
              {formatDenom(amount.amount, amount.denom, getDenomDisplay)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // Distribution - Withdraw Rewards
  if (type === '/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-600">Claim Staking Rewards</span>
        </div>
        {metadata.delegatorAddress && (
          <DetailRow label="Delegator" value={metadata.delegatorAddress} copyable icon={Users} />
        )}
        {metadata.validatorAddress && (
          <DetailRow label="Validator" value={metadata.validatorAddress} copyable />
        )}
      </div>
    )
  }

  // Distribution - Withdraw Commission
  if (type === '/cosmos.distribution.v1beta1.MsgWithdrawValidatorCommission') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Coins className="h-4 w-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-600">Claim Validator Commission</span>
        </div>
        {metadata.validatorAddress && (
          <DetailRow label="Validator" value={metadata.validatorAddress} copyable />
        )}
      </div>
    )
  }

  // Governance - Vote
  if (type === '/cosmos.gov.v1beta1.MsgVote' || type === '/cosmos.gov.v1.MsgVote') {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Vote className="h-4 w-4 text-indigo-600" />
          <span className="text-sm font-semibold text-indigo-600">Governance Vote</span>
        </div>
        {metadata.proposalId && (
          <div className="p-3 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <label className="text-xs font-medium text-indigo-600 uppercase tracking-wider block mb-2">Proposal ID</label>
            <div className="text-lg font-bold text-indigo-600">#{metadata.proposalId}</div>
          </div>
        )}
        {metadata.voter && (
          <DetailRow label="Voter" value={metadata.voter} copyable icon={Users} />
        )}
        {metadata.option && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Vote</label>
            <Badge variant="outline" className="text-sm">{metadata.option}</Badge>
          </div>
        )}
      </div>
    )
  }

  // IBC Transfer
  if (type === '/ibc.applications.transfer.v1.MsgTransfer') {
    const token = metadata.token
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <ArrowRight className="h-4 w-4 text-cyan-600" />
          <span className="text-sm font-semibold text-cyan-600">IBC Transfer</span>
        </div>
        {metadata.sender && (
          <DetailRow label="Sender" value={metadata.sender} copyable icon={Users} />
        )}
        <div className="flex justify-center">
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </div>
        {metadata.receiver && (
          <DetailRow label="Receiver" value={metadata.receiver} copyable icon={Users} />
        )}
        {metadata.sourceChannel && (
          <DetailRow label="Channel" value={`${metadata.sourcePort}/${metadata.sourceChannel}`} />
        )}
        {token && (
          <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20">
            <label className="text-xs font-medium text-cyan-600 uppercase tracking-wider block mb-2">Amount</label>
            <div className="text-lg font-bold text-cyan-600">
              {formatDenom(token.amount, token.denom, getDenomDisplay)}
            </div>
          </div>
        )}
      </div>
    )
  }

  // CosmWasm - Execute Contract
  if (type === '/cosmwasm.wasm.v1.MsgExecuteContract') {
    let decodedMsg = null
    if (metadata.msg) {
      try {
        const decoded = atob(metadata.msg)
        decodedMsg = JSON.parse(decoded)
      } catch (e) {
        // Ignore decode errors
      }
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Code className="h-4 w-4 text-teal-600" />
          <span className="text-sm font-semibold text-teal-600">Execute Smart Contract</span>
        </div>
        {metadata.contract && (
          <DetailRow label="Contract" value={metadata.contract} copyable />
        )}
        {decodedMsg && (
          <div className="p-3 bg-muted/30 rounded-lg">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider block mb-2">Contract Message</label>
            <pre className="text-xs font-mono overflow-auto max-h-32 mt-1">
              {JSON.stringify(decodedMsg, null, 2)}
            </pre>
          </div>
        )}
      </div>
    )
  }

  // Authz - Execute
  if (type === '/cosmos.authz.v1beta1.MsgExec') {
    const innerMsgs = metadata.msgs || []
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-pink-600" />
          <span className="text-sm font-semibold text-pink-600">Execute Authorized Action</span>
        </div>
        {metadata.grantee && (
          <DetailRow label="Grantee (Executor)" value={metadata.grantee} copyable icon={Users} />
        )}
        {innerMsgs.length > 0 && (
          <div className="p-3 bg-pink-500/10 rounded-lg border border-pink-500/20">
            <label className="text-xs font-medium text-pink-600 uppercase tracking-wider block mb-2">
              Executing {innerMsgs.length} Authorized {innerMsgs.length === 1 ? 'Message' : 'Messages'}
            </label>
            {innerMsgs.map((msg: any, idx: number) => (
              <Badge key={idx} variant="outline" className="mr-2 mt-1">
                {msg['@type']?.split('.').pop() || 'Unknown'}
              </Badge>
            ))}
          </div>
        )}
      </div>
    )
  }

  return null
}

function Code({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  )
}
