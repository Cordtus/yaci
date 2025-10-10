import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('message-type-icon')
export class MessageTypeIcon extends LitElement {
  static styles = css`
    :host {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }

    .icon {
      width: 1.25rem;
      height: 1.25rem;
      border-radius: 0.25rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
    }

    .label {
      font-size: 0.875rem;
      font-weight: 500;
    }

    /* Message type colors inspired by but not copied from established explorers */
    .bank { background: #dcfce7; color: #166534; }
    .staking { background: #fef3c7; color: #92400e; }
    .gov { background: #e0e7ff; color: #3730a3; }
    .ibc { background: #f3e8ff; color: #7c2d12; }
    .evm { background: #ddd6fe; color: #6b21a8; }
    .group { background: #fed7d7; color: #c53030; }
    .authz { background: #bee3f8; color: #2a69ac; }
    .distribution { background: #c6f6d5; color: #25855a; }
    .unknown { background: #f7fafc; color: #4a5568; }
  `

  @property({ type: String }) messageType = ''
  @property({ type: Boolean }) showLabel = true

  private _getMessageInfo(type: string) {
    // Create new icon mappings inspired by common patterns
    if (type.includes('bank')) {
      return { icon: '', label: 'Bank Transfer', class: 'bank' }
    }
    if (type.includes('staking') || type.includes('MsgDelegate')) {
      return { icon: '', label: 'Staking', class: 'staking' }
    }
    if (type.includes('gov') || type.includes('proposal')) {
      return { icon: '', label: 'Governance', class: 'gov' }
    }
    if (type.includes('ibc')) {
      return { icon: '', label: 'IBC Transfer', class: 'ibc' }
    }
    if (type.includes('ethermint') || type.includes('evm')) {
      return { icon: '', label: 'EVM Transaction', class: 'evm' }
    }
    if (type.includes('group')) {
      return { icon: '', label: 'Group Action', class: 'group' }
    }
    if (type.includes('authz')) {
      return { icon: '', label: 'Authorization', class: 'authz' }
    }
    if (type.includes('distribution')) {
      return { icon: '', label: 'Rewards', class: 'distribution' }
    }
    
    return { icon: '', label: 'Unknown', class: 'unknown' }
  }

  private _getShortName(type: string): string {
    const parts = type.split('.')
    return parts[parts.length - 1]?.replace('Msg', '') || 'Unknown'
  }

  render() {
    const info = this._getMessageInfo(this.messageType)
    const shortName = this._getShortName(this.messageType)

    return html`
      <div class="icon ${info.class}">${info.icon}</div>
      ${this.showLabel ? html`
        <span class="label">${shortName}</span>
      ` : ''}
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'message-type-icon': MessageTypeIcon
  }
}