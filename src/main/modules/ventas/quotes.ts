import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { quoteCreateSchema } from '../../../shared/validations'
import type { PermissionKey } from '../../../shared/permissions'

export function registerQuotesHandlers(): void {
  handleIpc('quotes:list', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'quotes:list', 'quotes_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `SELECT q.*, u.nombre as usuario_nombre FROM quotes q LEFT JOIN usuarios u ON q.usuario_id = u.id WHERE 1=1`
    const params: any[] = []
    if (filters?.estado) { sql += ` AND q.estado = ?`; params.push(filters.estado) }
    if (filters?.search) {
      sql += ` AND (q.cliente_nombre LIKE ? OR q.numero_cotizacion LIKE ?)`
      const term = `%${filters.search}%`; params.push(term, term)
    }
    sql += ` ORDER BY q.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  handleIpc('quotes:getById', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'quotes:getById', 'quotes_access')
    if (fail) return fail
    const db = getDatabase()
    const quote = db.prepare(`SELECT q.*, u.nombre as usuario_nombre FROM quotes q LEFT JOIN usuarios u ON q.usuario_id = u.id WHERE q.id = ?`).get(data.id) as any
    if (quote) {
      quote.detalles = db.prepare(`SELECT qd.*, p.nombre as producto_nombre FROM quote_detalles qd LEFT JOIN productos p ON qd.producto_id = p.id WHERE qd.quote_id = ?`).all(data.id)
    }
    return quote
  })

  handleIpc('quotes:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'quotes:create', 'quotes_create')
    if (fail) return fail
    const parsed = quoteCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const createQuote = db.transaction(() => {
      const lastNum = db!.prepare('SELECT MAX(numero_cotizacion) as max_num FROM quotes').get() as any
      const numero = (lastNum?.max_num || 0) + 1
      const result = db!.prepare(`
        INSERT INTO quotes (numero_cotizacion, fecha_vencimiento, cliente_nombre, cliente_email, cliente_telefono, cliente_direccion, subtotal, impuesto, descuento, total, notas, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(numero, data.fecha_vencimiento || null, data.cliente_nombre, data.cliente_email || null, data.cliente_telefono || null, data.cliente_direccion || null, data.subtotal, data.impuesto, data.descuento, data.total, data.notas || null, data.usuario_id)
      const quoteId = result.lastInsertRowid
      const insertDet = db!.prepare('INSERT INTO quote_detalles (quote_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const d of data.detalles) {
        insertDet.run(quoteId, d.producto_id || null, d.descripcion, d.cantidad, d.precio_unitario, d.descuento || 0, d.subtotal)
      }
      return { id: quoteId, numero_cotizacion: numero }
    })
    return createQuote()
  })

  handleIpc('quotes:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'quotes:update', 'quotes_edit')
    if (fail) return fail
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE quotes SET cliente_nombre = COALESCE(?, cliente_nombre), cliente_email = COALESCE(?, cliente_email),
      cliente_telefono = COALESCE(?, cliente_telefono), cliente_direccion = COALESCE(?, cliente_direccion),
      subtotal = COALESCE(?, subtotal), impuesto = COALESCE(?, impuesto), descuento = COALESCE(?, descuento),
      total = COALESCE(?, total), notas = COALESCE(?, notas), estado = COALESCE(?, estado),
      fecha_vencimiento = COALESCE(?, fecha_vencimiento), actualizado_en = datetime('now') WHERE id = ?
    `).run(d.cliente_nombre, d.cliente_email, d.cliente_telefono, d.cliente_direccion, d.subtotal, d.impuesto, d.descuento, d.total, d.notas, d.estado, d.fecha_vencimiento, data.id)
    if (d.detalles) {
      db.prepare('DELETE FROM quote_detalles WHERE quote_id = ?').run(data.id)
      const insertDet = db!.prepare('INSERT INTO quote_detalles (quote_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal) VALUES (?, ?, ?, ?, ?, ?, ?)')
      for (const det of d.detalles) {
        insertDet.run(data.id, det.producto_id || null, det.descripcion, det.cantidad, det.precio_unitario, det.descuento || 0, det.subtotal)
      }
    }
    return { success: true }
  })

  handleIpc('quotes:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'quotes:delete', 'quotes_delete')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('DELETE FROM quote_detalles WHERE quote_id = ?').run(data.id)
    db.prepare('DELETE FROM quotes WHERE id = ?').run(data.id)
    return { success: true }
  })
}