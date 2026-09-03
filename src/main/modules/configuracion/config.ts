import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getConfigMap, invalidateConfigCache } from '../../services/configCache'

export function registerConfigHandlers(): void {
  ipcMain.handle('config:get', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'config:get', 'config_access')
    if (fail) return fail
    const map = getConfigMap()
    return Array.from(map, ([clave, valor]) => ({ clave, valor })).sort((a, b) =>
      a.clave.localeCompare(b.clave),
    )
  })

  ipcMain.handle('config:set', async (_event, data: { clave: string; valor: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'config:set', 'config_edit')
    if (fail) return fail
    const db = getDatabase()
    db.prepare(
      "INSERT OR REPLACE INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, datetime('now'))"
    ).run(data.clave, data.valor)
    invalidateConfigCache()
    return { success: true }
  })
}