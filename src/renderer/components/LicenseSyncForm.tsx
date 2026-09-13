import { useState } from 'react'
import { RefreshCw, User, Copy, Check, LogIn, AlertTriangle, Monitor } from 'lucide-react'
import { useToast } from './ui/Toast'
import { callApi } from '../lib/api-client'

type SyncResult = { success: true; cliente: string; expira: string; modulos: string[] } | { success: false; error: string; deviceMismatch?: boolean; empresaId?: string | number; apiKey?: string }

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
  const [initialPassword, setInitialPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showRebind, setShowRebind] = useState(false)
  const [rebindData, setRebindData] = useState<{ empresaId: string | number; apiKey: string } | null>(null)
  const [rebinding, setRebinding] = useState(false)

  const doSync = async (fingerprint: string) => {
    setSyncing(true)
    try {
      const result = await callApi<SyncResult>('license:sync-account', {
        url: DEFAULT_PLATFORM_URL,
        email: email.trim(),
        password,
        deviceFingerprint: fingerprint,
      })
      if (result.success) {
        const modulos = result.modulos.length ? result.modulos.join(', ') : 'base'
        toast.success(`Cuenta sincronizada ✓ — ${result.cliente} (expira ${result.expira}). Módulos: ${modulos}`)
        window.dispatchEvent(new Event('tog:license-updated'))

        const pw = await callApi<{ password: string | null }>('license:initial-password')
        if (pw?.password) {
          setInitialPassword(pw.password)
        } else {
          onSynced?.()
        }
      } else if (result.deviceMismatch && result.empresaId && result.apiKey) {
        setRebindData({ empresaId: result.empresaId, apiKey: result.apiKey })
        setShowRebind(true)
      } else {
        toast.error(result.error)
      }
    } catch (err: any) {
      toast.error('Error sincronizando: ' + (err?.message || err))
    } finally {
      setSyncing(false)
    }
  }

  const handleSyncAccount = async () => {
    if (!email.trim() || !password) {
      toast.error('Completa tu email y contraseña de OmniMargen.')
      return
    }
    const { machineId } = await callApi<{ machineId: string }>('license:machine-id')
    await doSync(machineId)
  }

  const handleRebind = async () => {
    if (!rebindData) return
    setRebinding(true)
    try {
      const { machineId } = await callApi<{ machineId: string }>('license:machine-id')
      const res = await callApi<{ success: boolean; error?: string }>('license:rebind-device', {
        url: DEFAULT_PLATFORM_URL,
        empresaId: rebindData.empresaId,
        apiKey: rebindData.apiKey,
        deviceFingerprint: machineId,
      })
      if (res.success) {
        setShowRebind(false)
        setRebindData(null)
        toast.success('Dispositivo re-vinculado. Reintentando sincronización...')
        await doSync(machineId)
      } else {
        toast.error(res.error || 'No se pudo re-vincular el dispositivo')
      }
    } catch (err: any) {
      toast.error('Error re-vinculando: ' + (err?.message || err))
    } finally {
      setRebinding(false)
    }
  }

  const handleCopyPassword = async () => {
    if (!initialPassword) return
    try {
      await navigator.clipboard.writeText(initialPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('No se pudo copiar. Selecciona y copia manualmente.')
    }
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 bg-white'

  if (initialPassword) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-500 to-green-600 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <Check className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Licencia sincronizada</h2>
                <p className="text-sm text-white/80">Estas son tus credenciales para entrar</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Usuario</p>
                <p className="text-sm font-mono font-semibold text-gray-900 bg-white rounded-lg px-3 py-2 border border-gray-200">admin</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">Contraseña inicial</p>
                <div className="flex gap-2">
                  <p className="text-sm font-mono font-semibold text-gray-900 bg-white rounded-lg px-3 py-2 border border-gray-200 flex-1 break-all select-all">{initialPassword}</p>
                  <button
                    onClick={handleCopyPassword}
                    className="px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-100 transition-colors flex-shrink-0"
                    title="Copiar contraseña"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-gray-500" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-700">
              Deberás cambiar esta contraseña en tu primer ingreso por una de tu agrado.
            </div>

            <button
              onClick={() => { setInitialPassword(null); onSynced?.() }}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-emerald-600 rounded-xl hover:bg-emerald-700"
            >
              <LogIn className="w-4 h-4" />
              Ir al login
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (showRebind) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/20 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-lg font-bold">Dispositivo diferente detectado</h2>
                <p className="text-sm text-white/80">La licencia ya está vinculada a otra PC</p>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
              <p>Si vinculas esta PC, la licencia se <strong>desvinculará</strong> de la anterior y quedará activa únicamente aquí.</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => { setShowRebind(false); setRebindData(null) }}
                className="px-4 py-3 rounded-xl border border-gray-200 text-gray-600 text-sm font-medium hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRebind}
                disabled={rebinding}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-amber-600 rounded-xl hover:bg-amber-700 disabled:bg-amber-300"
              >
                <Monitor className={`w-4 h-4 ${rebinding ? 'animate-pulse' : ''}`} />
                {rebinding ? 'Vinculando...' : 'Vincular esta PC'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
