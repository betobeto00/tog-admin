import { ipcMain } from 'electron'
import {
  saveCrashReport,
  listCrashReports,
  readCrashReport,
  deleteCrashReport,
  openCrashReportsFolder,
  getCrashReportsPath,
} from '../../services/crash-reporter'
import { checkPermissionOrFail } from '../../core/auth'

export function registerCrashReportHandlers(): void {
  ipcMain.handle('crash-report:save', async (_event, data: {
    type: string
    message: string
    stack?: string
    componentStack?: string
    currentUrl?: string
    userAgent?: string
    loggedUser?: string
  }) => {
    try {
      const filePath = saveCrashReport({
        type: data.type as any,
        message: data.message,
        stack: data.stack,
        componentStack: data.componentStack,
        currentUrl: data.currentUrl,
        userAgent: data.userAgent,
        loggedUser: data.loggedUser,
      })
      return { success: true, path: filePath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'crash-report:list', 'config_access')
    if (fail) return fail
    try {
      return { success: true, reports: listCrashReports() }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:read', async (_event, data: { filename: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'crash-report:read', 'config_access')
    if (fail) return fail
    try {
      const content = readCrashReport(data.filename)
      if (content === null) return { success: false, error: 'Reporte no encontrado' }
      return { success: true, content }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:delete', async (_event, data: { filename: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'crash-report:delete', 'config_access')
    if (fail) return fail
    try {
      const deleted = deleteCrashReport(data.filename)
      return { success: deleted }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:open-folder', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'crash-report:open-folder', 'config_access')
    if (fail) return fail
    try {
      await openCrashReportsFolder()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('crash-report:path', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'crash-report:path', 'config_access')
    if (fail) return fail
    return getCrashReportsPath()
  })
}