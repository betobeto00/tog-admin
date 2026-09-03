import { ipcMain } from 'electron'
import { validateLicense, getLicenseStatus, saveLicense, resetLicenseState } from '../../services/license'
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

  ipcMain.handle('license:reset-state', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'license:reset-state', 'license_manage')
    if (fail) return fail
    resetLicenseState()
    return { success: true }
  })
}