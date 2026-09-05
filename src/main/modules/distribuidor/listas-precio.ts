import { handleIpc } from '../../core/auth/ipc-guard'
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
  handleIpc('listas-precio:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:list', 'distribuidor_listas_precio_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare('SELECT * FROM listas_precio ORDER BY nombre').all()
  })

  handleIpc('listas-precio:create', async (_event, data: { nombre: string; factor: number; usuario_id: number }) => {
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

  handleIpc('listas-precio:update', async (_event, data: { id: number; data: { nombre?: string; factor?: number; activo?: number }; usuario_id: number }) => {
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

  handleIpc('listas-precio:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:delete', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare('DELETE FROM lista_precio_productos WHERE lista_id = ?').run(data.id)
    db.prepare('DELETE FROM cliente_lista_precio WHERE lista_id = ?').run(data.id)
    db.prepare('DELETE FROM listas_precio WHERE id = ?').run(data.id)
    return { success: true }
  })

  // ======== PRODUCTOS DE UNA LISTA (precio override) ========
  handleIpc('listas-precio:productos', async (_event, data: { lista_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:productos', 'distribuidor_listas_precio_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare(`
      SELECT lpp.id, lpp.lista_id, lpp.producto_id, lpp.precio_override,
        p.nombre as producto_nombre, p.precio_venta, p.unidad
      FROM lista_precio_productos lpp
      JOIN productos p ON p.id = lpp.producto_id
      WHERE lpp.lista_id = ?
      ORDER BY p.nombre
    `).all(data.lista_id)
  })

  handleIpc('listas-precio:set-producto', async (_event, data: { lista_id: number; producto_id: number; precio_override: number | null; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:set-producto', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.lista_id || !data.producto_id) return { success: false, error: 'lista_id y producto_id son requeridos' }
    const db = getDatabase()
    if (data.precio_override == null) {
      db.prepare('DELETE FROM lista_precio_productos WHERE lista_id = ? AND producto_id = ?').run(data.lista_id, data.producto_id)
      return { success: true }
    }
    db.prepare(`
      INSERT INTO lista_precio_productos (lista_id, producto_id, precio_override)
      VALUES (?, ?, ?)
      ON CONFLICT(lista_id, producto_id) DO UPDATE SET precio_override = excluded.precio_override
    `).run(data.lista_id, data.producto_id, data.precio_override)
    return { success: true }
  })

  // ======== CLIENTES ASIGNADOS A UNA LISTA ========
  handleIpc('listas-precio:clientes', async (_event, data: { lista_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:clientes', 'distribuidor_listas_precio_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare(`
      SELECT clp.lista_id, clp.cliente_id, c.nombre, c.documento
      FROM cliente_lista_precio clp
      JOIN clientes c ON c.id = clp.cliente_id
      WHERE clp.lista_id = ?
      ORDER BY c.nombre
    `).all(data.lista_id)
  })

  handleIpc('listas-precio:set-cliente', async (_event, data: { lista_id: number; cliente_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:set-cliente', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare(`
      INSERT OR IGNORE INTO cliente_lista_precio (cliente_id, lista_id) VALUES (?, ?)
    `).run(data.cliente_id, data.lista_id)
    return { success: true }
  })

  handleIpc('listas-precio:unset-cliente', async (_event, data: { lista_id: number; cliente_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'listas-precio:unset-cliente', 'distribuidor_listas_precio_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare('DELETE FROM cliente_lista_precio WHERE lista_id = ? AND cliente_id = ?').run(data.lista_id, data.cliente_id)
    return { success: true }
  })
}