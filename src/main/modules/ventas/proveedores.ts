import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { proveedorCreateSchema } from '../../../shared/validations'

export function registerProveedoresHandlers(): void {
  ipcMain.handle('proveedores:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'proveedores:list', 'compras_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare('SELECT * FROM proveedores WHERE activo = 1 ORDER BY nombre').all()
  })

  ipcMain.handle('proveedores:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'proveedores:create', 'compras_suppliers')
    if (fail) return fail
    const parsed = proveedorCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const result = db.prepare(
      'INSERT INTO proveedores (nombre, ein, telefono, email, direccion, notas) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(data.nombre, data.ein || null, data.telefono || null, data.email || null, data.direccion || null, data.notas || null)
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('proveedores:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'proveedores:update', 'compras_suppliers')
    if (fail) return fail
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE proveedores SET
        nombre = COALESCE(?, nombre), ein = COALESCE(?, ein),
        telefono = COALESCE(?, telefono), email = COALESCE(?, email),
        direccion = COALESCE(?, direccion), notas = COALESCE(?, notas)
      WHERE id = ?
    `).run(d.nombre, d.ein, d.telefono, d.email, d.direccion, d.notas, data.id)
    return { success: true }
  })

  ipcMain.handle('proveedores:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'proveedores:delete', 'compras_suppliers')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE proveedores SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}