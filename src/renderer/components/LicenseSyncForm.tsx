import { useState } from 'react'
import { Globe, RefreshCw } from 'lucide-react'
import { useToast } from './ui/Toast'
import { callApi } from '../lib/api-client'

type SyncResult = { success: true; cliente: string; expira: string; modulos: string[] } | { success: false; error: string }

const LS_URL = 'tog_platform_sync_url'
const LS_EMPRESA = 'tog_platform_sync_empresa'
const LS_APIKEY = 'tog_platform_sync_apikey'

function loadPref(key: string): string {
  try {
    return localStorage.getItem(key) || ''
  } catch {
    return ''
  }
}

function savePref(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch {
    // almacenamiento no disponible: no es crítico
  }
}

interface LicenseSyncFormProps {
  onSynced?: () => void
  compact?: boolean
}

/**
 * Formulario para descargar la licencia activa desde el backend TOG Platform
 * (URL del servidor + ID de empresa + API Key). Funciona también desde la
 * pantalla de bloqueo (canal pre-auth license:sync).
 */
export default function LicenseSyncForm({ onSynced, compact }: LicenseSyncFormProps) {
  const toast = useToast()
  const [url, setUrl] = useState(loadPref(LS_URL))
  const [empresaId, setEmpresaId] = useState(loadPref(LS_EMPRESA))
  const [apiKey, setApiKey] = useState(loadPref(LS_APIKEY))
  const [syncing, setSyncing] = useState(false)

  const handleSync = async () => {
    if (!url.trim() || !empresaId.trim() || !apiKey.trim()) {
      toast.error('Completa la URL del servidor, el ID de empresa y la API Key.')
      return
    }
    setSyncing(true)
    try {
      savePref(LS_URL, url.trim())
      savePref(LS_EMPRESA, empresaId.trim())
      savePref(LS_APIKEY, apiKey.trim())
      const result = await callApi<SyncResult>('license:sync', {
        url: url.trim(),
        empresa_id: empresaId.trim(),
        api_key: apiKey.trim(),
      })
      if (result.success) {
        const modulos = result.modulos.length ? result.modulos.join(', ') : 'base'
        toast.success(`Licencia sincronizada ✓ — ${result.cliente} (expira ${result.expira}). Módulos: ${modulos}`)
        window.dispatchEvent(new Event('tog:license-updated'))
        onSynced?.()
      } else {
        toast.error(result.error)
      }
    } catch (err: any) {
      toast.error('Error sincronizando: ' + (err?.message || err))
    } finally {
      setSyncing(false)
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <div className={`${compact ? '' : 'bg-white rounded-xl border border-gray-200 p-4 space-y-3'}`}>
      {!compact && (
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-600" />
          <p className="text-sm font-semibold text-gray-800">Sincronizar con el servidor (TOG Platform)</p>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">URL del servidor</label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://tuservidor.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ID de empresa</label>
          <input
            type="text"
            inputMode="numeric"
            value={empresaId}
            onChange={(e) => setEmpresaId(e.target.value)}
            placeholder="123"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">API Key</label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="clave de la empresa"
            className={inputClass}
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
          {syncing ? 'Sincronizando...' : 'Sincronizar licencia'}
        </button>
        <p className="text-xs text-gray-400">
          La licencia se descarga, valida su firma y queda activa al instante.
        </p>
      </div>
    </div>
  )
}
