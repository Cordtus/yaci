import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { apiService } from '../../services/api.js'
import type { Block } from '../../types/blockchain.js'
import { formatDistanceToNow } from 'date-fns'
import '../common/loading-spinner.ts'
import '../common/error-message.ts'

@customElement('page-blocks')
export class PageBlocks extends LitElement {
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

    .blocks-container {
      background: white;
      border-radius: 0.75rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      overflow: hidden;
    }

    .blocks-table {
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

    .block-height {
      font-weight: 600;
      color: #3b82f6;
      font-size: 1.125rem;
    }

    .block-hash {
      font-family: monospace;
      font-size: 0.875rem;
      color: #6b7280;
      word-break: break-all;
    }

    .block-proposer {
      font-family: monospace;
      font-size: 0.875rem;
      color: #6b7280;
    }

    .tx-count {
      background: #dbeafe;
      color: #1e40af;
      padding: 0.25rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.875rem;
      font-weight: 500;
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

      .blocks-table {
        font-size: 0.875rem;
      }

      .table-header th,
      .table-cell {
        padding: 0.75rem;
      }

      .block-hash,
      .block-proposer {
        display: none;
      }
    }
  `

  @state() private _blocks: Block[] = []
  @state() private _loading = true
  @state() private _error: string | null = null
  @state() private _currentPage = 0
  @state() private _pageSize = 20

  connectedCallback() {
    super.connectedCallback()
    this._loadBlocks()
  }

  private async _loadBlocks() {
    try {
      this._loading = true
      this._error = null
      
      const offset = this._currentPage * this._pageSize
      this._blocks = await apiService.getBlocks(this._pageSize, offset)
    } catch (error) {
      this._error = `Failed to load blocks: ${error instanceof Error ? error.message : 'Unknown error'}`
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

  private _previousPage() {
    if (this._currentPage > 0) {
      this._currentPage--
      this._loadBlocks()
    }
  }

  private _nextPage() {
    this._currentPage++
    this._loadBlocks()
  }

  private _truncateHash(hash: string): string {
    if (!hash) return ''
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
          @retry=${this._loadBlocks}
        ></error-message>
      `
    }

    return html`
      <div class="page-header">
        <h1 class="page-title">Blocks</h1>
        <p class="page-subtitle">Recent blocks on the blockchain</p>
      </div>

      <div class="blocks-container">
        <table class="blocks-table">
          <thead class="table-header">
            <tr>
              <th>Height</th>
              <th>Hash</th>
              <th>Proposer</th>
              <th>Transactions</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            ${this._blocks.map(block => html`
              <tr class="table-row" @click=${() => this._navigateToBlock(block.id)}>
                <td class="table-cell">
                  <div class="block-height">${block.id}</div>
                </td>
                <td class="table-cell">
                  <div class="block-hash">
                    ${this._truncateHash(block.data?.blockId?.hash || 'N/A')}
                  </div>
                </td>
                <td class="table-cell">
                  <div class="block-proposer">
                    ${this._truncateHash(block.data?.block?.header?.proposerAddress || 'N/A')}
                  </div>
                </td>
                <td class="table-cell">
                  <span class="tx-count">${block.data?.block?.data?.txs?.length || 0}</span>
                </td>
                <td class="table-cell">
                  ${formatDistanceToNow(new Date(block.data?.block?.header?.time || new Date()), { addSuffix: true })}
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
            ?disabled=${this._blocks.length < this._pageSize}
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
    'page-blocks': PageBlocks
  }
}