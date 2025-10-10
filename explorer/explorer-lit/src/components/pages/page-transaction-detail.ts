import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { apiService } from '../../services/api.js'
import type { Transaction, Message } from '../../types/blockchain.js'
import '../common/loading-spinner.ts'
import '../common/error-message.ts'
import '../common/json-viewer.ts'
import '../common/message-type-icon.ts'

@customElement('page-transaction-detail')
export class PageTransactionDetail extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      max-width: 1280px;
      margin: 0 auto;
    }

    .page-header {
      margin-bottom: 2rem;
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .back-button {
      background: #f3f4f6;
      border: none;
      border-radius: 0.375rem;
      padding: 0.5rem;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .back-button:hover {
      background: #e5e7eb;
    }

    .page-title {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
    }

    .details-grid {
      display: grid;
      gap: 2rem;
    }

    .info-card {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .card-header {
      padding: 1.5rem;
      border-bottom: 1px solid #e5e7eb;
      background: #f9fafb;
    }

    .card-title {
      font-size: 1.25rem;
      font-weight: 600;
      color: #111827;
    }

    .card-content {
      padding: 1.5rem;
    }

    .info-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
    }

    .info-item {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .info-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .info-value {
      font-size: 1rem;
      color: #111827;
      word-break: break-all;
    }

    .hash-value {
      font-family: monospace;
      font-size: 0.875rem;
      background: #f3f4f6;
      padding: 0.5rem;
      border-radius: 0.375rem;
      border: 1px solid #e5e7eb;
    }

    .status-badge {
      padding: 0.25rem 0.75rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 500;
      width: fit-content;
    }

    .status-success {
      background: #dcfce7;
      color: #166534;
    }

    .status-error {
      background: #fef2f2;
      color: #dc2626;
    }

    .messages-list {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message-card {
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
    }

    .message-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 0.75rem;
    }

    .message-type {
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      font-weight: 500;
    }

    .message-type.cosmos {
      background: #dbeafe;
      color: #1e40af;
    }

    .message-type.evm {
      background: #ddd6fe;
      color: #6b21a8;
    }

    .message-index {
      font-size: 0.875rem;
      color: #6b7280;
    }

    .message-details {
      display: grid;
      gap: 1rem;
      margin-top: 1rem;
    }

    .message-field {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
    }

    .field-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: #374151;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .field-value {
      font-size: 0.875rem;
      color: #111827;
    }

    .address-value {
      font-family: monospace;
      background: #f3f4f6;
      padding: 0.5rem;
      border-radius: 0.25rem;
      word-break: break-all;
    }

    .json-viewer {
      background: #1f2937;
      color: #f9fafb;
      padding: 1.5rem;
      border-radius: 0.5rem;
      font-family: monospace;
      font-size: 0.875rem;
      overflow-x: auto;
      white-space: pre;
    }

    @media (max-width: 768px) {
      :host {
        padding: 1rem;
      }

      .info-grid {
        grid-template-columns: 1fr;
      }
    }
  `

  @property({ type: String }) transactionId!: string

  @state() private _transactionData: { raw: any; main: Transaction; messages: Message[] } | null = null
  @state() private _loading = true
  @state() private _error: string | null = null

  connectedCallback() {
    super.connectedCallback()
    this._loadTransaction()
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('transactionId')) {
      this._loadTransaction()
    }
  }

  private async _loadTransaction() {
    try {
      this._loading = true
      this._error = null
      
      this._transactionData = await apiService.getTransaction(this.transactionId)
    } catch (error) {
      this._error = `Failed to load transaction: ${error instanceof Error ? error.message : 'Unknown error'}`
    } finally {
      this._loading = false
    }
  }

  private _goBack() {
    window.history.back()
  }

  private _navigateToBlock(height: number) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path: `/blocks/${height}` },
      bubbles: true,
      composed: true
    }))
  }

  private _formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  private _formatFee(fee: any): string {
    if (!fee?.amount?.length) return '0'
    const amount = fee.amount[0]
    const value = parseFloat(amount.amount) / 1000000
    return `${value.toFixed(6)} ${amount.denom.replace('u', '').toUpperCase()}`
  }

  private _getMessageTypeDisplay(type: string): string {
    const parts = type.split('.')
    return parts[parts.length - 1] || type
  }

  private _isEVMMessage(type: string): boolean {
    return type?.includes('ethermint.evm.v1.MsgEthereumTx') || false
  }

  private _formatMessageMetadata(metadata: any, type: string): any {
    if (!metadata || Object.keys(metadata).length === 0) {
      return null
    }

    // Format based on message type
    if (type.includes('MsgSend')) {
      return {
        'To Address': metadata.toAddress,
        'Amount': metadata.amount?.map((a: any) => `${a.amount} ${a.denom}`).join(', ')
      }
    }

    if (type.includes('MsgDelegate')) {
      return {
        'Validator Address': metadata.validatorAddress,
        'Amount': metadata.amount ? `${metadata.amount.amount} ${metadata.amount.denom}` : 'N/A'
      }
    }

    return metadata
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
          @retry=${this._loadTransaction}
        ></error-message>
      `
    }

    if (!this._transactionData) {
      return html`<error-message message="Transaction not found"></error-message>`
    }

    const { main, messages, raw } = this._transactionData

    return html`
      <div class="page-header">
        <button class="back-button" @click=${this._goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="page-title">Transaction Details</h1>
      </div>

      <div class="details-grid">
        <!-- Transaction Summary -->
        <div class="info-card">
          <div class="card-header">
            <h2 class="card-title">Transaction Summary</h2>
          </div>
          <div class="card-content">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Hash</div>
                <div class="hash-value">${main.id}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Block Height</div>
                <div class="info-value">
                  <button 
                    style="background: none; border: none; color: #3b82f6; cursor: pointer; font-size: inherit;"
                    @click=${() => this._navigateToBlock(main.height)}
                  >
                    ${main.height.toLocaleString()}
                  </button>
                </div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Status</div>
                <div class="status-badge ${main.error ? 'status-error' : 'status-success'}">
                  ${main.error ? 'Failed' : 'Success'}
                </div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Timestamp</div>
                <div class="info-value">${this._formatTime(main.timestamp)}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Fee</div>
                <div class="info-value">${this._formatFee(main.fee)}</div>
              </div>
              
              ${main.memo ? html`
                <div class="info-item">
                  <div class="info-label">Memo</div>
                  <div class="info-value">${main.memo}</div>
                </div>
              ` : ''}
              
              ${main.error ? html`
                <div class="info-item">
                  <div class="info-label">Error</div>
                  <div class="info-value" style="color: #dc2626;">${main.error}</div>
                </div>
              ` : ''}
            </div>
          </div>
        </div>

        <!-- Messages -->
        ${messages.length > 0 ? html`
          <div class="info-card">
            <div class="card-header">
              <h2 class="card-title">Messages (${messages.length})</h2>
            </div>
            <div class="card-content">
              <div class="messages-list">
                ${messages.map(message => html`
                  <div class="message-card">
                    <div class="message-header">
                      <message-type-icon 
                        .messageType=${message.type || ''} 
                        showLabel
                      ></message-type-icon>
                      <span class="message-index">Index: ${message.message_index}</span>
                    </div>
                    
                    ${message.sender ? html`
                      <div class="info-item">
                        <div class="info-label">Sender</div>
                        <div class="hash-value">${message.sender}</div>
                      </div>
                    ` : ''}
                    
                    ${message.mentions?.length ? html`
                      <div class="info-item">
                        <div class="info-label">Mentions</div>
                        <div class="info-value">
                          ${message.mentions.map(mention => html`
                            <div class="hash-value" style="margin-bottom: 0.5rem;">${mention}</div>
                          `)}
                        </div>
                      </div>
                    ` : ''}
                  </div>
                `)}
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Raw Transaction Data -->
        <json-viewer 
          .data=${raw.data} 
          title="Complete Transaction Data"
          collapsed
        ></json-viewer>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-transaction-detail': PageTransactionDetail
  }
}