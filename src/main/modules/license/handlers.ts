import { handleIpc } from '../../core/auth/ipc-guard'
import { validateLicense, getLicenseStatus, saveLicense, resetLicenseState } from '../../services/license'
import { syncLicenseFromServer } from '../../services/license-sync'
import { checkPermissionOrFail } from '../../core/auth'

export function registerLicenseHandlers(): void {
  handleIpc('license:status', async () => {
    return getLicenseStatus()
  })

  handleIpc('license:validate', async () => {
    return validateLicense()
  })

  handleIpc('license:import', async (_event, fileContent: string) => {
    return saveLicense(fileContent)
  })

  // Pre-auth (pantalla de bloqueo / sin sesión): descarga la licencia activa
  // desde el backend TOG Platform y la guarda localmente tras validar la firma.
  handleIpc('license:sync', async (_event, data?: { url?: string; empresa_id?: string | number; api_key?: string }) => {
    return syncLicenseFromServer(
      { url: data?.url || '', empresaId: data?.empresa_id ?? '', apiKey: data?.api_key || '' },
      { saveImpl: saveLicense },
    )
  })

  handleIpc('license:reset-state', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'license:reset-state', 'license_manage')
    if (fail) return fail
    resetLicenseState()
    return { success: true }
  })
}