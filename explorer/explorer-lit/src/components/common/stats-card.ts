import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('stats-card')
export class StatsCard extends LitElement {
  static styles = css`
    :host {
      display: block;
    }

    .card {
      background: white;
      border-radius: 0.75rem;
      padding: 1.5rem;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      border: 1px solid #e5e7eb;
      transition: all 0.2s ease;
    }

    .card:hover {
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
      transform: translateY(-1px);
    }

    .card-header {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      margin-bottom: 1rem;
    }

    .icon {
      width: 2.5rem;
      height: 2.5rem;
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
      font-size: 1.25rem;
    }

    .content {
      flex: 1;
    }

    .title {
      font-size: 0.875rem;
      font-weight: 500;
      color: #6b7280;
      margin-bottom: 0.25rem;
    }

    .value {
      font-size: 2rem;
      font-weight: 700;
      color: #111827;
      line-height: 1;
    }

    .subtitle {
      font-size: 0.75rem;
      color: #9ca3af;
      margin-top: 0.25rem;
    }

    .trend {
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 0.5rem;
    }

    .trend.up {
      color: #059669;
    }

    .trend.down {
      color: #dc2626;
    }

    .trend.neutral {
      color: #6b7280;
    }
  `

  @property({ type: String }) title = ''
  @property({ type: String }) value = ''
  @property({ type: String }) icon = ''
  @property({ type: String }) iconColor = '#3b82f6'
  @property({ type: String }) subtitle = ''
  @property({ type: String }) trend = ''
  @property({ type: String }) trendDirection: 'up' | 'down' | 'neutral' = 'neutral'

  render() {
    return html`
      <div class="card">
        <div class="card-header">
          <div class="icon" style="background: ${this.iconColor};">
            ${this.icon}
          </div>
          <div class="content">
            <div class="title">${this.title}</div>
            <div class="value">${this.value}</div>
            ${this.subtitle ? html`<div class="subtitle">${this.subtitle}</div>` : ''}
          </div>
        </div>
        
        ${this.trend ? html`
          <div class="trend ${this.trendDirection}">
            ${this.trendDirection === 'up' ? '↗' : this.trendDirection === 'down' ? '↘' : '→'} ${this.trend}
          </div>
        ` : ''}
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'stats-card': StatsCard
  }
}