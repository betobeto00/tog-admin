/**
 * Numeración de comprobantes (Configuración → Negocio / Impresión → Fiscal).
 *
 * Dos correlativos independientes:
 *   1. `numero_venta`  → número de factura del negocio (continuo, no reinicia por día).
 *   2. `numero_control` → N° de control fiscal SENIAT (`A-00000042`).
 *
 * La app los avanza sola en cada venta; el cliente solo fija *el próximo* cuando
 * viene de otro sistema. Cambiarlos después es delicado (una factura ya emitida
 * no debe renumerarse), así que se exige rol **admin** y la UI pide confirmación.
 */

import { handleIpc } from '../../core/auth/ipc-guard'
import { checkPermissionOrFail, isAdminUser, resolveAuthenticatedUserId } from '../../core/auth'
import type { PermissionKey } from '../../../shared/permissions'
import { getDatabase } from '../../db/database'
import { invalidateConfigCache } from '../../services/configCache'
import {
  CLAVES_FISCALES,
  guardarConfig,
  leerConfig,
  proximaFactura,
  ultimaFactura,
  formatearNumeroControl,
} from '../../services/fiscal'

const PERMISO_LECTURA: PermissionKey = 'print_access'
const PERMISO_ESCRITURA: PermissionKey = 'print_config'

export interface Numeracion {
  /** Próximo número de factura que se usará. */
  proxima_factura: number
  /** Última factura emitida (0 si todavía no hay ninguna). */
  ultima_factura: number
  /** Serie del N° de control fiscal. */
  serie: string
  /** Próximo correlativo del N° de control. */
  proximo_numero_control: number
  /** N° de control formateado que saldrá en la próxima factura (`A-00000042`). */
  numero_control_formateado: string
}

type DbLike = { prepare: (sql: string) => any }

/** Estado actual de ambos correlativos. */
export function getNumeracion(db: DbLike = getDatabase()): Numeracion {
  const ultima = ultimaFactura(db)
  const serie = leerConfig(db, CLAVES_FISCALES.serie, 'A')
  const correlativo = Number(leerConfig(db, CLAVES_FISCALES.correlativo, '0')) || 0
  return {
    proxima_factura: proximaFactura(db, ultima),
    ultima_factura: ultima,
    serie,
    proximo_numero_control: correlativo + 1,
    numero_control_formateado: formatearNumeroControl(serie, correlativo),
  }
}

export interface CambioNumeracion {
  /** Próximo número de factura a usar. */
  proxima_factura?: number
  /** Próximo correlativo del N° de control fiscal. */
  proximo_numero_control?: number
  /** Serie del N° de control (opcional). */
  serie?: string
}

/**
 * Fija el próximo número de factura y/o el próximo N° de control.
 * Devuelve `{ success: false, error }` con el motivo si el valor es inválido.
 */
export function guardarNumeracion(
  db: DbLike,
  cambios: CambioNumeracion,
): { success: boolean; error?: string; numeracion?: Numeracion } {
  if (cambios.proxima_factura !== undefined) {
    const valor = Number(cambios.proxima_factura)
    if (!Number.isInteger(valor) || valor < 1) {
      return { success: false, error: 'El número de factura debe ser un entero mayor o igual a 1' }
    }
    const ultima = ultimaFactura(db)
    if (valor <= ultima) {
      return {
        success: false,
        error: `La próxima factura debe ser mayor que la última emitida (#${ultima})`,
      }
    }
    guardarConfig(db, CLAVES_FISCALES.factura, String(valor))
  }

  if (cambios.proximo_numero_control !== undefined) {
    const valor = Number(cambios.proximo_numero_control)
    if (!Number.isInteger(valor) || valor < 1) {
      return { success: false, error: 'El N° de control debe ser un entero mayor o igual a 1' }
    }
    // `correlativo` guarda el último usado; el siguiente sale de +1.
    guardarConfig(db, CLAVES_FISCALES.correlativo, String(valor - 1))
  }

  if (cambios.serie !== undefined) {
    const serie = String(cambios.serie).trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 4)
    guardarConfig(db, CLAVES_FISCALES.serie, serie || 'A')
  }

  invalidateConfigCache()
  return { success: true, numeracion: getNumeracion(db) }
}

export function registerNumeracionHandlers(): void {
  handleIpc('facturacion:numeracion', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'facturacion:numeracion', PERMISO_LECTURA)
    if (fail) return fail
    return { success: true, numeracion: getNumeracion(getDatabase()) }
  })

  handleIpc('facturacion:set-numeracion', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'facturacion:set-numeracion', PERMISO_ESCRITURA)
    if (fail) return fail

    // Renumerar la facturación es irreversible: solo el dueño (admin).
    const userId = resolveAuthenticatedUserId(data)
    if (userId == null || !isAdminUser(userId)) {
      return {
        success: false,
        error: 'Solo un administrador puede cambiar la numeración de facturas',
        channel: 'facturacion:set-numeracion',
      }
    }

    const resultado = guardarNumeracion(getDatabase(), {
      proxima_factura: data?.proxima_factura,
      proximo_numero_control: data?.proximo_numero_control,
      serie: data?.serie,
    })
    return resultado.success
      ? resultado
      : { ...resultado, channel: 'facturacion:set-numeracion' }
  })
}
