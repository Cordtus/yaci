import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import '../common/search-bar.ts'

@customElement('app-header')
export class AppHeader extends LitElement {
  static styles = css`
    :host {
      display: block;
      background: white;
      border-bottom: 1px solid #e5e7eb;
      box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
    }

    .header-container {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 1rem;
      display: flex;
      align-items: center;
      gap: 2rem;
      height: 4rem;
    }

    .header-main {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      gap: 2rem;
    }

    .header-center {
      flex: 1;
      max-width: 400px;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo-icon {
      width: 2rem;
      height: 2rem;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border-radius: 0.5rem;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-weight: bold;
    }

    .logo-text {
      font-size: 1.5rem;
      font-weight: 700;
      color: #111827;
    }

    .nav-links {
      display: flex;
      gap: 2rem;
      list-style: none;
      margin: 0;
      padding: 0;
    }

    .nav-link {
      text-decoration: none;
      color: #6b7280;
      font-weight: 500;
      padding: 0.5rem 1rem;
      border-radius: 0.375rem;
      transition: all 0.2s;
    }

    .nav-link:hover {
      color: #3b82f6;
      background-color: #f3f4f6;
    }

    .nav-link.active {
      color: #3b82f6;
      background-color: #eff6ff;
    }

    @media (max-width: 768px) {
      .header-main {
        flex-direction: column;
        gap: 1rem;
      }

      .header-center {
        order: 3;
        max-width: none;
      }
      
      .nav-links {
        gap: 1rem;
      }
      
      .logo-text {
        display: none;
      }
    }
  `

  @property({ type: String }) currentPath = '/'

  private _navigate(path: string) {
    this.dispatchEvent(new CustomEvent('navigate', {
      detail: { path },
      bubbles: true,
      composed: true
    }))
  }

  private _isActive(path: string): boolean {
    return this.currentPath === path || 
           (path !== '/' && this.currentPath.startsWith(path))
  }

  private _handleSearch = (event: CustomEvent) => {
    const { query } = event.detail
    // Simple search routing logic
    if (/^\d+$/.test(query)) {
      this._navigate(`/blocks/${query}`)
    } else if (/^[a-fA-F0-9]{64}$/.test(query)) {
      this._navigate(`/transactions/${query}`)
    } else {
      // For now, just navigate to transactions page
      this._navigate('/transactions')
    }
  }

  render() {
    return html`
      <header>
        <div class="header-container">
          <div class="header-main">
            <div class="logo">
              <div class="logo-icon">Y</div>
              <span class="logo-text">Yaci Explorer</span>
            </div>
            
            <div class="header-center">
              <search-bar
                placeholder="Search blocks, transactions, addresses..."
                @search=${this._handleSearch}
                @navigate=${this._navigate}
              ></search-bar>
            </div>
            
            <nav>
              <ul class="nav-links">
                <li>
                  <a 
                    href="/" 
                    class="nav-link ${this._isActive('/') ? 'active' : ''}"
                    @click=${(e: Event) => {
                      e.preventDefault()
                      this._navigate('/')
                    }}
                  >
                    Dashboard
                  </a>
                </li>
                <li>
                  <a 
                    href="/blocks" 
                    class="nav-link ${this._isActive('/blocks') ? 'active' : ''}"
                    @click=${(e: Event) => {
                      e.preventDefault()
                      this._navigate('/blocks')
                    }}
                  >
                    Blocks
                  </a>
                </li>
                <li>
                  <a 
                    href="/transactions" 
                    class="nav-link ${this._isActive('/transactions') ? 'active' : ''}"
                    @click=${(e: Event) => {
                      e.preventDefault()
                      this._navigate('/transactions')
                    }}
                  >
                    Transactions
                  </a>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </header>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-header': AppHeader
  }
}