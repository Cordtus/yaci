import { LitElement, html, css } from 'lit'
import { customElement } from 'lit/decorators.js'

@customElement('simple-test')
export class SimpleTest extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 2rem;
      background: white;
      border: 2px solid #3b82f6;
      border-radius: 0.5rem;
      margin: 2rem;
    }
  `

  render() {
    return html`
      <h1>Simple Test Component</h1>
      <p>If you can see this, Lit.dev is working!</p>
    `
  }
}

// Test direct registration
const testElement = document.createElement('simple-test')
document.body.appendChild(testElement)

console.log('Simple test loaded')