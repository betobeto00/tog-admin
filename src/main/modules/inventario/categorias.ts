import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerCategoriasHandlers(): void {
  ipcMain.handle('categorias:list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'categorias:list', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare('SELECT * FROM categorias WHERE activo = 1 ORDER BY nombre').all()
  })

  ipcMain.handle('categorias:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'categorias:create', 'inventario_categories')
    if (fail) return fail
    const db = getDatabase()
    const result = db.prepare('INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)').run(
      data.nombre,
      data.descripcion || null,
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('categorias:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'categorias:update', 'inventario_categories')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE categorias SET nombre = COALESCE(?, nombre), descripcion = COALESCE(?, descripcion) WHERE id = ?').run(
      data.data.nombre || null,
      data.data.descripcion || null,
      data.id,
    )
    return { success: true }
  })

  ipcMain.handle('categorias:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'categorias:delete', 'inventario_categories')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE categorias SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}