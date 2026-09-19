/**
 * Datos fiscales del negocio y N° de control (FASE 8 — Venezuela / SENIAT).
 *
 * Contexto legal y decisiones: docs/LEGAL-VENEZUELA-POS.md.
 * Todo se guarda en la tabla clave-valor `configuracion`, así no hace falta
 * migración para agregar campos fiscales nuevos.
 *
 * El N° de control es un correlativo por serie (`A-00000042`) que la
 * providencia exige en cada factura. Se reserva **dentro de la transacción de
 * la venta** para que no haya dos facturas con el mismo número.
 */

import { getDatabase } from '../db/database'
import { desgloseFiscal, formatearNumeroControl, type DesgloseFiscal } from '../../shared/fiscal'

export { desgloseFiscal, formatearNumeroControl }
export type { DesgloseFiscal }

export interface DatosFiscales {
  razon_social: string
  rif: string
  direccion: string
  telefono: string
  email: string
  serie: string
  /** Próximo número a usar (informativo para la UI). */
  correlativo: number
  /** Próximo número de factura a usar (informativo para la UI). */
  proxima_factura: number
  alicuota_iva: number
  pie_ticket: string
  puerto_impresora: string
  baudrate: number
  ancho_ticket: 58 | 80
  abrir_cajon: boolean
  copias: number
}

export const CLAVES_FISCALES = {
  razon_social: 'nombre_negocio',
  rif: 'ein',
  direccion: 'direccion',
  telefono: 'telefono',
  email: 'email',
  serie: 'numero_control_serie',
  correlativo: 'numero_control_correlativo',
  factura: 'numero_factura_siguiente',
  alicuota: 'sales_tax_rate',
  pie: 'ticket_pie',
  puerto: 'impresora_puerto',
  baudrate: 'impresora_baudrate',
  ancho: 'impresora_ancho',
  cajon: 'impresora_abrir_cajon',
  copias: 'impresora_copias',
  cocina_puerto: 'impresora_cocina_puerto',
  cocina_baudrate: 'impresora_cocina_baudrate',
} as const

export const VALORES_POR_DEFECTO: Record<string, string> = {
  [CLAVES_FISCALES.serie]: 'A',
  [CLAVES_FISCALES.correlativo]: '0',
  [CLAVES_FISCALES.factura]: '0',
  [CLAVES_FISCALES.alicuota]: '0',
  [CLAVES_FISCALES.pie]: 'Gracias por su compra',
  [CLAVES_FISCALES.puerto]: '',
  [CLAVES_FISCALES.baudrate]: '9600',
  [CLAVES_FISCALES.ancho]: '80',
  [CLAVES_FISCALES.cajon]: '0',
  [CLAVES_FISCALES.copias]: '1',
  [CLAVES_FISCALES.cocina_puerto]: '',
  [CLAVES_FISCALES.cocina_baudrate]: '9600',
}

type DbLike = { prepare: (sql: string) => any }

/** Lee un valor de `configuracion` con default aplicado ('' si no existe). */
export function leerConfig(db: DbLike, clave: string, fallback = ''): string {
  const fila = db.prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave) as { valor: string } | undefined
  if (fila?.valor != null && fila.valor !== '') return fila.valor
  return VALORES_POR_DEFECTO[clave] ?? fallback
}

/** Datos fiscales + configuración de impresora listos para usar. */
export function getDatosFiscales(db: DbLike = getDatabase()): DatosFiscales {
  const ancho = Number(leerConfig(db, CLAVES_FISCALES.ancho, '80'))
  const baudrate = Number(leerConfig(db, CLAVES_FISCALES.baudrate, '9600'))
  const copias = Number(leerConfig(db, CLAVES_FISCALES.copias, '1'))
  return {
    razon_social: leerConfig(db, CLAVES_FISCALES.razon_social),
    rif: leerConfig(db, CLAVES_FISCALES.rif),
    direccion: leerConfig(db, CLAVES_FISCALES.direccion),
    telefono: leerConfig(db, CLAVES_FISCALES.telefono),
    email: leerConfig(db, CLAVES_FISCALES.email),
    serie: leerConfig(db, CLAVES_FISCALES.serie, 'A'),
    correlativo: Number(leerConfig(db, CLAVES_FISCALES.correlativo, '0')) || 0,
    proxima_factura: proximaFactura(db),
    alicuota_iva: Number(leerConfig(db, CLAVES_FISCALES.alicuota, '0')) || 0,
    pie_ticket: leerConfig(db, CLAVES_FISCALES.pie),
    puerto_impresora: leerConfig(db, CLAVES_FISCALES.puerto),
    baudrate: Number.isFinite(baudrate) && baudrate > 0 ? baudrate : 9600,
    ancho_ticket: ancho === 58 ? 58 : 80,
    abrir_cajon: leerConfig(db, CLAVES_FISCALES.cajon, '0') === '1',
    copias: Number.isFinite(copias) && copias > 0 ? Math.min(copias, 3) : 1,
  }
}

/**
 * Reserva el próximo N° de control y deja el correlativo actualizado.
 * Debe llamarse dentro de la transacción de `ventas:create`.
 *
 * Si el número que toca ya existe (p. ej. el admin bajó el correlativo a
 * mano), se salta al siguiente libre: `numero_control` tiene índice único y
 * de otro modo la venta fallaría al insertar.
 */
export function siguienteNumeroControl(db: DbLike = getDatabase()): string {
  const serie = leerConfig(db, CLAVES_FISCALES.serie, 'A')
  let actual = Number(leerConfig(db, CLAVES_FISCALES.correlativo, '0')) || 0
  let numero = formatearNumeroControl(serie, actual)
  for (let intentos = 0; intentos < 100000 && existeNumeroControl(db, numero); intentos++) {
    actual += 1
    numero = formatearNumeroControl(serie, actual)
  }
  db.prepare(
    `INSERT INTO configuracion (clave, valor, descripcion, actualizado_en)
     VALUES (?, ?, 'Correlativo del N° de control fiscal', datetime('now'))
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
  ).run(CLAVES_FISCALES.correlativo, String(actual + 1))
  return numero
}

/** ¿Ese N° de control ya está emitido? (tabla ausente ⇒ no existe). */
function existeNumeroControl(db: DbLike, numero: string): boolean {
  try {
    const fila = db.prepare('SELECT 1 AS x FROM ventas WHERE numero_control = ? LIMIT 1').get(numero)
    return !!fila
  } catch {
    return false
  }
}

/**
 * Última factura emitida (mayor `numero_venta`), 0 si todavía no hay ninguna.
 * Incluye las anuladas: un número usado no se reutiliza.
 */
export function ultimaFactura(db: DbLike = getDatabase()): number {
  try {
    const fila = db.prepare('SELECT MAX(numero_venta) AS max_num FROM ventas').get() as any
    return Number(fila?.max_num) || 0
  } catch {
    return 0
  }
}

/**
 * Próximo número de factura: el configurado por el negocio, o el siguiente
 * libre si el configurado ya quedó atrás. Nunca repite un número.
 */
export function proximaFactura(db: DbLike = getDatabase(), ultima = ultimaFactura(db)): number {
  const configurado = Number(leerConfig(db, CLAVES_FISCALES.factura, '0')) || 0
  return Math.max(configurado, ultima + 1, 1)
}

/** Guarda (o actualiza) un valor de configuración. */
export function guardarConfig(db: DbLike, clave: string, valor: string): void {
  db.prepare(
    `INSERT INTO configuracion (clave, valor, actualizado_en)
     VALUES (?, ?, datetime('now'))
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
  ).run(clave, String(valor))
}
