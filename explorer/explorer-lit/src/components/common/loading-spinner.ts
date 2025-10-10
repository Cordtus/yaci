import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('loading-spinner')
export class LoadingSpinner extends LitElement {
  static styles = css`
    :host {
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
    }

    .spinner {
      width: 2rem;
      height: 2rem;
      border: 3px solid #e5e7eb;
      border-top: 3px solid #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .message {
      margin-left: 1rem;
      color: #6b7280;
      font-size: 0.875rem;
    }
  `

  render() {
    return html`
      <div class="spinner"></div>
      <div class="message">Loading...</div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'loading-spinner': LoadingSpinner
  }
}