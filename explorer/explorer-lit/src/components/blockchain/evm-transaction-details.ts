import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('evm-transaction-details')
export class EVMTransactionDetails extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .evm-container {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .evm-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .evm-badge {
      background: rgba(255, 255, 255, 0.2);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 0.5rem;
      font-size: 0.875rem;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }

    .evm-title {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .evm-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }

    .evm-field {
      background: rgba(255, 255, 255, 0.1);
      padding: 1rem;
      border-radius: 0.5rem;
    }

    .evm-field-label {
      font-size: 0.75rem;
      opacity: 0.8;
      margin-bottom: 0.5rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .evm-field-value {
      font-family: monospace;
      font-size: 0.875rem;
      word-break: break-all;
    }

    .gas-usage {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(0, 0, 0, 0.2);
      padding: 0.75rem;
      border-radius: 0.375rem;
      margin-top: 1rem;
    }

    .gas-label {
      font-size: 0.875rem;
      opacity: 0.9;
    }

    .gas-value {
      font-weight: 600;
    }

    .contract-section {
      background: white;
      color: #111827;
      border-radius: 0.75rem;
      padding: 1.5rem;
      margin-top: 1rem;
    }

    .contract-header {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: #374151;
    }

    .method-call {
      background: #f3f4f6;
      border: 1px solid #e5e7eb;
      border-radius: 0.5rem;
      padding: 1rem;
      margin-bottom: 1rem;
    }

    .method-name {
      font-weight: 600;
      color: #7c3aed;
      margin-bottom: 0.5rem;
    }

    .method-params {
      font-family: monospace;
      font-size: 0.875rem;
      color: #374151;
    }
  `

  @property({ type: Object }) evmData: any = {}
  @property({ type: String }) transactionHash = ''

  private _formatGwei(wei: string): string {
    try {
      const value = BigInt(wei)
      const gwei = Number(value) / 1e9
      return `${gwei.toFixed(4)} Gwei`
    } catch {
      return wei
    }
  }

  private _formatEther(wei: string): string {
    try {
      const value = BigInt(wei)
      const ether = Number(value) / 1e18
      return `${ether.toFixed(6)} ETH`
    } catch {
      return wei
    }
  }

  private _getTransactionTypeDisplay(type: number): { name: string; description: string } {
    switch (type) {
      case 0:
        return { name: 'Legacy', description: 'Traditional Ethereum transaction' }
      case 1:
        return { name: 'EIP-2930', description: 'Access list transaction' }
      case 2:
        return { name: 'EIP-1559', description: 'Dynamic fee transaction' }
      default:
        return { name: 'Unknown', description: 'Unknown transaction type' }
    }
  }

  render() {
    if (!this.evmData || Object.keys(this.evmData).length === 0) {
      return html``
    }

    const typeInfo = this._getTransactionTypeDisplay(this.evmData.type || 0)

    return html`
      <div class="evm-container">
        <div class="evm-header">
          <div class="evm-badge">
             EVM Transaction
          </div>
          <div class="evm-title">${typeInfo.name}</div>
        </div>

        <div class="evm-grid">
          ${this.evmData.from ? html`
            <div class="evm-field">
              <div class="evm-field-label">From Address</div>
              <div class="evm-field-value">${this.evmData.from}</div>
            </div>
          ` : ''}

          ${this.evmData.to ? html`
            <div class="evm-field">
              <div class="evm-field-label">To Address</div>
              <div class="evm-field-value">${this.evmData.to}</div>
            </div>
          ` : ''}

          ${this.evmData.value ? html`
            <div class="evm-field">
              <div class="evm-field-label">Value</div>
              <div class="evm-field-value">${this._formatEther(this.evmData.value)}</div>
            </div>
          ` : ''}

          ${this.evmData.gasPrice ? html`
            <div class="evm-field">
              <div class="evm-field-label">Gas Price</div>
              <div class="evm-field-value">${this._formatGwei(this.evmData.gasPrice)}</div>
            </div>
          ` : ''}

          ${this.evmData.maxFeePerGas ? html`
            <div class="evm-field">
              <div class="evm-field-label">Max Fee Per Gas</div>
              <div class="evm-field-value">${this._formatGwei(this.evmData.maxFeePerGas)}</div>
            </div>
          ` : ''}

          ${this.evmData.nonce !== undefined ? html`
            <div class="evm-field">
              <div class="evm-field-label">Nonce</div>
              <div class="evm-field-value">${this.evmData.nonce}</div>
            </div>
          ` : ''}
        </div>

        ${this.evmData.gasLimit || this.evmData.gasUsed ? html`
          <div class="gas-usage">
            <span class="gas-label">Gas Usage:</span>
            <span class="gas-value">
              ${this.evmData.gasUsed?.toLocaleString() || '0'} / ${this.evmData.gasLimit?.toLocaleString() || '0'}
              ${this.evmData.gasUsed && this.evmData.gasLimit ? 
                ` (${((this.evmData.gasUsed / this.evmData.gasLimit) * 100).toFixed(1)}%)` : ''}
            </span>
          </div>
        ` : ''}
      </div>

      ${this.evmData.data && this.evmData.data !== '0x' ? html`
        <div class="contract-section">
          <div class="contract-header">Smart Contract Interaction</div>
          <div class="method-call">
            <div class="method-name">Contract Call Data</div>
            <div class="method-params">${this.evmData.data}</div>
          </div>
        </div>
      ` : ''}

      ${this.evmData.accessList && this.evmData.accessList.length > 0 ? html`
        <div class="contract-section">
          <div class="contract-header">Access List (${this.evmData.accessList.length} items)</div>
          ${this.evmData.accessList.map((item: any, index: number) => html`
            <div class="method-call">
              <div class="method-name">Address ${index + 1}</div>
              <div class="method-params">${item.address}</div>
              ${item.storageKeys?.length ? html`
                <div style="margin-top: 0.5rem; font-size: 0.75rem; opacity: 0.8;">
                  ${item.storageKeys.length} storage keys
                </div>
              ` : ''}
            </div>
          `)}
        </div>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'evm-transaction-details': EVMTransactionDetails
  }
}