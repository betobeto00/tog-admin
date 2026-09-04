import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('restaurant')) {
    return { success: false, error: 'El módulo Restaurant no está activo en la licencia' }
  }
  return null
}

export function registerMesasHandlers(): void {
  handleIpc('mesas:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'mesas:list', 'restaurant_mesas_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare(`
      SELECT m.*,
        (SELECT c.id FROM comandas c WHERE c.mesa_id = m.id AND c.estado NOT IN ('cobrada','anulada') ORDER BY c.id DESC LIMIT 1) as comanda_id,
        (SELECT COALESCE(SUM(cd.subtotal), 0) FROM comanda_detalles cd
          JOIN comandas c2 ON c2.id = cd.comanda_id
          WHERE c2.mesa_id = m.id AND c2.estado NOT IN ('cobrada','anulada') AND cd.estado NOT IN ('cancelado')) as total_actual
      FROM mesas m
      WHERE m.activo = 1
      ORDER BY m.nombre
    `).all()
  })

  handleIpc('mesas:create', async (_event, data: { nombre: string; capacidad?: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'mesas:create', 'restaurant_mesas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.nombre?.trim()) return { success: false, error: 'El nombre de la mesa es obligatorio' }
    const db = getDatabase()
    const result = db.prepare('INSERT INTO mesas (nombre, capacidad) VALUES (?, ?)').run(data.nombre.trim(), data.capacidad || 4)
    return { id: result.lastInsertRowid }
  })

  handleIpc('mesas:update', async (_event, data: { id: number; data: { nombre?: string; capacidad?: number; estado?: string; activo?: number }; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'mesas:update', 'restaurant_mesas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE mesas SET
        nombre = COALESCE(?, nombre), capacidad = COALESCE(?, capacidad),
        estado = COALESCE(?, estado), activo = COALESCE(?, activo)
      WHERE id = ?
    `).run(d.nombre ?? null, d.capacidad ?? null, d.estado ?? null, d.activo ?? null, data.id)
    return { success: true }
  })

  handleIpc('mesas:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'mesas:delete', 'restaurant_mesas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare('UPDATE mesas SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}