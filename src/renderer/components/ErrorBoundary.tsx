import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  reportPath: string | null
  reportSaving: boolean
  copied: boolean
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
    reportPath: null,
    reportSaving: false,
    copied: false,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null, reportPath: null, reportSaving: false, copied: false }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({ error, errorInfo })
    this.saveReport(error, errorInfo)
  }

  private async saveReport(error: Error, errorInfo: ErrorInfo) {
    this.setState({ reportSaving: true })
    try {
      const result = await window.api.crashReport.save({
        type: 'renderer-error',
        message: error.message || String(error),
        stack: error.stack,
        componentStack: errorInfo.componentStack || undefined,
        currentUrl: window.location.href,
        userAgent: navigator.userAgent,
      })
      if (result.success && result.path) {
        this.setState({ reportPath: result.path })
      }
    } catch (err) {
      console.error('Failed to save crash report:', err)
    } finally {
      this.setState({ reportSaving: false })
    }
  }

  private async handleOpenFolder() {
    await window.api.crashReport.openFolder()
  }

  private handleCopyDetails() {
    const { error, errorInfo, reportPath } = this.state
    const text = [
      '=== TOG Admin - Error Report ===',
      '',
      `Error: ${error?.message || 'Unknown'}`,
      '',
      `Stack:\n${error?.stack || 'N/A'}`,
      '',
      `Component Stack:\n${errorInfo?.componentStack || 'N/A'}`,
      '',
      `Report File: ${reportPath || 'N/A'}`,
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
    ].join('\n')

    navigator.clipboard.writeText(text).then(() => {
      this.setState({ copied: true })
      setTimeout(() => this.setState({ copied: false }), 2000)
    })
  }

  public render() {
    if (this.state.hasError) {
      const { error, errorInfo, reportPath, reportSaving, copied } = this.state

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
            maxWidth: '640px',
            width: '100%',
            background: 'white',
            padding: '2rem',
            borderRadius: '12px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          }}>
            <h1 style={{ color: '#dc2626', marginBottom: '0.5rem', fontSize: '1.5rem' }}>
              ⚠️ Error de la Aplicación
            </h1>

            <p style={{ color: '#374151', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
              La aplicación encontró un error inesperado. Se ha generado un informe de error automáticamente.
            </p>

            {/* Report status */}
            {reportSaving && (
              <div style={{
                background: '#eff6ff',
                border: '1px solid #bfdbfe',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
                color: '#1e40af',
              }}>
                ⏳ Generando informe de error...
              </div>
            )}

            {reportPath && (
              <div style={{
                background: '#f0fdf4',
                border: '1px solid #bbf7d0',
                borderRadius: '8px',
                padding: '0.75rem 1rem',
                marginBottom: '1rem',
                fontSize: '0.875rem',
              }}>
                <div style={{ color: '#166534', fontWeight: 600, marginBottom: '0.25rem' }}>
                  ✅ Informe generado
                </div>
                <div style={{ color: '#15803d', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                  {reportPath}
                </div>
              </div>
            )}

            {/* Error details (collapsible) */}
            {error && (
              <details style={{
                marginBottom: '1rem',
                background: '#f9fafb',
                padding: '1rem',
                borderRadius: '8px',
                fontSize: '0.875rem',
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
                  margin: 0,
                  fontSize: '0.8rem',
                  maxHeight: '300px',
                }}>
                  {error.toString()}
                  {errorInfo && (
                    <div style={{ marginTop: '0.5rem' }}>
                      {errorInfo.componentStack}
                    </div>
                  )}
                </pre>
              </details>
            )}

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                onClick={() => window.location.reload()}
                style={{
                  padding: '0.5rem 1.25rem',
                  background: '#dc2626',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                }}
              >
                🔄 Reiniciar Aplicación
              </button>

              {reportPath && (
                <>
                  <button
                    onClick={() => this.handleOpenFolder()}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: '#2563eb',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    📂 Abrir Carpeta de Reportes
                  </button>

                  <button
                    onClick={() => this.handleCopyDetails()}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: copied ? '#16a34a' : '#6366f1',
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontSize: '0.875rem',
                      fontWeight: '500',
                    }}
                  >
                    {copied ? '✅ Copiado!' : '📋 Copiar Detalles'}
                  </button>
                </>
              )}
            </div>

            {/* Instructions */}
            <div style={{
              marginTop: '0.5rem',
              fontSize: '0.8rem',
              color: '#6b7280',
              background: '#f9fafb',
              padding: '0.75rem 1rem',
              borderRadius: '6px',
            }}>
              <p style={{ margin: '0 0 0.5rem 0', fontWeight: 600, color: '#374151' }}>
                📧 Para reportar este error:
              </p>
              <ol style={{ paddingLeft: '1.25rem', margin: 0 }}>
                <li>Haga clic en <strong>"Abrir Carpeta de Reportes"</strong></li>
                <li>Copie el archivo <code>.txt</code> generado</li>
                <li>Adjúntelo en un correo electrónico al soporte técnico</li>
              </ol>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
