import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          background: '#fef2f2',
          padding: '2rem',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}>
          <div style={{
            maxWidth: '600px',
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}>
            <h1 style={{ color: '#dc2626', marginBottom: '1rem' }}>
              ⚠️ Error de la Aplicación
            </h1>
            
            <p style={{ color: '#374151', marginBottom: '1rem' }}>
              La aplicación encontró un error inesperado. Por favor, reinicia la aplicación.
            </p>

            {this.state.error && (
              <details style={{ 
                marginBottom: '1rem',
                background: '#f9fafb',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.875rem'
              }}>
                <summary style={{ cursor: 'pointer', color: '#2563eb', marginBottom: '0.5rem' }}>
                  Ver detalles del error
                </summary>
                <pre style={{ 
                  overflow: 'auto', 
                  background: '#1f2937', 
                  color: '#f3f4f6', 
                  padding: '0.75rem',
                  borderRadius: '4px',
                  margin: 0
                }}>
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                Reiniciar Aplicación
              </button>
            </div>

            <div style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#6b7280' }}>
              <p>Si este error persiste, contacte al soporte técnico.</p>
              <p>Información de diagnóstico:</p>
              <ul style={{ paddingLeft: '1.5rem', margin: '0.5rem 0' }}>
                <li>URL: {window.location.href}</li>
                <li>User Agent: {navigator.userAgent}</li>
                <li>Timestamp: {new Date().toISOString()}</li>
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}