/**
 * Helpers fiscales puros (sin DB, sin Electron).
 *
 * Los usa el backend (`src/main/services/fiscal.ts`) y el renderer (layout A4,
 * página de impresión). El contexto legal está en docs/LEGAL-VENEZUELA-POS.md.
 */

/**
 * N° de control fiscal: `A-00000042`.
 * @param serie Serie/prefijo configurable (por defecto 'A')
 * @param ultimo Último correlativo usado; devuelve el siguiente
 */
export function formatearNumeroControl(serie: string | null | undefined, ultimo: number, padding = 8): string {
  const s = (serie || 'A').trim().toUpperCase().slice(0, 4) || 'A'
  const n = Math.max(Math.trunc(Number(ultimo) || 0) + 1, 1)
  return `${s}-${String(n).padStart(padding, '0')}`
}

export interface DesgloseFiscal {
  base_imponible: number
  iva: number
  total: number
}

const redondear = (n: number) => Math.round((Number(n) || 0) * 100) / 100

/**
 * Base imponible, IVA y total de un comprobante.
 *
 * En TOG Admin el IVA es **exclusivo** (`impuesto = base × alícuota`, ver
 * POSPage), así que el desglose sólo separa la base (subtotal − descuento) del
 * IVA ya calculado. `descuento` es el descuento global del comprobante; los
 * descuentos por línea ya vienen restados en cada `subtotal` de ítem.
 */
export function desgloseFiscal(venta: {
  subtotal: number
  descuento?: number
  impuesto?: number
  total?: number
}): DesgloseFiscal {
  const subtotal = Number(venta.subtotal) || 0
  const descuento = Number(venta.descuento) || 0
  const iva = Number(venta.impuesto) || 0
  const base = redondear(subtotal - descuento)
  return {
    base_imponible: base,
    iva: redondear(iva),
    total: redondear(venta.total != null ? Number(venta.total) : base + iva),
  }
}

/** IVA contenido en un total que ya lo incluye (para compras a proveedores). */
export function ivaDesdeTotalIncluido(total: number, alicuota: number): DesgloseFiscal {
  const t = Number(total) || 0
  const a = Number(alicuota) || 0
  if (a <= 0) return { base_imponible: redondear(t), iva: 0, total: redondear(t) }
  const base = t / (1 + a / 100)
  return { base_imponible: redondear(base), iva: redondear(t - base), total: redondear(t) }
}
