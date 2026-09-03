import { ipcMain } from 'electron'
import { validateLicense, getLicenseStatus, saveLicense, resetLicenseState } from '../../services/license'
import { syncLicenseFromServer } from '../../services/license-sync'
import { checkPermissionOrFail } from '../../core/auth'

export function registerLicenseHandlers(): void {
  ipcMain.handle('license:status', async () => {
    return getLicenseStatus()
  })

  ipcMain.handle('license:validate', async () => {
    return validateLicense()
  })

  ipcMain.handle('license:import', async (_event, fileContent: string) => {
    return saveLicense(fileContent)
  })

  // Pre-auth (pantalla de bloqueo / sin sesión): descarga la licencia activa
  // desde el backend TOG Platform y la guarda localmente tras validar la firma.
  ipcMain.handle('license:sync', async (_event, data?: { url?: string; empresa_id?: string | number; api_key?: string }) => {
    return syncLicenseFromServer(
      { url: data?.url || '', empresaId: data?.empresa_id ?? '', apiKey: data?.api_key || '' },
      { saveImpl: saveLicense },
    )
  })

  ipcMain.handle('license:reset-state', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'license:reset-state', 'license_manage')
    if (fail) return fail
    resetLicenseState()
    return { success: true }
  })
}