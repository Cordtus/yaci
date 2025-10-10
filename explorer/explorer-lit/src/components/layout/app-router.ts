import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

// Import page components
import '../pages/page-dashboard.ts'
import '../pages/page-blocks.ts'
import '../pages/page-transactions.ts'
import '../pages/page-block-detail.ts'
import '../pages/page-transaction-detail.ts'

@customElement('app-router')
export class AppRouter extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .page-container {
      min-height: calc(100vh - 4rem);
    }

    .not-found {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 50vh;
      text-align: center;
      color: #6b7280;
    }

    .not-found h1 {
      font-size: 4rem;
      font-weight: bold;
      margin: 0;
      color: #d1d5db;
    }

    .not-found p {
      font-size: 1.25rem;
      margin: 1rem 0;
    }

    .not-found a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }

    .not-found a:hover {
      text-decoration: underline;
    }
  `

  @property({ type: String }) path = '/'

  private _parseRoute() {
    const path = this.path.split('?')[0] // Remove query params
    const segments = path.split('/').filter(Boolean)
    
    return {
      page: segments[0] || 'dashboard',
      params: segments.slice(1)
    }
  }

  render() {
    const { page, params } = this._parseRoute()

    return html`
      <div class="page-container">
        ${this._renderPage(page, params)}
      </div>
    `
  }

  private _renderPage(page: string, params: string[]) {
    switch (page) {
      case 'dashboard':
        return html`<page-dashboard></page-dashboard>`
      
      case 'blocks':
        if (params.length === 1) {
          return html`<page-block-detail .blockId=${params[0]}></page-block-detail>`
        }
        return html`<page-blocks></page-blocks>`
      
      case 'transactions':
        if (params.length === 1) {
          return html`<page-transaction-detail .transactionId=${params[0]}></page-transaction-detail>`
        }
        return html`<page-transactions></page-transactions>`
      
      case 'tx':
        if (params.length === 1) {
          return html`<page-transaction-detail .transactionId=${params[0]}></page-transaction-detail>`
        }
        return this._renderNotFound()
      
      case 'block':
        if (params.length === 1) {
          return html`<page-block-detail .blockId=${params[0]}></page-block-detail>`
        }
        return this._renderNotFound()
      
      default:
        return this._renderNotFound()
    }
  }

  private _renderNotFound() {
    return html`
      <div class="not-found">
        <h1>404</h1>
        <p>Page not found</p>
        <a href="/" @click=${(e: Event) => {
          e.preventDefault()
          this.dispatchEvent(new CustomEvent('navigate', {
            detail: { path: '/' },
            bubbles: true,
            composed: true
          }))
        }}>
          Return to Dashboard
        </a>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-router': AppRouter
  }
}