import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import { initI18n } from './i18n'
import './index.css'

console.log('[TOG Admin] Renderer starting...')

async function mount() {
  console.log('[TOG Admin] Root element:', document.getElementById('root'))
  console.log('[TOG Admin] Current URL:', window.location.href)
  console.log('[TOG Admin] Protocol:', window.location.protocol)

  // Initialize i18n BEFORE mounting React so useTranslation() works on first render
  try {
    await initI18n()
    console.log('[TOG Admin] i18n initialized')
  } catch (err) {
    console.error('[TOG Admin] i18n init failed, falling back to defaults:', err)
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </React.StrictMode>
  )

  console.log('[TOG Admin] React mounted successfully')
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', mount)
} else {
  mount()
}
