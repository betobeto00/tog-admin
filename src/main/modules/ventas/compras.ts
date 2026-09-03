import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { compraCreateSchema } from '../../../shared/validations'

export function registerComprasHandlers(): void {
  ipcMain.handle('compras:list', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'compras:list', 'compras_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT c.*, p.nombre as proveedor_nombre, u.nombre as usuario_nombre
      FROM compras c
      LEFT JOIN proveedores p ON c.proveedor_id = p.id
      LEFT JOIN usuarios u ON c.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.fecha_inicio) {
      sql += ` AND DATE(c.fecha) >= ?`
      params.push(filters.fecha_inicio)
    }
    if (filters?.fecha_fin) {
      sql += ` AND DATE(c.fecha) <= ?`
      params.push(filters.fecha_fin)
    }

    sql += ` ORDER BY c.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('compras:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'compras:create', 'compras_create')
    if (fail) return fail
    const parsed = compraCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    const db = getDatabase()

    const createCompra = db.transaction(() => {
      const hoy = new Date().toISOString().split('T')[0]
      const lastCompra = db!.prepare(
        "SELECT MAX(numero_compra) as max_num FROM compras WHERE DATE(fecha) = ?"
      ).get(hoy) as any
      const numeroCompra = (lastCompra?.max_num || 0) + 1

      const result = db!.prepare(`
        INSERT INTO compras (numero_compra, proveedor_id, usuario_id, subtotal, impuesto, total, metodo_pago, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numeroCompra,
        data.proveedor_id || null,
        data.usuario_id,
        data.subtotal,
        data.impuesto,
        data.total,
        data.metodo_pago || 'efectivo',
        data.notas || null,
      )

      const compraId = result.lastInsertRowid

      const insertDetalle = db!.prepare(`
        INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, subtotal)
        VALUES (?, ?, ?, ?, ?)
      `)
      const updateStock = db!.prepare(
        'UPDATE productos SET stock = stock + ? WHERE id = ?'
      )

      for (const det of data.detalles) {
        insertDetalle.run(compraId, det.producto_id, det.cantidad, det.costo_unitario, det.subtotal)
        updateStock.run(det.cantidad, det.producto_id)
      }

      return { id: compraId, numero_compra: numeroCompra }
    })

    return createCompra()
  })
}