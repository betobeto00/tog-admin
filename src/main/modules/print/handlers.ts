/**
 * Handlers IPC del módulo de impresión (FASE 6).
 *
 * El renderer arma la vista previa con `construirLineasTicket` (src/shared/print.ts);
 * acá se imprime de verdad:
 *   - `print:ticket` → bytes ESC/POS al puerto serie configurado (ticketera).
 *   - A4/memoria → el renderer usa `window.print()` con `A4Layout`.
 */

import { handleIpc } from '../../core/auth/ipc-guard'
import { checkPermissionOrFail } from '../../core/auth'
import { getDatabase } from '../../db/database'
import {
  construirLineasTicket,
  construirLineasTicketApuesta,
  documentoDePrueba,
  type DocumentoVenta,
  type DocumentoApuesta,
  type AnchoTicket,
  type LineaTicket,
} from '../../../shared/print'
import { construirEscPos } from './escpos'
import { enviarEscPos, listarPuertosSerie } from '../../services/printer'
import { getDatosFiscales, guardarConfig, CLAVES_FISCALES, siguienteNumeroControl } from '../../services/fiscal'
import { documentoDeVenta, documentoUltimaVenta, documentoDeApuesta } from './documentos'

const CAMPOS_CONFIG = {
  razon_social: CLAVES_FISCALES.razon_social,
  rif: CLAVES_FISCALES.rif,
  direccion: CLAVES_FISCALES.direccion,
  telefono: CLAVES_FISCALES.telefono,
  email: CLAVES_FISCALES.email,
  pie_ticket: CLAVES_FISCALES.pie,
  puerto_impresora: CLAVES_FISCALES.puerto,
  ancho_ticket: CLAVES_FISCALES.ancho,
  abrir_cajon: CLAVES_FISCALES.cajon,
  copias: CLAVES_FISCALES.copias,
} as const

/** Imprime las líneas por el puerto configurado (con copias). */
async function imprimirLineas(lineas: LineaTicket[]) {
  const db = getDatabase()
  const fiscal = getDatosFiscales(db)
  const bytes = construirEscPos(lineas, { abrirCajon: fiscal.abrir_cajon })

  let ultimo: { success: boolean; bytes?: number; error?: string } = { success: true, bytes: 0 }
  for (let copia = 0; copia < fiscal.copias; copia++) {
    ultimo = await enviarEscPos(bytes, { puerto: fiscal.puerto_impresora, baudRate: fiscal.baudrate })
    if (!ultimo.success) return ultimo
  }
  return ultimo
}

/** Imprime el documento de venta por el puerto configurado (con copias). */
async function imprimirDocumento(doc: DocumentoVenta) {
  const fiscal = getDatosFiscales(getDatabase())
  return imprimirLineas(construirLineasTicket(doc, fiscal.ancho_ticket as AnchoTicket))
}

/** Imprime el ticket de una apuesta hípica (FASE 7b). */
async function imprimirApuesta(doc: DocumentoApuesta) {
  const fiscal = getDatosFiscales(getDatabase())
  return imprimirLineas(construirLineasTicketApuesta(doc, fiscal.ancho_ticket as AnchoTicket))
}

export function registerPrintHandlers(): void {
  // Configuración fiscal + de impresora (la usa la página de Impresión)
  handleIpc('print:config', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'print:config', 'print_access')
    if (fail) return fail
    const db = getDatabase()
    const fiscal = getDatosFiscales(db)
    const serie = fiscal.serie
    return {
      ...fiscal,
      proximo_numero_control: siguienteNumeroControlPreview(serie, fiscal.correlativo),
    }
  })

  handleIpc('print:set-config', async (_event, data: Record<string, any>) => {
    const fail = checkPermissionOrFail(data, 'print:set-config', 'print_config')
    if (fail) return fail
    const db = getDatabase()
    for (const [campo, clave] of Object.entries(CAMPOS_CONFIG)) {
      if (data[campo] === undefined || data[campo] === null) continue
      const valor = typeof data[campo] === 'boolean' ? (data[campo] ? '1' : '0') : String(data[campo])
      guardarConfig(db, clave, valor)
    }
    if (data.serie !== undefined) guardarConfig(db, CLAVES_FISCALES.serie, String(data.serie))
    if (data.correlativo !== undefined) {
      const n = Math.max(Math.trunc(Number(data.correlativo) || 0), 0)
      guardarConfig(db, CLAVES_FISCALES.correlativo, String(n))
    }
    return { success: true, config: getDatosFiscales(db) }
  })

  // Puertos serie disponibles (COM1, COM3…) para elegir la ticketera
  handleIpc('print:puertos', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'print:puertos', 'print_access')
    if (fail) return fail
    try {
      return { success: true, puertos: await listarPuertosSerie() }
    } catch (err: any) {
      return { success: false, error: err?.message || 'No se pudieron listar los puertos' }
    }
  })

  // Ticket de una venta guardada (o la última si no se pasa id)
  handleIpc('print:ticket', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'print:ticket', 'print_ticket')
    if (fail) return fail
    const db = getDatabase()
    const doc = data?.venta_id ? documentoDeVenta(Number(data.venta_id), db) : documentoUltimaVenta(db)
    if (!doc) return { success: false, error: 'No hay ventas para imprimir' }
    const resultado = await imprimirDocumento(doc)
    return { ...resultado, documento: doc }
  })

  // Ticket de una apuesta hípica (o su reimpresión)
  handleIpc('print:ticket-apuesta', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'print:ticket-apuesta', 'print_ticket')
    if (fail) return fail
    const apuestaId = Number(data?.apuesta_id)
    if (!Number.isInteger(apuestaId) || apuestaId <= 0) return { success: false, error: 'Falta la apuesta' }
    const doc = documentoDeApuesta(apuestaId, getDatabase())
    if (!doc) return { success: false, error: 'Apuesta no encontrada' }
    doc.reimpresion = data?.reimprimir === true
    const resultado = await imprimirApuesta(doc)
    return { ...resultado, documento: doc }
  })

  // Ticket de prueba: valida puerto, ancho y datos fiscales antes de vender
  handleIpc('print:test', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'print:test', 'print_config')
    if (fail) return fail
    const fiscal = getDatosFiscales(getDatabase())
    const doc = documentoDePrueba(
      {
        razon_social: fiscal.razon_social || 'TOG Admin',
        rif: fiscal.rif,
        direccion: fiscal.direccion,
        telefono: fiscal.telefono,
      },
      {
        numero_control: siguienteNumeroControlPreview(fiscal.serie, fiscal.correlativo),
        alicuota_iva: fiscal.alicuota_iva || undefined,
        pie: fiscal.pie_ticket,
      },
    )
    const resultado = await imprimirDocumento(doc)
    return { ...resultado, documento: doc }
  })
}

/** Vista previa del próximo N° de control (no reserva el número). */
function siguienteNumeroControlPreview(serie: string, correlativo: number): string {
  return `${(serie || 'A').toUpperCase()}-${String(correlativo + 1).padStart(8, '0')}`
}

export { siguienteNumeroControl }
