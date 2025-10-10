import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import './layout/app-header.ts'
import './layout/app-router.ts'

@customElement('yaci-explorer')
export class YaciExplorer extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background-color: #f9fafb;
    }

    .app-layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }

    main {
      flex: 1;
      padding: 0;
    }
  `

  @state() private _currentPath = window.location.pathname

  connectedCallback() {
    super.connectedCallback()
    
    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', this._handlePopState)
    
    // Listen for navigation events from child components
    this.addEventListener('navigate', this._handleNavigate)
  }

  disconnectedCallback() {
    super.disconnectedCallback()
    window.removeEventListener('popstate', this._handlePopState)
  }

  private _handlePopState = () => {
    this._currentPath = window.location.pathname
  }

  private _handleNavigate = (event: CustomEvent) => {
    const { path } = event.detail
    if (path !== this._currentPath) {
      window.history.pushState({}, '', path)
      this._currentPath = path
    }
  }

  render() {
    return html`
      <div class="app-layout">
        <app-header .currentPath=${this._currentPath}></app-header>
        <main>
          <app-router .path=${this._currentPath}></app-router>
        </main>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'yaci-explorer': YaciExplorer
  }
}