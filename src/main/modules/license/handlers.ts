import { handleIpc } from '../../core/auth/ipc-guard'
import { validateLicense, getLicenseStatus, saveLicense, resetLicenseState, getMachineId } from '../../services/license'
import { syncLicenseFromServer, syncLicenseWithAccount } from '../../services/license-sync'
import { checkPermissionOrFail } from '../../core/auth'
import { startRedServerIfBase } from '../../services/red-server'

const fs = require('fs')
const path = require('path')

function getInitialPassword(): string | null {
  try {
    const p = path.join(require('electron').app.getPath('userData'), 'admin-initial-password.txt')
    if (!fs.existsSync(p)) return null
    return fs.readFileSync(p, 'utf8').trim() || null
  } catch {
    return null
  }
}

export function registerLicenseHandlers(): void {
  handleIpc('license:status', async () => {
    return getLicenseStatus()
  })

  handleIpc('license:machine-id', async () => {
    return { machineId: getMachineId() }
  })

  handleIpc('license:validate', async () => {
    return validateLicense()
  })

  handleIpc('license:import', async (_event, fileContent: string) => {
    const result = saveLicense(fileContent)
    // Con licencia activa esta PC pasa a ser la Base de la red local
    if (result.success) await startRedServerIfBase()
    return result
  })

  // Pre-auth (pantalla de bloqueo / sin sesión): descarga la licencia activa
  // desde el backend TOG Platform y la guarda localmente tras validar la firma.
  handleIpc('license:sync', async (_event, data?: { url?: string; empresa_id?: string | number; api_key?: string }) => {
    const result = await syncLicenseFromServer(
      { url: data?.url || '', empresaId: data?.empresa_id ?? '', apiKey: data?.api_key || '' },
      { saveImpl: saveLicense },
    )
    if (result.success) await startRedServerIfBase()
    return result
  })

  // Pre-auth: sincroniza la licencia con la cuenta OmniMargen (email + contraseña).
  handleIpc('license:sync-account', async (_event, data?: { url?: string; email?: string; password?: string }) => {
    const result = await syncLicenseWithAccount(
      { url: data?.url || '', email: data?.email || '', password: data?.password || '' },
      { saveImpl: saveLicense },
    )
    if (result.success) await startRedServerIfBase()
    return result
  })

  // Pre-auth: devuelve la contraseña inicial del admin si el archivo existe
  // (solo se muestra después del primer sync para que el usuario sepa con qué entrar).
  handleIpc('license:initial-password', async () => {
    return { password: getInitialPassword() }
  })

  // Pre-auth: re-vincula el dispositivo de la empresa (cuando el sync falla con DEVICE_MISMATCH).
  handleIpc('license:rebind-device', async (_event, data?: { url?: string; empresaId?: string | number; apiKey?: string; deviceFingerprint?: string }) => {
    const url = (data?.url || '').trim().replace(/\/+$/, '')
    const empresaId = String(data?.empresaId ?? '').trim()
    const apiKey = (data?.apiKey || '').trim()
    const deviceFingerprint = (data?.deviceFingerprint || '').trim()

    if (!url || !empresaId || !apiKey || !deviceFingerprint) {
      return { success: false, error: 'Faltan parámetros para re-vincular' }
    }

    const fetchImpl = globalThis.fetch as any
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10_000)
    try {
      const res = await fetchImpl(`${url}/api/empresas/${empresaId}/rebind`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'x-device-fingerprint': deviceFingerprint,
        },
        body: JSON.stringify({ device_fingerprint: deviceFingerprint }),
        signal: controller.signal,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        return { success: false, error: body?.error || `Error del servidor (${res.status})` }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err?.name === 'AbortError' ? 'Tiempo de espera agotado' : `No se pudo conectar: ${err?.message || err}` }
    } finally {
      clearTimeout(timer)
    }
  })

  handleIpc('license:reset-state', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'license:reset-state', 'license_manage')
    if (fail) return fail
    resetLicenseState()
    return { success: true }
  })
}