/**
 * Conversión de datos de la DB a `DocumentoVenta` (FASE 6).
 * El layout vive en src/shared/print.ts; acá solo se arma la información.
 */

import type { DocumentoVenta, ItemDocumento } from '@shared/print'
import { getDatosFiscales, desgloseFiscal } from '../../services/fiscal'

type DbLike = { prepare: (sql: string) => any }

const ETIQUETA_PAGO: Record<string, string> = {
  efectivo: 'Efectivo',
  tarjeta: 'Tarjeta',
  debito: 'Débito',
  credito: 'Crédito',
  transferencia: 'Transferencia',
  pago_movil: 'Pago móvil',
  fiado: 'Crédito / fiado',
  mixto: 'Mixto',
}

export function etiquetaMetodoPago(metodo: string | null | undefined): string {
  const m = String(metodo || '').toLowerCase()
  return ETIQUETA_PAGO[m] || (metodo ? String(metodo) : '')
}

/** Documento a partir de una fila de `ventas` + sus detalles. */
export function documentoDesdeFila(venta: any, detalles: any[], extras: { empresa: any; cajero?: string; cliente?: any }): DocumentoVenta {
  const items: ItemDocumento[] = (detalles || []).map((d) => ({
    descripcion: d.descripcion || d.producto_nombre || `Producto ${d.producto_id ?? ''}`.trim(),
    cantidad: Number(d.cantidad) || 0,
    precio_unitario: Number(d.precio_unitario) || 0,
    descuento: Number(d.descuento) || 0,
    subtotal: Number(d.subtotal) || 0,
  }))

  const esNotaEntrega = venta.tipo_comprobante === 'nota_entrega'
  const fiscal = desgloseFiscal(venta)

  return {
    titulo: esNotaEntrega ? 'NOTA DE ENTREGA' : 'FACTURA',
    empresa: {
      razon_social: extras.empresa?.razon_social || '',
      rif: extras.empresa?.rif || '',
      direccion: extras.empresa?.direccion || '',
      telefono: extras.empresa?.telefono || '',
      email: extras.empresa?.email || '',
    },
    cliente: extras.cliente
      ? {
          nombre: extras.cliente.nombre,
          documento: extras.cliente.documento || undefined,
          direccion: extras.cliente.direccion || undefined,
          telefono: extras.cliente.telefono || undefined,
        }
      : null,
    numero: String(venta.numero_venta ?? ''),
    numero_control: venta.numero_control ?? null,
    fecha: venta.fecha || venta.creado_en || new Date().toISOString(),
    cajero: extras.cajero,
    items,
    subtotal: Number(venta.subtotal) || 0,
    descuento: Number(venta.descuento) || 0,
    impuesto: fiscal.iva,
    alicuota_iva: extras.empresa?.alicuota_iva ?? undefined,
    total: fiscal.total,
    moneda: extras.empresa?.moneda || '',
    metodo_pago: etiquetaMetodoPago(venta.metodo_pago),
    monto_pagado: Number(venta.monto_pagado) || 0,
    cambio: Number(venta.cambio) || 0,
    notas: venta.notas || undefined,
    pie: extras.empresa?.pie_ticket || undefined,
  }
}

/**
 * Arma el `DocumentoVenta` de una venta guardada.
 * Devuelve null si la venta no existe.
 */
export function documentoDeVenta(ventaId: number, db: DbLike): DocumentoVenta | null {
  const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(ventaId) as any
  if (!venta) return null

  const detalles = db
    .prepare(
      `SELECT vd.*, p.nombre as producto_nombre FROM venta_detalles vd
       LEFT JOIN productos p ON vd.producto_id = p.id WHERE vd.venta_id = ? ORDER BY vd.id`,
    )
    .all(ventaId)

  const cajero = venta.usuario_id
    ? (db.prepare('SELECT nombre FROM usuarios WHERE id = ?').get(venta.usuario_id) as any)?.nombre
    : undefined
  const cliente = venta.cliente_id
    ? db.prepare('SELECT nombre, documento, telefono, direccion FROM clientes WHERE id = ?').get(venta.cliente_id)
    : null

  const base = getDatosFiscales(db)
  const moneda = (db.prepare("SELECT valor FROM configuracion WHERE clave = 'currency_name'").get() as any)?.valor || ''

  return documentoDesdeFila(venta, detalles, {
    empresa: { ...base, moneda, alicuota_iva: base.alicuota_iva },
    cajero,
    cliente,
  })
}

/** Última venta registrada (para el botón "imprimir último ticket"). */
export function documentoUltimaVenta(db: DbLike): DocumentoVenta | null {
  const ultima = db.prepare('SELECT id FROM ventas ORDER BY id DESC LIMIT 1').get() as any
  if (!ultima) return null
  return documentoDeVenta(ultima.id, db)
}
