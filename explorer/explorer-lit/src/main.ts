import './styles/global.css'
import './components/app-root.ts'

console.log('Main.ts loaded')

// Initialize the application
const app = document.createElement('yaci-explorer')
const appContainer = document.getElementById('app')

if (appContainer) {
  appContainer.innerHTML = ''
  appContainer.appendChild(app)
  console.log('App initialized')
} else {
  console.error('App container not found')
}