import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { apiService, type TransactionWithType } from '../../services/api.js'
import type { Block, ChainStats } from '../../types/blockchain.js'
import { formatDistanceToNow } from 'date-fns'
import '../common/loading-spinner.ts'
import '../common/error-message.ts'
import '../common/stats-card.ts'

@customElement('page-dashboard')
export class PageDashboard extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 1280px;
      margin: 0 auto;
    }

    .dashboard-grid {
      display: grid;
      gap: 2rem;
      margin-bottom: 2rem;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .stat-card {
      background: white;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
    }

    .stat-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .stat-icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }

    .stat-title {
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
    }

    .stat-value {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
    }

    .content-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
    }

    .section-card {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .section-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      display: flex;
      justify-content: between;
      align-items: center;
    }

    .section-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .section-content {
      padding: 1.5rem;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0.75rem;
      border-radius: 0.5rem;
      margin-bottom: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .item-row:hover {
      background-color: #f3f4f6;
    }

    .item-main {
      font-weight: 600;
      color: #3b82f6;
    }

    .item-sub {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .item-meta {
      text-align: right;
      font-size: 0.875rem;
      color: #6b7280;
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .content-grid {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: 1fr;
      }
    }
  `

  @state() private _stats: ChainStats | null = null
  @state() private _recentBlocks: Block[] = []
  @state() private _recentTransactions: TransactionWithType[] = []
  @state() private _loading = true
  @state() private _error: string | null = null

  connectedCallback() {
    super.connectedCallback()
    this._loadDashboardData()
    
    // Set up auto-refresh every 10 seconds
    setInterval(() => this._loadDashboardData(), 10000)
  }

  private async _loadDashboardData() {
    try {
      this._error = null
      
      const [stats, blocks, transactions] = await Promise.all([
        apiService.getChainStats(),
        apiService.getBlocks(5),
        apiService.getTransactions(5)
      ])

      this._stats = stats
      this._recentBlocks = blocks
      this._recentTransactions = transactions
    } catch (error) {
      this._error = `Failed to load dashboard data: ${error instanceof Error ? error.message : 'Unknown error'}`
    } finally {
      this._loading = false
    }
  }

  private _navigateToBlock(blockId: number) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/blocks/${blockId}` },
      bubbles: true,
      composed: true
    }))
  }

  private _navigateToTransaction(txId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/transactions/${txId}` },
      bubbles: true,
      composed: true
    }))
  }

  render() {
    if (this._loading) {
      return html`<loading-spinner></loading-spinner>`
    }

    if (this._error) {
      return html`<error-message .message=${this._error}></error-message>`
    }

    return html`
      <div class="dashboard-grid">
        <!-- Stats Grid -->
        <div class="stats-grid">
          <stats-card
            title="Latest Block"
            value="${this._stats?.latestBlock.toLocaleString() || '0'}"
            icon="📦"
            iconColor="#3b82f6"
            subtitle="Current blockchain height"
          ></stats-card>

          <stats-card
            title="Recent Transactions"
            value="${this._stats?.totalTransactions.toLocaleString() || '0'}"
            icon="📄"
            iconColor="#10b981"
            subtitle="Last 1000 transactions"
          ></stats-card>

          <stats-card
            title="Block Time"
            value="${this._stats?.avgBlockTime || 0}s"
            icon="⚡"
            iconColor="#8b5cf6"
            subtitle="Average time between blocks"
          ></stats-card>

          <stats-card
            title="Network"
            value="${this._stats?.chainId || 'Unknown'}"
            icon="🔗"
            iconColor="#f59e0b"
            subtitle="Chain identifier"
          ></stats-card>
        </div>

        <!-- Content Grid -->
        <div class="content-grid">
          <!-- Recent Blocks -->
          <div class="section-card">
            <div class="section-header">
              <h2 class="section-title">Recent Blocks</h2>
            </div>
            <div class="section-content">
              ${this._recentBlocks.map(block => html`
                <div 
                  class="item-row"
                  @click=${() => this._navigateToBlock(block.id)}
                >
                  <div>
                    <div class="item-main">Block #${block.id}</div>
                    <div class="item-sub">
                      ${block.data?.block?.data?.txs?.length || 0} transactions
                    </div>
                  </div>
                  <div class="item-meta">
                    ${formatDistanceToNow(new Date(block.data?.block?.header?.time || new Date()), { addSuffix: true })}
                  </div>
                </div>
              `)}
            </div>
          </div>

          <!-- Recent Transactions -->
          <div class="section-card">
            <div class="section-header">
              <h2 class="section-title">Recent Transactions</h2>
            </div>
            <div class="section-content">
              ${this._recentTransactions.map(tx => html`
                <div 
                  class="item-row"
                  @click=${() => this._navigateToTransaction(tx.id)}
                >
                  <div>
                    <div class="item-main">
                      ${tx.isEVMTransaction ? '⚡' : '🌌'} ${tx.id.substring(0, 12)}...
                    </div>
                    <div class="item-sub">
                      Height: ${tx.height.toLocaleString()} • ${tx.isEVMTransaction ? 'EVM' : 'Cosmos'}
                      ${tx.error ? ' • Failed' : ' • Success'}
                    </div>
                  </div>
                  <div class="item-meta">
                    ${formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                  </div>
                </div>
              `)}
            </div>
          </div>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-dashboard': PageDashboard
  }
}