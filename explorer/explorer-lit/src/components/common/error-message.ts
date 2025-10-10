import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('error-message')
export class ErrorMessage extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
    }

    .error-container {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 0.75rem;
      padding: 1.5rem;
      text-align: center;
    }

    .error-icon {
      font-size: 2rem;
      margin-bottom: 1rem;
    }

    .error-title {
      font-size: 1.125rem;
      font-weight: 600;
      color: #dc2626;
      margin-bottom: 0.5rem;
    }

    .error-message {
      color: #991b1b;
      font-size: 0.875rem;
      margin-bottom: 1rem;
    }

    .retry-button {
      background: #dc2626;
      color: white;
      border: none;
      border-radius: 0.375rem;
      padding: 0.5rem 1rem;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .retry-button:hover {
      background: #b91c1c;
    }
  `

  @property({ type: String }) message = 'An error occurred'
  @property({ type: Boolean }) showRetry = false

  private _handleRetry() {
    this.dispatchEvent(new CustomEvent('retry', {
      bubbles: true,
      composed: true
    }))
  }

  render() {
    return html`
      <div class="error-container">
        <div class="error-icon"></div>
        <div class="error-title">Error</div>
        <div class="error-message">${this.message}</div>
        ${this.showRetry ? html`
          <button class="retry-button" @click=${this._handleRetry}>
            Try Again
          </button>
        ` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'error-message': ErrorMessage
  }
}