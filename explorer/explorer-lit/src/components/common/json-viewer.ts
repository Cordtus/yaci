import { LitElement, html, css, nothing } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

@customElement('json-viewer')
export class JsonViewer extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: #1e293b;
      border-radius: 0.5rem;
      overflow: hidden;
      border: 1px solid #334155;
    }

    .json-header {
      background: #0f172a;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #334155;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .json-title {
      color: #e2e8f0;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .toggle-button {
      background: #475569;
      color: #e2e8f0;
      border: none;
      border-radius: 0.25rem;
      padding: 0.25rem 0.5rem;
      font-size: 0.75rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .toggle-button:hover {
      background: #64748b;
    }

    .json-content {
      max-height: 600px;
      overflow: auto;
      padding: 1rem;
    }

    .json-content.collapsed {
      max-height: 0;
      padding: 0 1rem;
      overflow: hidden;
    }

    .json-tree {
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 0.875rem;
      line-height: 1.5;
    }

    .json-key {
      color: #60a5fa;
      cursor: pointer;
    }

    .json-string {
      color: #34d399;
    }

    .json-number {
      color: #fbbf24;
    }

    .json-boolean {
      color: #f87171;
    }

    .json-null {
      color: #9ca3af;
    }

    .json-punctuation {
      color: #e2e8f0;
    }

    .json-object,
    .json-array {
      margin-left: 1rem;
    }

    .expandable {
      cursor: pointer;
      user-select: none;
    }

    .expandable::before {
      content: '';
      color: #94a3b8;
      margin-right: 0.5rem;
      transition: transform 0.2s;
    }

    .expandable.expanded::before {
      transform: rotate(90deg);
    }

    .collapsed-content {
      display: none;
    }

    .expanded-content {
      display: block;
    }

    /* Prism.js theme overrides */
    .token.property {
      color: #60a5fa;
    }

    .token.string {
      color: #34d399;
    }

    .token.number {
      color: #fbbf24;
    }

    .token.boolean {
      color: #f87171;
    }

    .token.null {
      color: #9ca3af;
    }

    .token.punctuation {
      color: #e2e8f0;
    }
  `

  @property({ type: Object }) data: any = {}
  @property({ type: String }) title = 'JSON Data'
  @property({ type: Boolean }) collapsed = false
  @property({ type: Number }) maxDepth = 10

  @state() private _isCollapsed = false
  @state() private _expandedPaths = new Set<string>()

  connectedCallback() {
    super.connectedCallback()
    this._isCollapsed = this.collapsed
  }

  private _toggleCollapse() {
    this._isCollapsed = !this._isCollapsed
  }

  private _toggleExpansion(path: string) {
    if (this._expandedPaths.has(path)) {
      this._expandedPaths.delete(path)
    } else {
      this._expandedPaths.add(path)
    }
    this.requestUpdate()
  }

  private _renderJsonValue(value: any, path = '', depth = 0): any {
    if (depth > this.maxDepth) {
      return html`<span class="json-string">"[Max depth reached]"</span>`
    }

    if (value === null) {
      return html`<span class="json-null">null</span>`
    }

    if (typeof value === 'string') {
      return html`<span class="json-string">"${value}"</span>`
    }

    if (typeof value === 'number') {
      return html`<span class="json-number">${value}</span>`
    }

    if (typeof value === 'boolean') {
      return html`<span class="json-boolean">${value}</span>`
    }

    if (Array.isArray(value)) {
      return this._renderArray(value, path, depth)
    }

    if (typeof value === 'object') {
      return this._renderObject(value, path, depth)
    }

    return html`<span>${String(value)}</span>`
  }

  private _renderObject(obj: Record<string, any>, path: string, depth: number) {
    const keys = Object.keys(obj)
    const isExpanded = this._expandedPaths.has(path)
    const isEmpty = keys.length === 0

    if (isEmpty) {
      return html`<span class="json-punctuation">{}</span>`
    }

    return html`
      <span class="json-punctuation">{</span>
      ${depth < 3 || isExpanded ? html`
        <div class="json-object">
          ${keys.map((key, index) => {
            const keyPath = `${path}.${key}`
            const isLast = index === keys.length - 1
            return html`
              <div>
                <span class="json-key">"${key}"</span>
                <span class="json-punctuation">: </span>
                ${this._renderJsonValue(obj[key], keyPath, depth + 1)}
                ${!isLast ? html`<span class="json-punctuation">,</span>` : nothing}
              </div>
            `
          })}
        </div>
      ` : html`
        <span 
          class="expandable ${isExpanded ? 'expanded' : ''}"
          @click=${() => this._toggleExpansion(path)}
        >
          ${keys.length} ${keys.length === 1 ? 'property' : 'properties'}
        </span>
      `}
      <span class="json-punctuation">}</span>
    `
  }

  private _renderArray(arr: any[], path: string, depth: number) {
    const isExpanded = this._expandedPaths.has(path)
    const isEmpty = arr.length === 0

    if (isEmpty) {
      return html`<span class="json-punctuation">[]</span>`
    }

    return html`
      <span class="json-punctuation">[</span>
      ${depth < 3 || isExpanded ? html`
        <div class="json-array">
          ${arr.map((item, index) => {
            const itemPath = `${path}[${index}]`
            const isLast = index === arr.length - 1
            return html`
              <div>
                ${this._renderJsonValue(item, itemPath, depth + 1)}
                ${!isLast ? html`<span class="json-punctuation">,</span>` : nothing}
              </div>
            `
          })}
        </div>
      ` : html`
        <span 
          class="expandable ${isExpanded ? 'expanded' : ''}"
          @click=${() => this._toggleExpansion(path)}
        >
          ${arr.length} ${arr.length === 1 ? 'item' : 'items'}
        </span>
      `}
      <span class="json-punctuation">]</span>
    `
  }

  render() {
    if (!this.data) {
      return html`
        <div class="json-header">
          <span class="json-title">${this.title}</span>
        </div>
        <div class="json-content">
          <div style="color: #9ca3af; text-align: center; padding: 2rem;">
            No data available
          </div>
        </div>
      `
    }

    return html`
      <div class="json-header">
        <span class="json-title">${this.title}</span>
        <button class="toggle-button" @click=${this._toggleCollapse}>
          ${this._isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      
      <div class="json-content ${this._isCollapsed ? 'collapsed' : ''}">
        <div class="json-tree">
          ${this._renderJsonValue(this.data, 'root')}
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'json-viewer': JsonViewer
  }
}