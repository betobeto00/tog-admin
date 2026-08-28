import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from './components/ErrorBoundary'
import './index.css'

// Logging para diagnóstico de producción
console.log('[TOG Admin] Renderer starting...')

// Esperar a que el DOM esté listo (crítico para Electron file:// protocol)
function mount() {
  console.log('[TOG Admin] Root element:', document.getElementById('root'))
  console.log('[TOG Admin] Current URL:', window.location.href)
  console.log('[TOG Admin] Protocol:', window.location.protocol)

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
