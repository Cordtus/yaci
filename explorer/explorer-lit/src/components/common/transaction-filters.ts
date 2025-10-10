import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

export interface FilterOptions {
  messageType?: string
  sender?: string
  txType?: 'all' | 'evm' | 'cosmos'
  status?: 'all' | 'success' | 'failed'
  sortBy?: 'height' | 'timestamp' | 'fee'
  sortOrder?: 'asc' | 'desc'
}

@customElement('transaction-filters')
export class TransactionFilters extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: white;
      border-radius: 0.5rem;
      border: 1px solid #e5e7eb;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .filters-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 1rem;
    }

    .filters-title {
      font-size: 1rem;
      font-weight: 600;
      color: #111827;
    }

    .clear-button {
      background: #f3f4f6;
      color: #374151;
      border: none;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .clear-button:hover {
      background: #e5e7eb;
    }

    .filters-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 1rem;
    }

    .filter-group {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .filter-label {
      font-size: 0.875rem;
      font-weight: 500;
      color: #374151;
    }

    .filter-select,
    .filter-input {
      padding: 0.5rem 0.75rem;
      border: 1px solid #d1d5db;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      background: white;
    }

    .filter-select:focus,
    .filter-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .message-types {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 0.5rem;
    }

    .message-type-chip {
      background: #f3f4f6;
      color: #374151;
      padding: 0.25rem 0.5rem;
      border-radius: 0.25rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .message-type-chip:hover {
      background: #e5e7eb;
    }

    .message-type-chip.active {
      background: #3b82f6;
      color: white;
    }

    .active-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      margin-top: 1rem;
    }

    .filter-tag {
      background: #dbeafe;
      color: #1e40af;
      padding: 0.25rem 0.75rem;
      border-radius: 1rem;
      font-size: 0.75rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .filter-tag-remove {
      background: none;
      border: none;
      color: #1e40af;
      cursor: pointer;
      padding: 0;
      display: flex;
      align-items: center;
    }
  `

  @property({ type: Array })
  availableMessageTypes: string[] = [
    '/cosmos.bank.v1beta1.MsgSend',
    '/cosmos.bank.v1beta1.MsgMultiSend', 
    '/cosmos.group.v1.MsgExec',
    '/cosmos.group.v1.MsgSubmitProposal',
    '/cosmos.group.v1.MsgVote',
    '/osmosis.tokenfactory.v1beta1.MsgMint',
    '/osmosis.tokenfactory.v1beta1.MsgBurn',
    '/osmosis.tokenfactory.v1beta1.MsgCreateDenom'
  ]

  @state() private _activeFilters: FilterOptions = {
    txType: 'all',
    status: 'all',
    sortBy: 'height',
    sortOrder: 'desc'
  }

  private _updateFilter(key: keyof FilterOptions, value: any) {
    this._activeFilters = { ...this._activeFilters, [key]: value }
    this._emitFiltersChanged()
  }

  private _toggleMessageType(messageType: string) {
    if (this._activeFilters.messageType === messageType) {
      this._activeFilters = { ...this._activeFilters, messageType: undefined }
    } else {
      this._activeFilters = { ...this._activeFilters, messageType: messageType }
    }
    this._emitFiltersChanged()
  }

  private _clearFilters() {
    this._activeFilters = {
      txType: 'all',
      status: 'all', 
      sortBy: 'height',
      sortOrder: 'desc'
    }
    this._emitFiltersChanged()
  }

  private _emitFiltersChanged() {
    this.dispatchEvent(new CustomEvent('filters-changed', {
      detail: { filters: this._activeFilters },
      bubbles: true,
      composed: true
    }))
  }

  private _getMessageTypeDisplay(type: string): string {
    const parts = type.split('.')
    const msgType = parts[parts.length - 1]?.replace('Msg', '') || type
    return msgType
  }

  private _getActiveFilterTags(): Array<{key: string, value: string, display: string}> {
    const tags = []
    
    if (this._activeFilters.messageType) {
      tags.push({
        key: 'messageType',
        value: this._activeFilters.messageType,
        display: `Type: ${this._getMessageTypeDisplay(this._activeFilters.messageType)}`
      })
    }
    
    if (this._activeFilters.sender) {
      tags.push({
        key: 'sender', 
        value: this._activeFilters.sender,
        display: `Sender: ${this._activeFilters.sender.substring(0, 16)}...`
      })
    }
    
    if (this._activeFilters.txType && this._activeFilters.txType !== 'all') {
      tags.push({
        key: 'txType',
        value: this._activeFilters.txType,
        display: `Type: ${this._activeFilters.txType.toUpperCase()}`
      })
    }
    
    if (this._activeFilters.status && this._activeFilters.status !== 'all') {
      tags.push({
        key: 'status',
        value: this._activeFilters.status, 
        display: `Status: ${this._activeFilters.status}`
      })
    }
    
    return tags
  }

  render() {
    const activeTags = this._getActiveFilterTags()

    return html`
      <div class="filters-header">
        <div class="filters-title"> Filters & Sorting</div>
        <button class="clear-button" @click=${this._clearFilters}>
          Clear All
        </button>
      </div>

      <div class="filters-grid">
        <div class="filter-group">
          <label class="filter-label">Transaction Type</label>
          <select 
            class="filter-select"
            .value=${this._activeFilters.txType}
            @change=${(e: Event) => this._updateFilter('txType', (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Transactions</option>
            <option value="cosmos"> Cosmos Only</option>
            <option value="evm"> EVM Only</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Status</label>
          <select 
            class="filter-select"
            .value=${this._activeFilters.status}
            @change=${(e: Event) => this._updateFilter('status', (e.target as HTMLSelectElement).value)}
          >
            <option value="all">All Status</option>
            <option value="success"> Success Only</option>
            <option value="failed"> Failed Only</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Sort By</label>
          <select 
            class="filter-select"
            .value=${this._activeFilters.sortBy}
            @change=${(e: Event) => this._updateFilter('sortBy', (e.target as HTMLSelectElement).value)}
          >
            <option value="height">Block Height</option>
            <option value="timestamp">Timestamp</option>
            <option value="fee">Fee Amount</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Sort Order</label>
          <select 
            class="filter-select"
            .value=${this._activeFilters.sortOrder}
            @change=${(e: Event) => this._updateFilter('sortOrder', (e.target as HTMLSelectElement).value)}
          >
            <option value="desc">↓ Descending</option>
            <option value="asc">↑ Ascending</option>
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Sender Address</label>
          <input 
            type="text" 
            class="filter-input"
            placeholder="manifest1abc... or 0x123..."
            .value=${this._activeFilters.sender || ''}
            @input=${(e: Event) => this._updateFilter('sender', (e.target as HTMLInputElement).value)}
          />
        </div>
      </div>

      <div class="filter-group">
        <label class="filter-label">Message Types</label>
        <div class="message-types">
          ${this.availableMessageTypes.map(type => html`
            <div 
              class="message-type-chip ${this._activeFilters.messageType === type ? 'active' : ''}"
              @click=${() => this._toggleMessageType(type)}
            >
              ${this._getMessageTypeDisplay(type)}
            </div>
          `)}
        </div>
      </div>

      ${activeTags.length > 0 ? html`
        <div class="active-filters">
          ${activeTags.map(tag => html`
            <div class="filter-tag">
              ${tag.display}
              <button 
                class="filter-tag-remove"
                @click=${() => this._updateFilter(tag.key as keyof FilterOptions, tag.key === 'messageType' ? undefined : (tag.key === 'txType' || tag.key === 'status' ? 'all' : ''))}
              >
                ✕
              </button>
            </div>
          `)}
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transaction-filters': TransactionFilters
  }
}