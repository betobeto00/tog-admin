import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'
import { clienteCreateSchema } from '../../../shared/validations'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('distribuidor')) {
    return { success: false, error: 'El módulo Distribuidor no está activo en la licencia' }
  }
  return null
}

export function registerClientesHandlers(): void {
  ipcMain.handle('clientes:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'clientes:list', 'distribuidor_clientes_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare('SELECT * FROM clientes WHERE activo = 1 ORDER BY nombre').all()
  })

  ipcMain.handle('clientes:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'clientes:create', 'distribuidor_clientes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const parsed = clienteCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const result = db.prepare(
      'INSERT INTO clientes (nombre, rif, telefono, email, direccion, limite_credito, notas) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      data.nombre,
      data.rif || null,
      data.telefono || null,
      data.email || null,
      data.direccion || null,
      data.limite_credito || 0,
      data.notas || null,
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('clientes:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'clientes:update', 'distribuidor_clientes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE clientes SET
        nombre = COALESCE(?, nombre), rif = COALESCE(?, rif),
        telefono = COALESCE(?, telefono), email = COALESCE(?, email),
        direccion = COALESCE(?, direccion), limite_credito = COALESCE(?, limite_credito),
        notas = COALESCE(?, notas)
      WHERE id = ?
    `).run(d.nombre ?? null, d.rif ?? null, d.telefono ?? null, d.email ?? null, d.direccion ?? null, d.limite_credito ?? null, d.notas ?? null, data.id)
    return { success: true }
  })

  ipcMain.handle('clientes:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'clientes:delete', 'distribuidor_clientes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare('UPDATE clientes SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}