import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'
import { ventaCreateSchema } from '../../../shared/validations'
import { esCombo, explotar, agruparHojas } from '../inventario/combos'

/**
 * Crea una venta completa (validación, stock, combos, crédito/fiado y caja).
 * Compartido por `ventas:create` y el cobro de mesas del módulo Restaurant
 * (`comandas:checkout`).
 */
export function createVenta(data: any): any {
  const parsed = ventaCreateSchema.safeParse(data)
  if (!parsed.success) {
    return { success: false, error: parsed.error.errors[0].message }
  }
  const db = getDatabase()
  const esFiado = data.metodo_pago === 'fiado'
  let clienteRes: any = null

  if (data.cliente_id) {
    if (!getActiveModules().includes('distribuidor')) {
      return { success: false, error: 'El módulo Distribuidor no está activo en la licencia' }
    }
    const cliente = db.prepare('SELECT id, nombre, limite_credito FROM clientes WHERE id = ? AND activo = 1').get(data.cliente_id) as any
    if (!cliente) {
      return { success: false, error: 'Cliente no encontrado' }
    }
    clienteRes = cliente
    if (esFiado && cliente.limite_credito > 0) {
      const deuda = db.prepare(`
        SELECT COALESCE(SUM(saldo), 0) as total FROM creditos
        WHERE cliente_id = ? AND estado = 'pendiente'
      `).get(data.cliente_id) as any
      if ((deuda.total || 0) + data.total > cliente.limite_credito) {
        return {
          success: false,
          error: `Límite de crédito excedido para "${cliente.nombre}". Disponible: ${cliente.limite_credito - (deuda.total || 0)}`,
        }
      }
    }
  }

  // Validación de stock. Un producto compuesto valida sus hojas (componentes
  // sin componentes propios); un producto normal valida su propio stock.
  const hojasPorDetalle: Map<number, { producto_id: number; nombre: string; tipo: string; cantidad: number }[]> = new Map()
  for (let idx = 0; idx < data.detalles.length; idx++) {
    const det = data.detalles[idx]
    if (!det.producto_id) continue
    const producto = db.prepare('SELECT id, nombre, stock, tipo FROM productos WHERE id = ?').get(det.producto_id) as any
    if (!producto) {
      return { success: false, error: `Producto con ID ${det.producto_id} no encontrado` }
    }
    if (esCombo(db, det.producto_id)) {
      const hojas = agruparHojas(explotar(db, det.producto_id, det.cantidad))
      hojasPorDetalle.set(idx, hojas)
      for (const hoja of hojas) {
        if (hoja.tipo === 'servicio') continue
        const stockHoja = (db.prepare('SELECT stock FROM productos WHERE id = ?').get(hoja.producto_id) as any)?.stock ?? 0
        if (Number(stockHoja) < hoja.cantidad) {
          return { success: false, error: `Stock insuficiente de "${hoja.nombre}" para el combo "${producto.nombre}". Disponible: ${stockHoja}, Necesario: ${hoja.cantidad}` }
        }
      }
    } else if (producto.tipo !== 'servicio' && producto.stock < det.cantidad) {
      return { success: false, error: `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock}, Solicitado: ${det.cantidad}` }
    }
  }

  const insertVenta = db.transaction(() => {
    const hoy = new Date().toISOString().split('T')[0]
    const lastVenta = db!.prepare(
      "SELECT MAX(numero_venta) as max_num FROM ventas WHERE DATE(fecha) = ?"
    ).get(hoy) as any
    const numeroVenta = (lastVenta?.max_num || 0) + 1

    const result = db!.prepare(`
      INSERT INTO ventas (numero_venta, usuario_id, subtotal, impuesto, descuento, total,
        metodo_pago, monto_pagado, cambio, notas, cliente_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
      data.cliente_id || null,
    )

    const ventaId = result.lastInsertRowid

    const insertDetalle = db!.prepare(`
      INSERT INTO venta_detalles (venta_id, producto_id, descripcion, cantidad, precio_unitario, descuento, subtotal, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const updateStock = db!.prepare(
      "UPDATE productos SET stock = stock - ? WHERE id = ? AND tipo != 'servicio'"
    )
    const insertComponente = db!.prepare(
      'INSERT INTO venta_detalle_componentes (venta_detalle_id, componente_id, cantidad) VALUES (?, ?, ?)'
    )

    for (let idx = 0; idx < data.detalles.length; idx++) {
      const det = data.detalles[idx]
      const detalleResult = insertDetalle.run(
        ventaId,
        det.producto_id || null,
        det.descripcion || null,
        det.cantidad,
        det.precio_unitario,
        det.descuento,
        det.subtotal,
        det.notas || null,
      )
      const ventaDetalleId = detalleResult.lastInsertRowid
      const hojas = hojasPorDetalle.get(idx)
      if (det.producto_id && hojas) {
        // Combo: descontar stock de cada hoja y guardar snapshot para el desglose
        for (const hoja of hojas) {
          updateStock.run(hoja.cantidad, hoja.producto_id)
          insertComponente.run(ventaDetalleId, hoja.producto_id, hoja.cantidad)
        }
      } else if (det.producto_id) {
        updateStock.run(det.cantidad, det.producto_id)
      }
    }

    let creditoId: number | null = null
    if (esFiado) {
      const saldo = Math.max(0, data.total - (data.monto_pagado || 0))
      const resultCredito = db!.prepare(`
        INSERT INTO creditos (venta_id, cliente_id, deudor_nombre, deudor_telefono, deudor_documento,
          monto_total, saldo, estado, usuario_id, notas)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        ventaId,
        data.cliente_id || null,
        clienteRes ? clienteRes.nombre : (data.deudor_nombre || 'Cliente'),
        data.deudor_telefono || null,
        data.deudor_documento || null,
        data.total,
        saldo,
        saldo <= 0.005 ? 'pagado' : 'pendiente',
        data.usuario_id,
        data.notas || null,
      )
      creditoId = resultCredito.lastInsertRowid as number
    }

    const cajaAbierta = db!.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
    const montoCaja = esFiado ? (data.monto_pagado || 0) : data.total
    if (cajaAbierta && montoCaja > 0) {
      db!.prepare(`
        INSERT INTO movimientos_caja (caja_id, tipo, monto, descripcion, referencia_id)
        VALUES (?, 'venta', ?, ?, ?)
      `).run(cajaAbierta.id, montoCaja, esFiado ? `Venta #${numeroVenta} (fiado)` : `Venta #${numeroVenta}`, ventaId)

      db!.prepare('UPDATE caja SET total_ventas = total_ventas + ? WHERE id = ?').run(
        montoCaja, cajaAbierta.id,
      )
    }

    db!.prepare(
      "UPDATE configuracion SET valor = ? WHERE clave = 'ticket_numero_venta'"
    ).run(String(numeroVenta))

    return { id: ventaId, numero_venta: numeroVenta, credito_id: creditoId }
  })

  const result = insertVenta()
  return { success: true, ...result }
}

export function registerVentasHandlers(): void {
  handleIpc('ventas:list', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'ventas:list', 'pos_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT v.*, u.nombre as usuario_nombre,
        c.nombre as cliente_nombre, c.documento as cliente_documento
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON c.id = v.cliente_id
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
    if (filters?.search) {
      sql += ` AND CAST(v.numero_venta AS TEXT) LIKE ?`
      params.push(`%${filters.search}%`)
    }

    sql += ` ORDER BY v.fecha DESC`
    if (filters?.limite && Number.isInteger(filters.limite) && filters.limite > 0) {
      sql += ` LIMIT ?`
      params.push(filters.limite)
    }
    return db.prepare(sql).all(...params)
  })

  handleIpc('ventas:getById', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'ventas:getById', 'pos_access')
    if (fail) return fail
    const db = getDatabase()
    const venta = db.prepare(`
      SELECT v.*, u.nombre as usuario_nombre,
        c.nombre as cliente_nombre, c.documento as cliente_documento, c.telefono as cliente_telefono, c.direccion as cliente_direccion
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE v.id = ?
    `).get(data.id) as any

    if (venta) {
      venta.detalles = db.prepare(`
        SELECT vd.*, p.nombre as producto_nombre
        FROM venta_detalles vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
      `).all(data.id)
      // Desglose de combos: snapshot de componentes consumidos por cada línea
      const detalles = venta.detalles as any[]
      const stmt = db.prepare(`
        SELECT vdc.componente_id, vdc.cantidad, p.nombre as nombre, p.tipo as tipo
        FROM venta_detalle_componentes vdc
        LEFT JOIN productos p ON p.id = vdc.componente_id
        WHERE vdc.venta_detalle_id = ?
        ORDER BY vdc.id
      `)
      for (const d of detalles) {
        d.componentes = stmt.all(d.id)
      }
    }

    return venta
  })

  handleIpc('ventas:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'ventas:create', 'pos_access')
    if (fail) return fail
    return createVenta(data)
  })

  handleIpc('ventas:anular', async (_event, data: { id: number; motivo: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'ventas:anular', 'pos_void_sale')
    if (fail) return fail
    const db = getDatabase()

    const credito = db.prepare('SELECT id, estado FROM creditos WHERE venta_id = ?').get(data.id) as any
    if (credito) {
      const abonos = db.prepare('SELECT COUNT(*) as cantidad FROM credito_abonos WHERE credito_id = ?').get(credito.id) as any
      if ((abonos?.cantidad || 0) > 0 || credito.estado !== 'pendiente') {
        return { success: false, error: 'No se puede anular: la venta tiene un crédito con abonos o cobros registrados' }
      }
    }

    const anularVenta = db.transaction(() => {
      const detalles = db!.prepare(`
        SELECT vd.id as detalle_id, vd.producto_id, vd.cantidad, p.tipo as tipo
        FROM venta_detalles vd
        LEFT JOIN productos p ON vd.producto_id = p.id
        WHERE vd.venta_id = ?
      `).all(data.id) as any[]

      const updateStock = db!.prepare(
        "UPDATE productos SET stock = stock + ? WHERE id = ? AND tipo != 'servicio'"
      )
      const componentesDetalle = db!.prepare(
        'SELECT componente_id, cantidad FROM venta_detalle_componentes WHERE venta_detalle_id = ?'
      ) as any
      const tipoComponente = db!.prepare('SELECT tipo FROM productos WHERE id = ?')
      for (const det of detalles) {
        // Si el detalle fue un combo, el stock se descontó de sus componentes: restaurar desde el snapshot.
        const comps = componentesDetalle.all(det.detalle_id) as { componente_id: number; cantidad: number }[]
        if (comps.length > 0) {
          for (const c of comps) {
            const tipo = (tipoComponente.get(c.componente_id) as any)?.tipo
            if (tipo !== 'servicio') updateStock.run(c.cantidad, c.componente_id)
          }
        } else if (det.producto_id && det.tipo !== 'servicio') {
          updateStock.run(det.cantidad, det.producto_id)
        }
      }

      db!.prepare("UPDATE ventas SET estado = 'anulada', notas = ? WHERE id = ?").run(
        data.motivo,
        data.id,
      )

      if (credito && credito.estado === 'pendiente') {
        db!.prepare("UPDATE creditos SET estado = 'anulado' WHERE id = ?").run(credito.id)
      }

      return { success: true }
    })

    return anularVenta()
  })

  handleIpc('ventas:resumen-dia', async (_event, data?: { fecha?: string; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'ventas:resumen-dia', 'caja_report_x')
    if (fail) return fail
    const db = getDatabase()
    const fecha = data?.fecha || new Date().toISOString().split('T')[0]

    const filas = db.prepare(`
      SELECT
        COUNT(*) as total_ventas,
        COALESCE(SUM(total), 0) as monto_total,
        COALESCE(SUM(CASE WHEN metodo_pago = 'efectivo' THEN total ELSE 0 END), 0) as efectivo,
        COALESCE(SUM(CASE WHEN metodo_pago = 'transferencia' THEN total ELSE 0 END), 0) as transferencia,
        COALESCE(SUM(CASE WHEN metodo_pago = 'pago_movil' THEN total ELSE 0 END), 0) as pago_movil,
        COALESCE(SUM(CASE WHEN metodo_pago = 'fiado' THEN total ELSE 0 END), 0) as fiado
      FROM ventas
      WHERE DATE(fecha) = ? AND estado = 'completada'
    `).get(fecha) as any

    const por_metodo = db.prepare(`
      SELECT v.metodo_pago as clave,
             COALESCE(m.nombre, v.metodo_pago) as nombre,
             COALESCE(SUM(v.total), 0) as total
      FROM ventas v
      LEFT JOIN metodos_pago m ON m.clave = v.metodo_pago
      WHERE DATE(v.fecha) = ? AND v.estado = 'completada'
      GROUP BY v.metodo_pago, m.nombre
      ORDER BY m.orden, v.metodo_pago
    `).all(fecha)

    return { ...filas, por_metodo }
  })
}