import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('productor')) {
    return { success: false, error: 'El módulo Productor no está activo en la licencia' }
  }
  return null
}

export function registerProductorHandlers(): void {
  // ===== Cultivos (catálogo) =====
  handleIpc('productor:cultivos-list', async (_event, data?: { incluirInactivos?: boolean; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cultivos-list', 'productor_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const filtro = data?.incluirInactivos ? '' : 'WHERE activo = 1'
    return db.prepare(`SELECT * FROM cultivos ${filtro} ORDER BY nombre`).all()
  })

  handleIpc('productor:cultivo-create', async (_event, data: { nombre: string; variedad?: string; unidad?: string; notas?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cultivo-create', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.nombre?.trim()) return { success: false, error: 'El nombre del cultivo es obligatorio' }
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO cultivos (nombre, variedad, unidad, notas) VALUES (?, ?, ?, ?)
    `).run(data.nombre.trim(), data.variedad?.trim() || null, data.unidad?.trim() || 'kg', data.notas?.trim() || null)
    return { id: result.lastInsertRowid }
  })

  handleIpc('productor:cultivo-update', async (_event, data: { id: number; data: { nombre?: string; variedad?: string; unidad?: string; notas?: string; activo?: number }; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cultivo-update', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(data.data || {})) {
      if (['nombre', 'variedad', 'unidad', 'notas', 'activo'].includes(k)) {
        campos.push(`${k} = ?`)
        valores.push(v)
      }
    }
    if (!campos.length) return { success: false, error: 'Nada que actualizar' }
    valores.push(data.id)
    db.prepare(`UPDATE cultivos SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    return { success: true }
  })

  // ===== Siembras =====
  handleIpc('productor:siembras-list', async (_event, data?: { estado?: string; cultivo_id?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:siembras-list', 'productor_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (data?.estado) { condiciones.push('s.estado = ?'); params.push(data.estado) }
    if (data?.cultivo_id) { condiciones.push('s.cultivo_id = ?'); params.push(data.cultivo_id) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(`
      SELECT s.*, c.nombre as cultivo_nombre, c.unidad,
        COALESCE((SELECT SUM(monto) FROM costos_campo cc WHERE cc.siembra_id = s.id), 0) as costos_total,
        (SELECT COUNT(*) FROM costos_campo cc2 WHERE cc2.siembra_id = s.id) as costos_cantidad
      FROM siembras s
      JOIN cultivos c ON c.id = s.cultivo_id
      ${where}
      ORDER BY s.fecha_siembra DESC, s.id DESC
    `).all(...params)
  })

  handleIpc('productor:siembra-create', async (_event, data: {
    cultivo_id: number; descripcion?: string; fecha_siembra?: string
    area?: number; unidad_area?: string; cantidad_sembrada?: number; notas?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'productor:siembra-create', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const cultivo = db.prepare('SELECT id FROM cultivos WHERE id = ? AND activo = 1').get(data.cultivo_id) as any
    if (!cultivo) return { success: false, error: 'Cultivo no encontrado' }
    const result = db.prepare(`
      INSERT INTO siembras (cultivo_id, descripcion, fecha_siembra, area, unidad_area, cantidad_sembrada, notas, usuario_id)
      VALUES (?, ?, COALESCE(?, date('now')), ?, ?, ?, ?, ?)
    `).run(
      data.cultivo_id, data.descripcion?.trim() || null, data.fecha_siembra || null,
      data.area || 0, data.unidad_area?.trim() || 'ha', data.cantidad_sembrada || 0,
      data.notas?.trim() || null, data.usuario_id ?? null,
    )
    return { id: result.lastInsertRowid }
  })

  /** Cosecha: cierra la siembra y registra el costo unitario real del cultivo. */
  handleIpc('productor:siembra-cosechar', async (_event, data: { id: number; fecha_cosecha?: string; cantidad_cosechada: number; notas?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:siembra-cosechar', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()

    const cosechar = db.transaction(() => {
      const siembra = db!.prepare(`
        SELECT s.id, s.cultivo_id, s.estado, c.nombre as cultivo_nombre,
          COALESCE((SELECT SUM(monto) FROM costos_campo cc WHERE cc.siembra_id = s.id), 0) as costos_total
        FROM siembras s JOIN cultivos c ON c.id = s.cultivo_id
        WHERE s.id = ?
      `).get(data.id) as any
      if (!siembra) throw new Error('Siembra no encontrada')
      if (siembra.estado !== 'activa') throw new Error('La siembra ya fue cosechada o cancelada')
      if (!(data.cantidad_cosechada > 0)) throw new Error('La cantidad cosechada debe ser mayor a cero')

      const fecha = data.fecha_cosecha || new Date().toISOString().slice(0, 10)
      db!.prepare("UPDATE siembras SET estado = 'cosechada', fecha_cosecha = ?, cantidad_cosechada = ?, notas = COALESCE(?, notas) WHERE id = ?")
        .run(fecha, data.cantidad_cosechada, data.notas?.trim() || null, data.id)

      // Costo unitario real = costos de campo / cantidad cosechada
      const costoUnitario = data.cantidad_cosechada > 0 ? siembra.costos_total / data.cantidad_cosechada : 0
      return { success: true as const, costo_unitario: Math.round(costoUnitario * 100) / 100, costos_total: siembra.costos_total, cultivo: siembra.cultivo_nombre }
    })

    try {
      return cosechar()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al cosechar' }
    }
  })

  // ===== Costos de campo =====
  handleIpc('productor:costos-list', async (_event, data?: { siembra_id?: number; desde?: string; hasta?: string; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:costos-list', 'productor_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (data?.siembra_id) { condiciones.push('cc.siembra_id = ?'); params.push(data.siembra_id) }
    if (data?.desde) { condiciones.push('cc.fecha >= ?'); params.push(data.desde) }
    if (data?.hasta) { condiciones.push('cc.fecha <= ?'); params.push(data.hasta) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(`
      SELECT cc.*, s.descripcion as siembra_descripcion, c.nombre as cultivo_nombre
      FROM costos_campo cc
      JOIN siembras s ON s.id = cc.siembra_id
      JOIN cultivos c ON c.id = s.cultivo_id
      ${where}
      ORDER BY cc.fecha DESC, cc.id DESC
    `).all(...params)
  })

  handleIpc('productor:costo-create', async (_event, data: { siembra_id: number; concepto: string; monto: number; fecha?: string; notas?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:costo-create', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.concepto?.trim()) return { success: false, error: 'El concepto es obligatorio' }
    if (!(data.monto > 0)) return { success: false, error: 'El monto debe ser mayor a cero' }
    const db = getDatabase()
    const siembra = db.prepare('SELECT id FROM siembras WHERE id = ?').get(data.siembra_id) as any
    if (!siembra) return { success: false, error: 'Siembra no encontrada' }
    const result = db.prepare(`
      INSERT INTO costos_campo (siembra_id, fecha, concepto, monto, notas, usuario_id)
      VALUES (?, COALESCE(?, date('now')), ?, ?, ?, ?)
    `).run(data.siembra_id, data.fecha || null, data.concepto.trim(), data.monto, data.notas?.trim() || null, data.usuario_id ?? null)
    return { id: result.lastInsertRowid }
  })
}
