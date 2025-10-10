import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { apiService, type TransactionWithType } from '../../services/api.js'
import { formatDistanceToNow } from 'date-fns'
import '../common/loading-spinner.ts'
import '../common/error-message.ts'
import '../common/message-type-icon.ts'
import '../common/transaction-filters.ts'

@customElement('page-transactions')
export class PageTransactions extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 1280px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
      margin-bottom: 0.5rem;
    }

    .page-subtitle {
      color: #6b7280;
      font-size: 1.125rem;
    }

    .transactions-container {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .transactions-table {
      width: 100%;
      border-collapse: collapse;
    }

    .table-header {
      background: #f9fafb;
      border-bottom: 1px solid #e5e7eb;
    }

    .table-header th {
      padding: 1rem;
      text-align: left;
      font-weight: 600;
      color: #374151;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .table-row {
      border-bottom: 1px solid #f3f4f6;
      cursor: pointer;
      transition: all 0.2s;
    }

    .table-row:hover {
      background-color: #f9fafb;
    }

    .table-row:last-child {
      border-bottom: none;
    }

    .table-cell {
      padding: 1rem;
      vertical-align: top;
    }

    .tx-hash {
      font-family: monospace;
      font-weight: 600;
      color: #3b82f6;
      font-size: 0.875rem;
    }

    .tx-status {
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .tx-status.success {
      background: #dcfce7;
      color: #166534;
    }

    .tx-status.error {
      background: #fef2f2;
      color: #dc2626;
    }

    .fee-amount {
      font-family: monospace;
      font-size: 0.875rem;
      color: #059669;
    }

    .tx-type-badge {
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      text-transform: uppercase;
    }

    .tx-type-evm {
      background: #ddd6fe;
      color: #6b21a8;
    }

    .tx-type-cosmos {
      background: #dbeafe;
      color: #1e40af;
    }

    .pagination {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f9fafb;
      border-top: 1px solid #e5e7eb;
    }

    .pagination-button {
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .pagination-button:hover:not(:disabled) {
      background: #2563eb;
    }

    .pagination-button:disabled {
      background: #d1d5db;
      cursor: not-allowed;
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .transactions-table {
        font-size: 0.875rem;
      }

      .table-header th:nth-child(n+5),
      .table-cell:nth-child(n+5) {
        display: none;
      }
    }
  `

  @state() private _transactions: TransactionWithType[] = []
  @state() private _loading = true
  @state() private _error: string | null = null
  @state() private _currentPage = 0
  @state() private _pageSize = 20
  @state() private _filters: any = {}

  connectedCallback() {
    super.connectedCallback()
    this._loadTransactions()
    
    // Listen for filter changes
    this.addEventListener('filters-changed', this._handleFiltersChanged)
  }

  private _handleFiltersChanged = (event: CustomEvent) => {
    this._filters = event.detail.filters
    this._currentPage = 0 // Reset to first page when filters change
    this._loadTransactions()
  }

  private async _loadTransactions() {
    try {
      this._loading = true
      this._error = null
      
      const offset = this._currentPage * this._pageSize
      this._transactions = await apiService.getTransactions(this._pageSize, offset, this._filters)
    } catch (error) {
      this._error = `Failed to load transactions: ${error instanceof Error ? error.message : 'Unknown error'}`
    } finally {
      this._loading = false
    }
  }

  private _navigateToTransaction(txId: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/transactions/${txId}` },
      bubbles: true,
      composed: true
    }))
  }

  private _previousPage() {
    if (this._currentPage > 0) {
      this._currentPage--
      this._loadTransactions()
    }
  }

  private _nextPage() {
    this._currentPage++
    this._loadTransactions()
  }

  private _formatFee(fee: any): string {
    if (!fee?.amount?.length) return '0'
    const amount = fee.amount[0]
    const value = parseFloat(amount.amount) / 1000000
    return `${value.toFixed(6)} ${amount.denom.replace('u', '').toUpperCase()}`
  }

  private _truncateHash(hash: string): string {
    return `${hash.substring(0, 8)}...${hash.substring(hash.length - 8)}`
  }

  render() {
    if (this._loading) {
      return html`<loading-spinner></loading-spinner>`
    }

    if (this._error) {
      return html`
        <error-message 
          .message=${this._error} 
          showRetry
          @retry=${this._loadTransactions}
        ></error-message>
      `
    }

    return html`
      <div class="page-header">
        <h1 class="page-title">Transactions</h1>
        <p class="page-subtitle">Recent transactions on the blockchain</p>
      </div>

      <transaction-filters></transaction-filters>

      <div class="transactions-container">
        <table class="transactions-table">
          <thead class="table-header">
            <tr>
              <th>Hash</th>
              <th>Type</th>
              <th>Height</th>
              <th>Status</th>
              <th>Fee</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${this._transactions.map(tx => html`
              <tr class="table-row" @click=${() => this._navigateToTransaction(tx.id)}>
                <td class="table-cell">
                  <div class="tx-hash">${this._truncateHash(tx.id)}</div>
                  ${tx.memo ? html`<div style="font-size: 0.75rem; color: #6b7280; margin-top: 0.25rem;">
                    ${tx.memo.length > 30 ? tx.memo.substring(0, 30) + '...' : tx.memo}
                  </div>` : ''}
                </td>
                <td class="table-cell">
                  ${tx.messageTypes && tx.messageTypes.length > 0 ? html`
                    <message-type-icon 
                      .messageType=${tx.messageTypes[0]} 
                      showLabel
                    ></message-type-icon>
                    ${tx.messageTypes.length > 1 ? html`
                      <span style="font-size: 0.75rem; color: #6b7280; margin-left: 0.5rem;">
                        +${tx.messageTypes.length - 1} more
                      </span>
                    ` : ''}
                  ` : html`
                    <span class="tx-type-badge tx-type-cosmos"> Cosmos</span>
                  `}
                </td>
                <td class="table-cell">
                  <strong>${tx.height.toLocaleString()}</strong>
                </td>
                <td class="table-cell">
                  <span class="tx-status ${tx.error ? 'error' : 'success'}">
                    ${tx.error ? 'Failed' : 'Success'}
                  </span>
                </td>
                <td class="table-cell">
                  <div class="fee-amount">${this._formatFee(tx.fee)}</div>
                </td>
                <td class="table-cell">
                  ${formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                </td>
              </tr>
            `)}
          </tbody>
        </table>

        <div class="pagination">
          <button 
            class="pagination-button" 
            ?disabled=${this._currentPage === 0}
            @click=${this._previousPage}
          >
            Previous
          </button>
          
          <span>Page ${this._currentPage + 1}</span>
          
          <button 
            class="pagination-button" 
            ?disabled=${this._transactions.length < this._pageSize}
            @click=${this._nextPage}
          >
            Next
          </button>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-transactions': PageTransactions
  }
}