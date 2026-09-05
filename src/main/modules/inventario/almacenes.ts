import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerAlmacenesHandlers(): void {
  handleIpc('almacenes:list', async (_event, data: { activoOnly?: boolean; usuario_id?: number } | undefined) => {
    const fail = checkPermissionOrFail(data, 'almacenes:list', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    const where = data?.activoOnly ? 'WHERE activo = 1' : ''
    return db.prepare(`SELECT * FROM almacenes ${where} ORDER BY nombre`).all()
  })

  handleIpc('almacenes:create', async (_event, data: { nombre: string; direccion?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'almacenes:create', 'inventario_create')
    if (fail) return fail
    if (!data?.nombre?.trim()) return { success: false, error: 'El nombre del almacén es obligatorio' }
    const db = getDatabase()
    try {
      const result = db.prepare('INSERT INTO almacenes (nombre, direccion) VALUES (?, ?)').run(data.nombre.trim(), data.direccion || null)
      return { success: true, id: result.lastInsertRowid }
    } catch (err: any) {
      if (String(err.message).includes('UNIQUE')) {
        return { success: false, error: 'Ya existe un almacén con ese nombre' }
      }
      throw err
    }
  })

  handleIpc('almacenes:update', async (_event, data: { id: number; data: { nombre?: string; direccion?: string; activo?: number }; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'almacenes:update', 'inventario_edit')
    if (fail) return fail
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE almacenes SET
        nombre = COALESCE(?, nombre),
        direccion = COALESCE(?, direccion),
        activo = COALESCE(?, activo)
      WHERE id = ?
    `).run(d.nombre ?? null, d.direccion ?? null, d.activo ?? null, data.id)
    return { success: true }
  })

  handleIpc('almacenes:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'almacenes:delete', 'inventario_delete')
    if (fail) return fail
    const db = getDatabase()
    if (data.id === 1) return { success: false, error: 'El almacén Principal no se puede eliminar' }
    const tieneStock = db.prepare('SELECT COUNT(*) as n FROM producto_almacen WHERE almacen_id = ? AND stock > 0').get(data.id) as any
    if (tieneStock?.n > 0) return { success: false, error: 'No se puede eliminar: el almacén tiene stock' }
    db.prepare('DELETE FROM producto_almacen WHERE almacen_id = ?').run(data.id)
    db.prepare('UPDATE almacenes SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })

  handleIpc('almacenes:stock', async (_event, data: { producto_id?: number; almacen_id?: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'almacenes:stock', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT pa.producto_id, pa.almacen_id, pa.stock, pa.actualizado_en,
        p.nombre as producto_nombre, p.unidad,
        a.nombre as almacen_nombre
      FROM producto_almacen pa
      JOIN productos p ON p.id = pa.producto_id
      JOIN almacenes a ON a.id = pa.almacen_id
      WHERE 1=1
    `
    const params: any[] = []
    if (data?.producto_id) {
      sql += ' AND pa.producto_id = ?'
      params.push(data.producto_id)
    }
    if (data?.almacen_id) {
      sql += ' AND pa.almacen_id = ?'
      params.push(data.almacen_id)
    }
    sql += ' ORDER BY p.nombre, a.nombre'
    return db.prepare(sql).all(...params)
  })

  handleIpc('almacenes:set-stock', async (_event, data: { producto_id: number; almacen_id: number; stock: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'almacenes:set-stock', 'inventario_edit')
    if (fail) return fail
    if (!data?.producto_id || !data?.almacen_id) return { success: false, error: 'producto_id y almacen_id son requeridos' }
    const db = getDatabase()
    db.prepare(`
      INSERT INTO producto_almacen (producto_id, almacen_id, stock, actualizado_en)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(producto_id, almacen_id) DO UPDATE SET stock = excluded.stock, actualizado_en = datetime('now')
    `).run(data.producto_id, data.almacen_id, data.stock)
    return { success: true }
  })
}
