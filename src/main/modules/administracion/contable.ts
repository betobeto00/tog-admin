import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('administracion')) {
    return { success: false, error: 'El módulo Administración no está activo en la licencia' }
  }
  return null
}

interface Periodo {
  desde: string
  hasta: string
}

function resolverPeriodo(data: { desde?: string; hasta?: string }): Periodo {
  const hoy = new Date()
  const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
  const desde = data?.desde || primerDia.toISOString().slice(0, 10)
  const hasta = data?.hasta || hoy.toISOString().slice(0, 10)
  return { desde, hasta: `${hasta} 23:59:59` }
}

const toCSV = (headers: string[], rows: (string | number | null)[][]): string => {
  const esc = (v: string | number | null) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [headers.map(esc).join(';'), ...rows.map((r) => r.map(esc).join(';'))].join('\n')
}

export function registerContableHandlers(): void {
  handleIpc('contable:libro-ventas', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:libro-ventas', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)
    const filas = db.prepare(`
      SELECT v.id, v.numero_venta, v.fecha, c.nombre as cliente_nombre, v.subtotal, v.descuento,
             v.impuesto, v.total, v.metodo_pago, v.estado,
             (SELECT COUNT(*) FROM venta_detalles vd WHERE vd.venta_id = v.id) as lineas
      FROM ventas v
      LEFT JOIN clientes c ON c.id = v.cliente_id
      WHERE v.fecha BETWEEN ? AND ? AND v.estado NOT IN ('anulada', 'borrador')
      ORDER BY v.fecha, v.numero_venta
    `).all(desde, hasta)
    const totales = filas.reduce(
      (acc: { base: number; descuento: number; impuesto: number; total: number }, f: any) => ({
        base: acc.base + (f.subtotal || 0),
        descuento: acc.descuento + (f.descuento || 0),
        impuesto: acc.impuesto + (f.impuesto || 0),
        total: acc.total + (f.total || 0),
      }),
      { base: 0, descuento: 0, impuesto: 0, total: 0 },
    )
    return { periodo: { desde, hasta }, filas, totales, csv: toCSV(
      ['Numero', 'Fecha', 'Cliente', 'Base', 'Descuento', 'Impuesto', 'Total', 'MetodoPago', 'Estado'],
      filas.map((f: any) => [f.numero_venta, f.fecha, f.cliente_nombre, f.subtotal, f.descuento, f.impuesto, f.total, f.metodo_pago, f.estado]),
    ) }
  })

  handleIpc('contable:libro-compras', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:libro-compras', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)
    const filas = db.prepare(`
      SELECT co.id, co.numero_compra, co.fecha, p.nombre as proveedor_nombre, co.subtotal, co.impuesto,
             co.total, co.metodo_pago, co.estado,
             (SELECT COUNT(*) FROM compra_detalles cd WHERE cd.compra_id = co.id) as lineas
      FROM compras co
      LEFT JOIN proveedores p ON p.id = co.proveedor_id
      WHERE co.fecha BETWEEN ? AND ? AND co.estado <> 'anulada'
      ORDER BY co.fecha, co.numero_compra
    `).all(desde, hasta)
    const totales = filas.reduce(
      (acc: { base: number; impuesto: number; total: number }, f: any) => ({
        base: acc.base + (f.subtotal || 0),
        impuesto: acc.impuesto + (f.impuesto || 0),
        total: acc.total + (f.total || 0),
      }),
      { base: 0, impuesto: 0, total: 0 },
    )
    return { periodo: { desde, hasta }, filas, totales, csv: toCSV(
      ['Numero', 'Fecha', 'Proveedor', 'Base', 'Impuesto', 'Total', 'MetodoPago', 'Estado'],
      filas.map((f: any) => [f.numero_compra, f.fecha, f.proveedor_nombre, f.subtotal, f.impuesto, f.total, f.metodo_pago, f.estado]),
    ) }
  })

  handleIpc('contable:libro-inventario', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:libro-inventario', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)
    const filas = db.prepare(`
      SELECT a.id, a.fecha, p.nombre as producto_nombre, p.unidad, a.diferencia as cantidad, a.stock_anterior, a.stock_nuevo, a.justificacion as motivo
      FROM ajustes_inventario a
      JOIN productos p ON p.id = a.producto_id
      WHERE a.fecha BETWEEN ? AND ?
      ORDER BY a.fecha
    `).all(desde, hasta)
    const kardex = db.prepare(`
      SELECT p.id, p.nombre, p.unidad, p.stock, COALESCE(p.costo_real, p.precio_compra) as costo_unitario,
        p.stock * COALESCE(p.costo_real, p.precio_compra) as valor_stock,
        COALESCE((SELECT SUM(cd.cantidad) FROM compra_detalles cd JOIN compras c2 ON c2.id = cd.compra_id
          WHERE cd.producto_id = p.id AND c2.fecha BETWEEN ? AND ? AND c2.estado <> 'anulada'), 0) as entradas_compras,
        COALESCE((SELECT SUM(vd.cantidad) FROM venta_detalles vd JOIN ventas v2 ON v2.id = vd.venta_id
          WHERE vd.producto_id = p.id AND v2.fecha BETWEEN ? AND ? AND v2.estado NOT IN ('anulada','borrador')), 0) as salidas_ventas,
        COALESCE((SELECT SUM(a.diferencia) FROM ajustes_inventario a
          WHERE a.producto_id = p.id AND a.fecha BETWEEN ? AND ?), 0) as ajustes
      FROM productos p
      WHERE p.activo = 1 AND p.tipo = 'producto'
      ORDER BY p.nombre
    `).all(desde, hasta, desde, hasta, desde, hasta)
    return { periodo: { desde, hasta }, filas, kardex, csv: toCSV(
      ['Fecha', 'Producto', 'Cantidad', 'StockAnterior', 'StockNuevo', 'Motivo'],
      filas.map((f: any) => [f.fecha, f.producto_nombre, f.cantidad, f.stock_anterior, f.stock_nuevo, f.motivo]),
    ) }
  })

  handleIpc('contable:libro-diario', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:libro-diario', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)
    const asientos = db.prepare(`
      SELECT id, fecha, tipo, descripcion, cuenta, debe, haber, referencia_tipo, referencia_id
      FROM asientos_contables
      WHERE fecha BETWEEN ? AND ?
      ORDER BY fecha, id
    `).all(desde, hasta)
    const totales = asientos.reduce(
      (acc: { debe: number; haber: number }, a: any) => ({
        debe: acc.debe + (a.debe || 0),
        haber: acc.haber + (a.haber || 0),
      }),
      { debe: 0, haber: 0 },
    )
    return { periodo: { desde, hasta }, asientos, totales, csv: toCSV(
      ['Fecha', 'Tipo', 'Descripcion', 'Cuenta', 'Debe', 'Haber', 'RefTipo', 'RefId'],
      asientos.map((a: any) => [a.fecha, a.tipo, a.descripcion, a.cuenta, a.debe, a.haber, a.referencia_tipo, a.referencia_id]),
    ) }
  })

  handleIpc('contable:resumen', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:resumen', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)
    const ventas = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COALESCE(SUM(impuesto), 0) as impuesto, COUNT(*) as cantidad
      FROM ventas WHERE fecha BETWEEN ? AND ? AND estado NOT IN ('anulada','borrador')
    `).get(desde, hasta) as any
    const compras = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COALESCE(SUM(impuesto), 0) as impuesto, COUNT(*) as cantidad
      FROM compras WHERE fecha BETWEEN ? AND ? AND estado <> 'anulada'
    `).get(desde, hasta) as any
    const costoVentas = db.prepare(`
      SELECT COALESCE(SUM(
        CASE WHEN p.es_combo = 1 THEN COALESCE(p.costo_real, p.precio_compra) ELSE p.precio_compra END * vd.cantidad
      ), 0) as costo
      FROM venta_detalles vd
      JOIN ventas v ON v.id = vd.venta_id
      JOIN productos p ON p.id = vd.producto_id
      WHERE v.fecha BETWEEN ? AND ? AND v.estado NOT IN ('anulada','borrador')
    `).get(desde, hasta) as any
    const cajaCierres = db.prepare(`
      SELECT COUNT(*) as cierres, COALESCE(SUM(diferencia), 0) as diferencia
      FROM caja WHERE estado = 'cerrada' AND fecha_cierre BETWEEN ? AND ?
    `).get(desde, hasta) as any
    const valorInventario = db.prepare(`
      SELECT COALESCE(SUM(stock * COALESCE(costo_real, precio_compra)), 0) as valor
      FROM productos WHERE activo = 1 AND tipo = 'producto'
    `).get() as any
    const valorInventarioCombo = db.prepare(`
      SELECT COALESCE(SUM(stock * COALESCE(costo_real, precio_compra)), 0) as valor
      FROM productos WHERE activo = 1 AND tipo = 'producto' AND es_combo = 1
    `).get() as any
    return {
      periodo: { desde, hasta },
      ventas,
      compras,
      costoVentas: costoVentas?.costo || 0,
      utilidadBruta: (ventas?.total || 0) - (costoVentas?.costo || 0),
      caja: cajaCierres,
      valorInventario: (valorInventario?.valor || 0) - (valorInventarioCombo?.valor || 0),
    }
  })
}
