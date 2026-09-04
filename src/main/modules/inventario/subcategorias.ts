import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { subcategoriaCreateSchema, subcategoriaUpdateSchema } from '../../../shared/validations'

export function registerSubcategoriasHandlers(): void {
  ipcMain.handle('subcategorias:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'subcategorias:list', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT s.*, c.nombre as categoria_nombre
      FROM subcategorias s
      LEFT JOIN categorias c ON s.categoria_id = c.id
      WHERE s.activo = 1
    `
    const params: any[] = []
    if (data?.categoria_id) {
      sql += ` AND s.categoria_id = ?`
      params.push(data.categoria_id)
    }
    sql += ` ORDER BY c.nombre, s.nombre`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('subcategorias:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'subcategorias:create', 'inventario_categories')
    if (fail) return fail
    const parsed = subcategoriaCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const result = db.prepare('INSERT INTO subcategorias (nombre, categoria_id) VALUES (?, ?)').run(
      data.nombre,
      data.categoria_id,
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('subcategorias:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'subcategorias:update', 'inventario_categories')
    if (fail) return fail
    const parsed = subcategoriaUpdateSchema.safeParse(data.data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    db.prepare('UPDATE subcategorias SET nombre = COALESCE(?, nombre), categoria_id = COALESCE(?, categoria_id) WHERE id = ?').run(
      data.data.nombre || null,
      data.data.categoria_id || null,
      data.id,
    )
    return { success: true }
  })

  ipcMain.handle('subcategorias:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'subcategorias:delete', 'inventario_categories')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE productos SET subcategoria_id = NULL WHERE subcategoria_id = ?').run(data.id)
    db.prepare('UPDATE subcategorias SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}
