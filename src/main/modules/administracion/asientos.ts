import type { Database } from 'better-sqlite3'
import { logger } from '../../services/logger'

/**
 * Asientos automáticos del libro diario.
 *
 * Se invocan dentro de las transacciones de createVenta / createCompra /
 * ventas:anular. Son best-effort: si algo falla al registrar el asiento se
 * loggea y la operación comercial continúa (la contabilidad nunca debe
 * romper una venta).
 *
 * Cuentas usadas: caja, cxc, ingresos, iva, costo, gasto.
 */

type DB = any

function insertar(
  db: DB,
  filas: { fecha: string; tipo: string; descripcion: string; referencia_tipo: string; referencia_id: number; cuenta: string; debe: number; haber: number; usuario_id: number | null }[],
): void {
  if (!filas.length) return
  const stmt = db!.prepare(`
    INSERT INTO asientos_contables (fecha, tipo, descripcion, referencia_tipo, referencia_id, cuenta, debe, haber, usuario_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const f of filas) {
    stmt.run(f.fecha, f.tipo, f.descripcion, f.referencia_tipo, f.referencia_id, f.cuenta, f.debe, f.haber, f.usuario_id)
  }
}

const redondear = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100

/** Costo de ventas real de una venta (combos usan costo_real). */
export function costoDeVenta(db: DB, ventaId: number): number {
  const row = db!.prepare(`
    SELECT COALESCE(SUM(
      CASE WHEN p.es_combo = 1 THEN COALESCE(p.costo_real, p.precio_compra) ELSE p.precio_compra END * vd.cantidad
    ), 0) as costo
    FROM venta_detalles vd
    JOIN productos p ON p.id = vd.producto_id
    WHERE vd.venta_id = ?
  `).get(ventaId) as any
  return redondear(row?.costo || 0)
}

/**
 * Asientos de una venta:
 *  - Debe caja por lo que entró en efectivo (fiado → solo monto_pagado)
 *  - Debe cxc por la parte fiada
 *  - Haber ingresos por el total
 *  - Haber iva por el impuesto
 *  - Debe costo por el costo de los productos vendidos
 */
export function registrarAsientosVenta(
  db: DB,
  venta: { id: number; numero_venta: number; fecha: string; total: number; impuesto: number; metodo_pago: string; monto_pagado: number },
  usuarioId: number | null,
): void {
  try {
    const fecha = venta.fecha
    const desc = `Venta #${venta.numero_venta}`
    const esFiado = venta.metodo_pago === 'fiado'
    const alCaja = esFiado ? redondear(venta.monto_pagado || 0) : redondear(venta.total)
    const aCuenta = redondear(venta.total) - alCaja
    const filas: Parameters<typeof insertar>[1] = []

    if (alCaja > 0) filas.push({ fecha, tipo: 'venta', descripcion: desc, referencia_tipo: 'venta', referencia_id: venta.id, cuenta: 'caja', debe: alCaja, haber: 0, usuario_id: usuarioId })
    if (aCuenta > 0) filas.push({ fecha, tipo: 'venta', descripcion: `${desc} (fiado)`, referencia_tipo: 'venta', referencia_id: venta.id, cuenta: 'cxc', debe: aCuenta, haber: 0, usuario_id: usuarioId })
    filas.push({ fecha, tipo: 'venta', descripcion: desc, referencia_tipo: 'venta', referencia_id: venta.id, cuenta: 'ingresos', debe: 0, haber: redondear(venta.total), usuario_id: usuarioId })
    if ((venta.impuesto || 0) > 0) filas.push({ fecha, tipo: 'venta', descripcion: `${desc} (impuesto)`, referencia_tipo: 'venta', referencia_id: venta.id, cuenta: 'iva', debe: 0, haber: redondear(venta.impuesto), usuario_id: usuarioId })

    const costo = costoDeVenta(db, venta.id)
    if (costo > 0) filas.push({ fecha, tipo: 'venta', descripcion: `${desc} (costo)`, referencia_tipo: 'venta', referencia_id: venta.id, cuenta: 'costo', debe: costo, haber: 0, usuario_id: usuarioId })

    insertar(db, filas)
  } catch (err: any) {
    logger.warn('contable', `No se pudieron registrar asientos de venta #${venta.id}: ${err?.message}`)
  }
}

/** Anulación: los asientos de la venta se eliminan (quedaba descuadrado el día). */
export function revertirAsientosVenta(db: DB, ventaId: number): void {
  try {
    db!.prepare("DELETE FROM asientos_contables WHERE referencia_tipo = 'venta' AND referencia_id = ?").run(ventaId)
  } catch (err: any) {
    logger.warn('contable', `No se pudieron revertir asientos de venta #${ventaId}: ${err?.message}`)
  }
}

/**
 * Asientos de una compra: Debe gasto (base) + Debe iva (impuesto) + Haber caja (total).
 */
export function registrarAsientosCompra(
  db: DB,
  compra: { id: number; numero_compra: number; fecha: string; subtotal: number; impuesto: number; total: number },
  usuarioId: number | null,
): void {
  try {
    const fecha = compra.fecha
    const desc = `Compra #${compra.numero_compra}`
    const filas: Parameters<typeof insertar>[1] = [
      { fecha, tipo: 'compra', descripcion: desc, referencia_tipo: 'compra', referencia_id: compra.id, cuenta: 'gasto', debe: redondear(compra.subtotal), haber: 0, usuario_id: usuarioId },
    ]
    if ((compra.impuesto || 0) > 0) filas.push({ fecha, tipo: 'compra', descripcion: `${desc} (impuesto)`, referencia_tipo: 'compra', referencia_id: compra.id, cuenta: 'iva', debe: redondear(compra.impuesto), haber: 0, usuario_id: usuarioId })
    filas.push({ fecha, tipo: 'compra', descripcion: desc, referencia_tipo: 'compra', referencia_id: compra.id, cuenta: 'caja', debe: 0, haber: redondear(compra.total), usuario_id: usuarioId })
    insertar(db, filas)
  } catch (err: any) {
    logger.warn('contable', `No se pudieron registrar asientos de compra #${compra.id}: ${err?.message}`)
  }
}
