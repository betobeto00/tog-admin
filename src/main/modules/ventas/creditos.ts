import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { creditoAbonoSchema } from '../../../shared/validations'

export function registerCreditosHandlers(): void {
  handleIpc('creditos:list', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'creditos:list', 'creditos_view')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT c.*, cl.nombre as cliente_nombre, v.numero_venta
      FROM creditos c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      LEFT JOIN ventas v ON c.venta_id = v.id
      WHERE 1=1
    `
    const params: any[] = []
    if (filters?.estado) {
      sql += ` AND c.estado = ?`
      params.push(filters.estado)
    }
    if (filters?.search) {
      sql += ` AND (c.deudor_nombre LIKE ? OR cl.nombre LIKE ? OR c.deudor_documento LIKE ? OR c.deudor_telefono LIKE ?)`
      const term = `%${filters.search}%`
      params.push(term, term, term, term)
    }
    sql += ` ORDER BY CASE c.estado WHEN 'pendiente' THEN 0 ELSE 1 END, c.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  handleIpc('creditos:getById', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'creditos:getById', 'creditos_view')
    if (fail) return fail
    const db = getDatabase()
    const credito = db.prepare(`
      SELECT c.*, cl.nombre as cliente_nombre, v.numero_venta, v.fecha as venta_fecha
      FROM creditos c
      LEFT JOIN clientes cl ON c.cliente_id = cl.id
      LEFT JOIN ventas v ON c.venta_id = v.id
      WHERE c.id = ?
    `).get(data.id) as any

    if (credito) {
      credito.abonos = db.prepare(`
        SELECT a.*, u.nombre as usuario_nombre
        FROM credito_abonos a
        LEFT JOIN usuarios u ON a.usuario_id = u.id
        WHERE a.credito_id = ?
        ORDER BY a.fecha ASC
      `).all(data.id)
      credito.detalles = db.prepare(`
        SELECT vd.*, p.nombre as producto_nombre
        FROM venta_detalles vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
      `).all(credito.venta_id)
    }

    return credito
  })

  handleIpc('creditos:abono', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'creditos:abono', 'creditos_edit')
    if (fail) return fail
    const parsed = creditoAbonoSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()

    const registrar = db.transaction(() => {
      const credito = db!.prepare(`
        SELECT c.*, COALESCE(cl.nombre, c.deudor_nombre, '') as deudor_display
        FROM creditos c
        LEFT JOIN clientes cl ON c.cliente_id = cl.id
        WHERE c.id = ? AND c.estado = 'pendiente'
      `).get(data.credito_id) as any
      if (!credito) {
        return { success: false, error: 'Crédito no encontrado o ya está pagado' }
      }
      if (data.monto > credito.saldo) {
        return { success: false, error: `El abono (${data.monto}) supera el saldo pendiente (${credito.saldo})` }
      }

      db!.prepare(`
        INSERT INTO credito_abonos (credito_id, monto, usuario_id, notas)
        VALUES (?, ?, ?, ?)
      `).run(data.credito_id, data.monto, data.usuario_id, data.notas || null)

      const nuevoSaldo = credito.saldo - data.monto
      const estado = nuevoSaldo <= 0.005 ? 'pagado' : 'pendiente'
      db!.prepare('UPDATE creditos SET saldo = ?, estado = ?, notas = COALESCE(?, notas) WHERE id = ?').run(
        Math.max(0, nuevoSaldo),
        estado,
        data.notas || null,
        data.credito_id,
      )

      const cajaAbierta = db!.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
      if (cajaAbierta) {
        db!.prepare(`
          INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, referencia_id)
          VALUES (?, 'entrada', ?, ?, ?)
        `).run(cajaAbierta.id, data.monto, `Abono crédito #${credito.id} — ${credito.deudor_display}`, data.credito_id)
        db!.prepare('UPDATE caja SET total_entradas = total_entradas + ? WHERE id = ?').run(
          data.monto, cajaAbierta.id,
        )
      }

      return { success: true, saldo: Math.max(0, nuevoSaldo), estado }
    })

    return registrar()
  })
}
