import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('search-bar')
export class SearchBar extends LitElement {
  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 600px;
    }

    .search-container {
      position: relative;
    }

    .search-input {
      width: 100%;
      padding: 0.75rem 1rem 0.75rem 3rem;
      border: 2px solid #e5e7eb;
      border-radius: 0.75rem;
      font-size: 1rem;
      background: white;
      transition: all 0.2s;
    }

    .search-input:focus {
      outline: none;
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
    }

    .search-icon {
      position: absolute;
      left: 1rem;
      top: 50%;
      transform: translateY(-50%);
      color: #6b7280;
      width: 1.25rem;
      height: 1.25rem;
    }

    .search-button {
      position: absolute;
      right: 0.5rem;
      top: 50%;
      transform: translateY(-50%);
      background: #3b82f6;
      color: white;
      border: none;
      border-radius: 0.5rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .search-button:hover {
      background: #2563eb;
    }

    .search-suggestions {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: white;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      margin-top: 0.25rem;
      z-index: 10;
      max-height: 300px;
      overflow-y: auto;
    }

    .suggestion-item {
      padding: 0.75rem 1rem;
      cursor: pointer;
      border-bottom: 1px solid #f3f4f6;
      transition: all 0.2s;
    }

    .suggestion-item:hover {
      background: #f9fafb;
    }

    .suggestion-item:last-child {
      border-bottom: none;
    }

    .suggestion-type {
      font-size: 0.75rem;
      font-weight: 600;
      color: #6b7280;
      text-transform: uppercase;
    }

    .suggestion-text {
      font-size: 0.875rem;
      color: #111827;
      margin-top: 0.25rem;
    }

    .placeholder-hints {
      position: absolute;
      top: 100%;
      left: 0;
      right: 0;
      background: #f9fafb;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-top: 0.25rem;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .hint-item {
      margin-bottom: 0.5rem;
    }

    .hint-item:last-child {
      margin-bottom: 0;
    }
  `

  @property({ type: String }) placeholder = 'Search blocks, transactions, addresses...'
  @state() private _query = ''
  @state() private _showSuggestions = false
  @state() private _showHints = false

  private _handleInput(e: Event) {
    const target = e.target as HTMLInputElement
    this._query = target.value
    
    if (this._query.length > 0) {
      this._showHints = false
      this._showSuggestions = this._query.length >= 3
    } else {
      this._showSuggestions = false
      this._showHints = true
    }
  }

  private _handleFocus() {
    this._showHints = this._query.length === 0
  }

  private _handleBlur() {
    // Delay hiding to allow clicking on suggestions
    setTimeout(() => {
      this._showSuggestions = false
      this._showHints = false
    }, 200)
  }

  private _handleSearch() {
    if (!this._query.trim()) return

    this._showSuggestions = false
    this._showHints = false

    this.dispatchEvent(new CustomEvent('search', {
      detail: { query: this._query.trim() },
      bubbles: true,
      composed: true
    }))
  }

  private _handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      this._handleSearch()
    }
  }

  private _getSuggestions() {
    const query = this._query.toLowerCase()
    const suggestions = []

    // Block height detection
    if (/^\d+$/.test(query)) {
      suggestions.push({
        type: 'Block',
        text: `Block #${query}`,
        action: () => this._navigate(`/blocks/${query}`)
      })
    }

    // Transaction hash detection
    if (/^[a-fA-F0-9]{64}$/.test(query)) {
      suggestions.push({
        type: 'Transaction',
        text: `Transaction ${query.substring(0, 16)}...`,
        action: () => this._navigate(`/transactions/${query}`)
      })
    }

    // Address detection (Cosmos format)
    if (/^[a-z0-9]{39,59}$/.test(query) && query.startsWith('manifest')) {
      suggestions.push({
        type: 'Address',
        text: `Address ${query.substring(0, 20)}...`,
        action: () => this._navigate(`/address/${query}`)
      })
    }

    // EVM address detection
    if (/^0x[a-fA-F0-9]{40}$/.test(query)) {
      suggestions.push({
        type: 'EVM Address',
        text: `EVM Address ${query.substring(0, 16)}...`,
        action: () => this._navigate(`/address/${query}`)
      })
    }

    return suggestions
  }

  private _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path },
      bubbles: true,
      composed: true
    }))
  }

  render() {
    const suggestions = this._getSuggestions()

    return html`
      <div class="search-container">
        <div class="search-icon">
          <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
        </div>
        
        <input
          class="search-input"
          type="text"
          .value=${this._query}
          placeholder=${this.placeholder}
          @input=${this._handleInput}
          @focus=${this._handleFocus}
          @blur=${this._handleBlur}
          @keydown=${this._handleKeyDown}
        />
        
        <button class="search-button" @click=${this._handleSearch}>
          Search
        </button>

        ${this._showSuggestions && suggestions.length > 0 ? html`
          <div class="search-suggestions">
            ${suggestions.map(suggestion => html`
              <div class="suggestion-item" @click=${suggestion.action}>
                <div class="suggestion-type">${suggestion.type}</div>
                <div class="suggestion-text">${suggestion.text}</div>
              </div>
            `)}
          </div>
        ` : ''}

        ${this._showHints ? html`
          <div class="placeholder-hints">
            <div class="hint-item"><strong>Block:</strong> Enter block height (e.g., 12345)</div>
            <div class="hint-item"><strong>Transaction:</strong> Enter tx hash (64 hex characters)</div>
            <div class="hint-item"><strong>Address:</strong> Enter Cosmos or EVM address</div>
          </div>
        ` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'search-bar': SearchBar
  }
}