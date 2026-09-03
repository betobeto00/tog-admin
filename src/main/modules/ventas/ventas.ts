import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { checkPermissionOrFail } from '../../core/auth'
import { ventaCreateSchema } from '../../../shared/validations'

export function registerVentasHandlers(): void {
  ipcMain.handle('ventas:list', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'ventas:list', 'pos_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT v.*, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []

    if (filters?.fecha_inicio) {
      sql += ` AND v.fecha >= ?`
      params.push(filters.fecha_inicio)
    }
    if (filters?.fecha_fin) {
      sql += ` AND v.fecha <= ?`
      params.push(filters.fecha_fin + ' 23:59:59')
    }

    sql += ` ORDER BY v.fecha DESC`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('ventas:getById', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'ventas:getById', 'pos_access')
    if (fail) return fail
    const db = getDatabase()
    const venta = db.prepare(`
      SELECT v.*, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.id = ?
    `).get(data.id) as any

    if (venta) {
      venta.detalles = db.prepare(`
        SELECT vd.*, p.nombre as producto_nombre
        FROM venta_detalles vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
      `).all(data.id)
    }

    return venta
  })

  ipcMain.handle('ventas:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'ventas:create', 'pos_access')
    if (fail) return fail
    const parsed = ventaCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }

    const db = getDatabase()

    for (const det of data.detalles) {
      const producto = db.prepare('SELECT id, nombre, stock, unidad FROM productos WHERE id = ?').get(det.producto_id) as any
      if (!producto) {
        return { success: false, error: `Producto con ID ${det.producto_id} no encontrado` }
      }
      if (producto.unidad !== 'servicio' && producto.stock < det.cantidad) {
        return { success: false, error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}, Solicitado: ${det.cantidad}` }
      }
    }

    const createVenta = db.transaction(() => {
      const hoy = new Date().toISOString().split('T')[0]
      const lastVenta = db!.prepare(
        "SELECT MAX(numero_venta) as max_num FROM ventas WHERE DATE(fecha) = ?"
      ).get(hoy) as any
      const numeroVenta = (lastVenta?.max_num || 0) + 1

      const result = db!.prepare(`
        INSERT INTO ventas (numero_venta, usuario_id, subtotal, impuesto, descuento, total,
          metodo_pago, monto_pagado, cambio, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numeroVenta,
        data.usuario_id,
        data.subtotal,
        data.impuesto,
        data.descuento,
        data.total,
        data.metodo_pago,
        data.monto_pagado,
        data.cambio,
        data.notas || null,
      )

      const ventaId = result.lastInsertRowid

      const insertDetalle = db!.prepare(`
        INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, descuento, subtotal, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      const updateStock = db!.prepare(
        'UPDATE productos SET stock = stock - ? WHERE id = ?'
      )

      for (const det of data.detalles) {
        insertDetalle.run(
          ventaId, det.producto_id, det.cantidad,
          det.precio_unitario, det.descuento, det.subtotal,
          det.notas || null,
        )
        updateStock.run(det.cantidad, det.producto_id)
      }

      const cajaAbierta = db!.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
      if (cajaAbierta) {
        db!.prepare(`
          INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, referencia_id)
          VALUES (?, 'venta', ?, ?, ?)
        `).run(cajaAbierta.id, data.total, `Venta #${numeroVenta}`, ventaId)

        db!.prepare('UPDATE caja SET total_ventas = total_ventas + ? WHERE id = ?').run(
          data.total, cajaAbierta.id,
        )
      }

      db!.prepare(
        "UPDATE configuracion SET valor = ? WHERE clave = 'ticket_numero_venta'"
      ).run(String(numeroVenta))

      return { id: ventaId, numero_venta: numeroVenta }
    })

    const result = createVenta()
    return { success: true, ...result }
  })

  ipcMain.handle('ventas:anular', async (_event, data: { id: number; motivo: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'ventas:anular', 'pos_void_sale')
    if (fail) return fail
    const db = getDatabase()

    const anularVenta = db.transaction(() => {
      const detalles = db!.prepare(
        'SELECT producto_id, cantidad FROM venta_detalles WHERE venta_id = ?'
      ).all(data.id) as any[]

      const updateStock = db!.prepare(
        'UPDATE productos SET stock = stock + ? WHERE id = ?'
      )
      for (const det of detalles) {
        updateStock.run(det.cantidad, det.producto_id)
      }

      db!.prepare("UPDATE ventas SET estado = 'anulada', notas = ? WHERE id = ?").run(
        data.motivo,
        data.id,
      )

      return { success: true }
    })

    return anularVenta()
  })

  ipcMain.handle('ventas:resumen-dia', async (_event, data?: { fecha?: string; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'ventas:resumen-dia', 'caja_report_x')
    if (fail) return fail
    const db = getDatabase()
    const fecha = data?.fecha || new Date().toISOString().split('T')[0]

    return db.prepare(`
      SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) as transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'pago_movil' THEN total ELSE 0 END), 0) as pago_movil
      FROM ventas
      WHERE DATE(fecha) = ? AND estado = 'completada'
    `).get(fecha)
  })
}