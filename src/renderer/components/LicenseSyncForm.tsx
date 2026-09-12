import { useState } from 'react'
import { RefreshCw, User } from 'lucide-react'
import { useToast } from './ui/Toast'
import { callApi } from '../lib/api-client'

type SyncResult = { success: true; cliente: string; expira: string; modulos: string[] } | { success: false; error: string }

const DEFAULT_PLATFORM_URL = 'https://tog-platform-production.up.railway.app'

interface LicenseSyncFormProps {
  onSynced?: () => void
  compact?: boolean
}

export default function LicenseSyncForm({ onSynced, compact }: LicenseSyncFormProps) {
  const toast = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [syncing, setSyncing] = useState(false)

  const handleSyncAccount = async () => {
    if (!email.trim() || !password) {
      toast.error('Completa tu email y contraseña de OmniMargen.')
      return
    }
    setSyncing(true)
    try {
      const result = await callApi<SyncResult>('license:sync-account', {
        url: DEFAULT_PLATFORM_URL,
        email: email.trim(),
        password,
      })
      if (result.success) {
        const modulos = result.modulos.length ? result.modulos.join(', ') : 'base'
        toast.success(`Cuenta sincronizada ✓ — ${result.cliente} (expira ${result.expira}). Módulos: ${modulos}`)
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
      <div className="flex items-center gap-2">
        <User className="w-4 h-4 text-emerald-600" />
        <p className="text-sm font-semibold text-gray-800">
          Sincronizar con mi cuenta OmniMargen
        </p>
      </div>
      <p className="text-xs text-gray-400">
        Usa el email y contraseña de tu cuenta en omnimargen.site. La licencia de
        tus módulos comprados se descarga y activa al instante.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@empresa.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Contraseña</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
      </div>
      <button
        onClick={handleSyncAccount}
        disabled={syncing}
        className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300"
      >
        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'Sincronizando...' : 'Sincronizar licencia'}
      </button>
    </div>
  )
}
