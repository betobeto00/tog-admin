import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { checkPermissionOrFail } from '../../core/auth'

export function registerCajaHandlers(): void {
  handleIpc('caja:status', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'caja:status', 'caja_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare(`
      SELECT c.*, u.nombre as usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.estado = 'abierta'
      ORDER BY c.fecha_apertura DESC
      LIMIT 1
    `).get()
  })

  handleIpc('caja:abrir', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'caja:abrir', 'caja_open')
    if (fail) return fail
    const db = getDatabase()

    const abierta = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get()
    if (abierta) {
      return { success: false, error: t('errors.cashAlreadyOpen') }
    }

    const result = db.prepare(
      'INSERT INTO caja (usuario_id, fondo_inicial) VALUES (?, ?)'
    ).run(data.usuario_id, data.fondo_inicial)

    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('caja:cerrar', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'caja:cerrar', 'caja_close')
    if (fail) return fail
    const db = getDatabase()

    const cerrarCaja = db.transaction(() => {
      const caja = db!.prepare('SELECT * FROM caja WHERE id = ?').get(data.caja_id) as any
      if (!caja) return { success: false, error: t('errors.notFound') }

      const totalEsperado = caja.fondo_inicial + caja.total_entradas - caja.total_salidas + caja.total_ventas
      const diferencia = data.total_real - totalEsperado

      db!.prepare(`
        UPDATE caja SET
          total_esperado = ?,
          total_real = ?,
          diferencia = ?,
          notas = COALESCE(?, notas),
          estado = 'cerrada',
          fecha_cierre = datetime('now'),
          cerrado_en = datetime('now')
        WHERE id = ?
      `).run(totalEsperado, data.total_real, diferencia, data.notas || null, data.caja_id)

      return { success: true, diferencia }
    })

    return cerrarCaja()
  })

  handleIpc('caja:movimiento', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'caja:movimiento', 'caja_movement')
    if (fail) return fail
    const db = getDatabase()

    const cajaAbierta = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
    if (!cajaAbierta) {
      return { success: false, error: t('errors.cashNotOpen') }
    }

    db.prepare(`
      INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion)
      VALUES (?, ?, ?, ?)
    `).run(cajaAbierta.id, data.tipo, data.monto, data.descripcion)

    if (data.tipo === 'entrada') {
      db.prepare('UPDATE caja SET total_entradas = total_entradas + ? WHERE id = ?').run(data.monto, cajaAbierta.id)
    } else if (data.tipo === 'salida' || data.tipo === 'retiro') {
      db.prepare('UPDATE caja SET total_salidas = total_salidas + ? WHERE id = ?').run(data.monto, cajaAbierta.id)
    }

    return { success: true }
  })

  handleIpc('caja:historial', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'caja:historial', 'caja_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT c.*, u.nombre as usuario_nombre
      FROM caja c
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.fecha_inicio) {
      sql += ` AND DATE(c.fecha_apertura) >= ?`
      params.push(filters.fecha_inicio)
    }
    if (filters?.fecha_fin) {
      sql += ` AND DATE(c.fecha_apertura) <= ?`
      params.push(filters.fecha_fin)
    }

    sql += ` ORDER BY c.fecha_apertura DESC`
    return db.prepare(sql).all(...params)
  })
}