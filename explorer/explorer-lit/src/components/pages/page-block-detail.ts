import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { apiService } from '../../services/api.js'
import type { Block } from '../../types/blockchain.js'
import '../common/loading-spinner.ts'
import '../common/error-message.ts'
import '../common/json-viewer.ts'

@customElement('page-block-detail')
export class PageBlockDetail extends LitElement {
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
      margin-bottom: 2rem;
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

  @property({ type: String }) blockId!: string
  @state() private _block: Block | null = null
  @state() private _loading = true
  @state() private _error: string | null = null

  connectedCallback() {
    super.connectedCallback()
    this._loadBlock()
  }

  updated(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('blockId')) {
      this._loadBlock()
    }
  }

  private async _loadBlock() {
    try {
      this._loading = true
      this._error = null
      
      const blockIdNum = parseInt(this.blockId)
      if (isNaN(blockIdNum)) {
        throw new Error('Invalid block ID')
      }

      this._block = await apiService.getBlock(blockIdNum)
      
      if (!this._block) {
        throw new Error('Block not found')
      }
    } catch (error) {
      this._error = `Failed to load block: ${error instanceof Error ? error.message : 'Unknown error'}`
    } finally {
      this._loading = false
    }
  }

  private _goBack() {
    window.history.back()
  }

  private _formatTime(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleString()
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
          @retry=${this._loadBlock}
        ></error-message>
      `
    }

    if (!this._block) {
      return html`<error-message message="Block not found"></error-message>`
    }

    const header = this._block.data.block.header

    return html`
      <div class="page-header">
        <button class="back-button" @click=${this._goBack}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 class="page-title">Block #${this._block.id}</h1>
      </div>

      <div class="details-grid">
        <!-- Block Information -->
        <div class="info-card">
          <div class="card-header">
            <h2 class="card-title">Block Information</h2>
          </div>
          <div class="card-content">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Height</div>
                <div class="info-value">${header.height}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Chain ID</div>
                <div class="info-value">${header.chainId}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Timestamp</div>
                <div class="info-value">${this._formatTime(header.time)}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Transactions</div>
                <div class="info-value">${this._block.data.block.data?.txs?.length || 0}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Proposer</div>
                <div class="hash-value">${header.proposerAddress}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Block Hash</div>
                <div class="hash-value">${this._block.data.blockId.hash}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">App Hash</div>
                <div class="hash-value">${header.appHash}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Data Hash</div>
                <div class="hash-value">${header.dataHash}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Detailed Block Information -->
        <div class="info-card">
          <div class="card-header">
            <h2 class="card-title">Consensus & Validation</h2>
          </div>
          <div class="card-content">
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Validators Hash</div>
                <div class="hash-value">${header.validatorsHash}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Next Validators Hash</div>
                <div class="hash-value">${header.nextValidatorsHash || 'N/A'}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Consensus Hash</div>
                <div class="hash-value">${header.consensusHash || 'N/A'}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Evidence Hash</div>
                <div class="hash-value">${header.evidenceHash || 'N/A'}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Last Results Hash</div>
                <div class="hash-value">${header.lastResultsHash || 'N/A'}</div>
              </div>
              
              <div class="info-item">
                <div class="info-label">Last Commit Hash</div>
                <div class="hash-value">${header.lastCommitHash || 'N/A'}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Commit Information -->
        ${this._block.data.block.lastCommit ? html`
          <div class="info-card">
            <div class="card-header">
              <h2 class="card-title">Last Commit Information</h2>
            </div>
            <div class="card-content">
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">Commit Height</div>
                  <div class="info-value">${this._block.data.block.lastCommit.height}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">Signatures</div>
                  <div class="info-value">${this._block.data.block.lastCommit.signatures?.length || 0}</div>
                </div>
                
                <div class="info-item">
                  <div class="info-label">Block ID Hash</div>
                  <div class="hash-value">${this._block.data.block.lastCommit.blockId?.hash || 'N/A'}</div>
                </div>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Raw JSON Data -->
        <json-viewer 
          .data=${this._block.data} 
          title="Complete Block Data"
          collapsed
        ></json-viewer>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'page-block-detail': PageBlockDetail
  }
}