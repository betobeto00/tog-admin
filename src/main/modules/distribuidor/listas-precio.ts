import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('distribuidor')) {
    return { success: false, error: 'El módulo Distribuidor no está activo en la licencia' }
  }
  return null
}

export function registerListasPrecioHandlers(): void {
  ipcMain.handle('listas-precio:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:list', 'distribuidor_listas_precio_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare('SELECT * FROM listas_precio ORDER BY nombre').all()
  })

  ipcMain.handle('listas-precio:create', async (_event, data: { nombre: string; factor: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:create', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.nombre?.trim()) return { success: false, error: 'El nombre es requerido' }
    if (!data.factor || data.factor <= 0) return { success: false, error: 'El factor debe ser mayor a 0' }
    const db = getDatabase()
    const result = db.prepare('INSERT INTO listas_precio (nombre, factor) VALUES (?, ?)').run(data.nombre.trim(), data.factor)
    return { success: true, id: result.lastInsertRowid }
  })

  ipcMain.handle('listas-precio:update', async (_event, data: { id: number; data: { nombre?: string; factor?: number; activo?: number }; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:update', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []
    const upd = data.data
    if (upd.nombre !== undefined) {
      if (!upd.nombre.trim()) return { success: false, error: 'El nombre no puede estar vacío' }
      fields.push('nombre = ?')
      values.push(upd.nombre.trim())
    }
    if (upd.factor !== undefined) {
      if (!upd.factor || upd.factor <= 0) return { success: false, error: 'El factor debe ser mayor a 0' }
      fields.push('factor = ?')
      values.push(upd.factor)
    }
    if (upd.activo !== undefined) {
      fields.push('activo = ?')
      values.push(upd.activo ? 1 : 0)
    }
    if (!fields.length) return { success: false, error: 'Nada que actualizar' }
    values.push(data.id)
    db.prepare(`UPDATE listas_precio SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  ipcMain.handle('listas-precio:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:delete', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare('DELETE FROM listas_precio WHERE id = ?').run(data.id)
    return { success: true }
  })
}