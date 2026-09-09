import { handleIpc } from '../../core/auth/ipc-guard'
import { validateLicense, getLicenseStatus, saveLicense, resetLicenseState } from '../../services/license'
import { syncLicenseFromServer, syncLicenseWithAccount } from '../../services/license-sync'
import { checkPermissionOrFail } from '../../core/auth'
import { startRedServerIfBase } from '../../services/red-server'

export function registerLicenseHandlers(): void {
  handleIpc('license:status', async () => {
    return getLicenseStatus()
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

  handleIpc('license:reset-state', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'license:reset-state', 'license_manage')
    if (fail) return fail
    resetLicenseState()
    return { success: true }
  })
}