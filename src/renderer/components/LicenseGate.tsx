import { useEffect, useState } from 'react'
import { Shield, AlertTriangle, Upload, Key, Clock } from 'lucide-react'
import { useToast } from './ui/Toast'
import { callApi } from '../lib/api-client'

interface LicenseStatus {
  valid: boolean
  cliente: string | null
  expira: string | null
  diasRestantes: number | null
  error: string | null
  machineId: string
  totalDaysUsed?: number
}

export default function LicenseGate({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<LicenseStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const toast = useToast()

  useEffect(() => {
    checkLicense()
  }, [])

  const checkLicense = async () => {
    try {
      const s = await callApi<LicenseStatus>('license:status')
      setStatus(s)
    } catch (err) {
      setStatus({
        valid: false,
        cliente: null,
        expira: null,
        diasRestantes: null,
        error: 'Error verificando licencia',
        machineId: 'unknown',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleImport = async () => {
    try {
      // Usar dialog del main process para seleccionar archivo
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.key,.json'
      input.onchange = async (e: any) => {
        const file = e.target.files[0]
        if (!file) return
        setImporting(true)
        try {
          const content = await file.text()
          const result = await callApi<{ success: boolean; error?: string }>('license:import', content)
          if (result.success) {
            toast.success('Licencia importada exitosamente')
            await checkLicense()
          } else {
            toast.error(result.error || 'Error importando licencia')
          }
        } catch (err: any) {
          toast.error('Error leyendo archivo')
        } finally {
          setImporting(false)
        }
      }
      input.click()
    } catch (err: any) {
      toast.error('Error: ' + err.message)
    }
  }

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 text-sm">Verificando licencia...</p>
        </div>
      </div>
    )
  }

  // Licencia válida
  if (status?.valid) {
    // Warning si quedan pocos días
    if (status.diasRestantes !== null && status.diasRestantes <= 30) {
      return (
        <>
          {/* Banner de advertencia */}
          <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-yellow-700">
              <Clock className="w-4 h-4" />
              <span>
                Tu licencia expira en <strong>{status.diasRestantes} día(s)</strong>
                {status.expira && ` (${status.expira})`}
              </span>
            </div>
            <button
              onClick={handleImport}
              className="text-yellow-600 hover:text-yellow-800 underline text-xs"
            >
              Renovar licencia
            </button>
          </div>
          {children}
        </>
      )
    }
    return <>{children}</>
  }

  // Licencia inválida / expirada / no encontrada
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-red-100 rounded-2xl flex items-center justify-center mb-4">
            <Shield className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TOG Admin</h1>
          <p className="text-gray-500 mt-1">Sistema de Punto de Venta</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {/* Error */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-red-800">Licencia no válida</h3>
                <p className="text-sm text-red-600 mt-1">{status?.error}</p>
              </div>
            </div>
          </div>

          {/* Info de licencia */}
          {status?.cliente && (
            <div className="bg-gray-50 rounded-xl p-4 mb-6 text-sm space-y-1">
              <div className="flex justify-between">
                <span className="text-gray-500">Cliente:</span>
                <span className="font-medium">{status.cliente}</span>
              </div>
              {status.expira && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Expira:</span>
                  <span className="font-medium">{status.expira}</span>
                </div>
              )}
            </div>
          )}

          {/* Machine ID */}
          <div className="bg-blue-50 rounded-xl p-4 mb-6 text-sm">
            <p className="text-blue-700 font-medium mb-1">🔑 ID de esta máquina:</p>
            <p className="font-mono text-xs text-blue-600 break-all">{status?.machineId}</p>
            <p className="text-xs text-blue-500 mt-1">
              Envía este ID al administrador para generar tu licencia
            </p>
          </div>

          {/* Importar licencia */}
          <button
            onClick={handleImport}
            disabled={importing}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl flex items-center justify-center gap-2"
          >
            <Upload className="w-5 h-5" />
            {importing ? 'Importando...' : 'Importar Licencia'}
          </button>

          <p className="text-center text-xs text-gray-400 mt-4">
            Coloca el archivo <strong>license.key</strong> junto al .exe de la app,
            o usa el botón de arriba para importarlo.
          </p>
        </div>
      </div>
    </div>
  )
}
