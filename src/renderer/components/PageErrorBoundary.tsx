import React, { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  pageName: string
}

interface State {
  hasError: boolean
  error: Error | null
}

export class PageErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[PageErrorBoundary] Error in ${this.props.pageName}:`, error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      const { error } = this.state
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          minHeight: '400px',
          background: '#fef2f2',
          borderRadius: '8px',
          padding: '2rem',
          margin: '1rem',
        }}>
          <h2 style={{ color: '#dc2626', marginBottom: '0.5rem' }}>
            Error en {this.props.pageName}
          </h2>
          <p style={{ color: '#6b7280', marginBottom: '1rem', textAlign: 'center' }}>
            Se produjo un error inesperado. Puede intentar recargar esta página.
          </p>
          {error && (
            <pre style={{
              background: '#1f2937',
              color: '#f3f4f6',
              padding: '0.75rem',
              borderRadius: '4px',
              fontSize: '0.8rem',
              maxWidth: '500px',
              overflow: 'auto',
              marginBottom: '1rem',
            }}>
              {error.message}
            </pre>
          )}
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '0.5rem 1.25rem',
              background: '#dc2626',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '0.875rem',
            }}
          >
            Reintentar
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
