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

  // ============ MAYOR ============
  // Saldos por cuenta a partir del libro diario.
  handleIpc('contable:mayor', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:mayor', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)

    const movimientos = db.prepare(`
      SELECT cuenta, fecha, tipo, descripcion, referencia_tipo, referencia_id, debe, haber
      FROM asientos_contables
      WHERE fecha BETWEEN ? AND ?
      ORDER BY cuenta, fecha, id
    `).all(desde, hasta) as any[]

    // Agrupar por cuenta con saldo acumulado (debe - haber)
    const porCuenta = new Map<string, { cuenta: string; movimientos: any[]; debe: number; haber: number; saldo: number }>()
    for (const m of movimientos) {
      let c = porCuenta.get(m.cuenta)
      if (!c) {
        c = { cuenta: m.cuenta, movimientos: [], debe: 0, haber: 0, saldo: 0 }
        porCuenta.set(m.cuenta, c)
      }
      c.movimientos.push(m)
      c.debe += m.debe || 0
      c.haber += m.haber || 0
      c.saldo = c.debe - c.haber
    }

    const cuentas = Array.from(porCuenta.values())
    const totales = cuentas.reduce(
      (acc, c) => ({ debe: acc.debe + c.debe, haber: acc.haber + c.haber }),
      { debe: 0, haber: 0 },
    )

    return {
      periodo: { desde, hasta },
      cuentas,
      totales,
      csv: toCSV(
        ['Cuenta', 'Debe', 'Haber', 'Saldo'],
        cuentas.map((c) => [c.cuenta, c.debe, c.haber, c.saldo]),
      ),
    }
  })

  // ============ BALANCE GENERAL ============
  // Sumas y saldos: Activos (caja, cxc) vs Pasivos+Capital (ingresos, iva, gasto es contra-cuenta).
  handleIpc('contable:balance', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:balance', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)

    const filas = db.prepare(`
      SELECT cuenta,
        COALESCE(SUM(debe), 0) as debe,
        COALESCE(SUM(haber), 0) as haber
      FROM asientos_contables
      WHERE fecha BETWEEN ? AND ?
      GROUP BY cuenta
      ORDER BY cuenta
    `).all(desde, hasta) as any[]

    // Clasificación de cuentas: deudoras (activo/costo) vs acreedoras (pasivo/ingreso)
    const DEUDORAS = new Set(['caja', 'cxc', 'costo', 'gasto'])
    const detalle = filas.map((f) => {
      const saldo = (f.debe || 0) - (f.haber || 0)
      const esDeudora = DEUDORAS.has(f.cuenta)
      return {
        cuenta: f.cuenta,
        clase: esDeudora ? 'activo' : 'pasivo_y_capital',
        // Las acreedoras muestran su saldo natural (haber - debe)
        saldo: esDeudora ? saldo : -saldo,
      }
    })
    const totalActivo = detalle.filter((d) => d.clase === 'activo').reduce((a, d) => a + d.saldo, 0)
    const totalPasivo = detalle.filter((d) => d.clase === 'pasivo_y_capital').reduce((a, d) => a + d.saldo, 0)

    return {
      periodo: { desde, hasta },
      detalle,
      totales: { activo: totalActivo, pasivo_y_capital: totalPasivo, cuadre: totalActivo - totalPasivo },
      csv: toCSV(
        ['Cuenta', 'Clase', 'Saldo'],
        detalle.map((d) => [d.cuenta, d.clase, d.saldo]),
      ),
    }
  })

  // ============ FLUJO DE EFECTIVO ============
  // Base efectivo: aperturas de caja, ventas cobradas, entradas extra, salidas/retiros.
  handleIpc('contable:flujo-efectivo', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:flujo-efectivo', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)

    const ventasEfectivo = db.prepare(`
      SELECT COALESCE(SUM(
        CASE
          WHEN v.metodo_pago = 'fiado' THEN COALESCE(v.monto_pagado, 0)
          WHEN v.metodo_pago = 'transferencia' OR v.metodo_pago = 'pago_movil' THEN 0
          ELSE v.total
        END
      ), 0) as monto
      FROM ventas v
      WHERE v.fecha BETWEEN ? AND ? AND v.estado NOT IN ('anulada','borrador')
    `).get(desde, hasta) as any

    const ventaMixta = db.prepare(`
      SELECT COALESCE(SUM(COALESCE(monto_pagado, 0)), 0) as monto FROM ventas
      WHERE fecha BETWEEN ? AND ? AND metodo_pago = 'mixto' AND estado NOT IN ('anulada','borrador')
    `).get(desde, hasta) as any

    const entradas = db.prepare(`
      SELECT COALESCE(SUM(m.monto), 0) as monto, COUNT(*) as cantidad
      FROM movimientos_caja m
      WHERE m.tipo = 'entrada' AND m.fecha BETWEEN ? AND ?
    `).get(desde, hasta) as any

    const salidas = db.prepare(`
      SELECT COALESCE(SUM(m.monto), 0) as monto, COUNT(*) as cantidad
      FROM movimientos_caja m
      WHERE m.tipo IN ('salida', 'retiro') AND m.fecha BETWEEN ? AND ?
    `).get(desde, hasta) as any

    const aperturas = db.prepare(`
      SELECT COALESCE(SUM(fondo_inicial), 0) as monto, COUNT(*) as cantidad
      FROM caja
      WHERE fecha_apertura BETWEEN ? AND ?
    `).get(desde, hasta) as any

    const inflow = (ventasEfectivo?.monto || 0) - (ventaMixta?.monto || 0) + (entradas?.monto || 0)
    const outflow = salidas?.monto || 0
    const filas = [
      { concepto: 'ventas_cobradas', monto: ventasEfectivo?.monto || 0 },
      { concepto: 'entradas_extra', monto: entradas?.monto || 0, cantidad: entradas?.cantidad || 0 },
      { concepto: 'salidas', monto: -(salidas?.monto || 0), cantidad: salidas?.cantidad || 0 },
      { concepto: 'fondos_iniciales', monto: aperturas?.monto || 0, cantidad: aperturas?.cantidad || 0 },
    ]

    return {
      periodo: { desde, hasta },
      filas,
      totales: { inflow, outflow, neto: inflow - outflow, aperturas: aperturas?.monto || 0 },
      csv: toCSV(
        ['Concepto', 'Monto', 'Cantidad'],
        filas.map((f) => [f.concepto, f.monto, f.cantidad ?? '']),
      ),
    }
  })

  // ============ ANÁLISIS DE ESTADOS FINANCIEROS ============
  // Ratios sobre el período: márgenes, ticket promedio, composición de cobro, CxC.
  handleIpc('contable:analisis', async (_event, data: { desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'contable:analisis', 'contable_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const { desde, hasta } = resolverPeriodo(data)

    const ventas = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COALESCE(SUM(impuesto), 0) as impuesto, COUNT(*) as cantidad
      FROM ventas WHERE fecha BETWEEN ? AND ? AND estado NOT IN ('anulada','borrador')
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
    const compras = db.prepare(`
      SELECT COALESCE(SUM(total), 0) as total, COUNT(*) as cantidad
      FROM compras WHERE fecha BETWEEN ? AND ? AND estado <> 'anulada'
    `).get(desde, hasta) as any
    const porMetodo = db.prepare(`
      SELECT metodo_pago, COUNT(*) as cantidad, COALESCE(SUM(total), 0) as total
      FROM ventas WHERE fecha BETWEEN ? AND ? AND estado NOT IN ('anulada','borrador')
      GROUP BY metodo_pago ORDER BY total DESC
    `).all(desde, hasta) as any[]
    const cxc = db.prepare(`
      SELECT COALESCE(SUM(saldo), 0) as saldo, COUNT(*) as cantidad
      FROM creditos WHERE estado = 'pendiente'
    `).get() as any
    const diasLaborados = db.prepare(`
      SELECT COUNT(DISTINCT DATE(fecha)) as dias FROM ventas
      WHERE fecha BETWEEN ? AND ? AND estado NOT IN ('anulada','borrador')
    `).get(desde, hasta) as any

    const totalVentas = ventas?.total || 0
    const costo = costoVentas?.costo || 0
    const utilidadBruta = totalVentas - costo
    const cantidad = ventas?.cantidad || 0
    const dias = diasLaborados?.dias || 0

    const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0)

    const ratios = [
      { clave: 'margen_bruto', valor: pct(utilidadBruta, totalVentas), unidad: '%' },
      { clave: 'markup', valor: pct(utilidadBruta, costo), unidad: '%' },
      { clave: 'ticket_promedio', valor: cantidad > 0 ? Math.round((totalVentas / cantidad) * 100) / 100 : 0, unidad: 'money' },
      { clave: 'venta_diaria', valor: dias > 0 ? Math.round((totalVentas / dias) * 100) / 100 : 0, unidad: 'money' },
      { clave: 'ventas_vs_compras', valor: compras?.total > 0 ? Math.round((totalVentas / compras.total) * 100) / 100 : 0, unidad: 'x' },
      { clave: 'cxc_pendiente', valor: cxc?.saldo || 0, unidad: 'money' },
      { clave: 'cxc_operaciones', valor: cxc?.cantidad || 0, unidad: 'n' },
    ]

    return {
      periodo: { desde, hasta },
      base: { ventas: totalVentas, costo, utilidadBruta, impuesto: ventas?.impuesto || 0, cantidad, compras: compras?.total || 0, dias },
      porMetodo,
      ratios,
      csv: toCSV(
        ['Indicador', 'Valor'],
        [...ratios.map((r) => [r.clave, r.valor]), ...porMetodo.map((m) => [`metodo_${m.metodo_pago}`, m.total])],
      ),
    }
  })
}
