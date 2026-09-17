/**
 * Driver ESC/POS (impresoras térmicas tipo Epson TM-T20, Xprinter, etc.).
 *
 * Genera los bytes del ticket a partir de las líneas de `construirLineasTicket`
 * (src/shared/print.ts). Es una función pura: no abre puertos ni depende de
 * Electron, así que se testea con un snapshot de bytes.
 *
 * Referencia de comandos: Epson ESC/POS Command Reference.
 *   ESC @      inicializar
 *   ESC a n    alineación (0 izq, 1 centro, 2 der)
 *   ESC E n    negrita
 *   GS ! n     tamaño de carácter (n = 0x00 normal, 0x11 doble alto+ancho)
 *   GS V m     corte de papel (m = 0 corte total, 1 corte parcial)
 *   ESC p m t  pulso al cajón de dinero (m = 0 pin 2)
 */

import type { LineaTicket } from '../../../shared/print'

export const ESC = 0x1b
export const GS = 0x1d

const CMD_INIT = [ESC, 0x40]
const CMD_ALIGN_LEFT = [ESC, 0x61, 0x00]
const CMD_ALIGN_CENTER = [ESC, 0x61, 0x01]
const CMD_BOLD_ON = [ESC, 0x45, 0x01]
const CMD_BOLD_OFF = [ESC, 0x45, 0x00]
const CMD_SIZE_NORMAL = [GS, 0x21, 0x00]
const CMD_SIZE_DOUBLE = [GS, 0x21, 0x11]
const CMD_CUT = [GS, 0x56, 0x01]
const CMD_DRAWER = [ESC, 0x70, 0x00, 0x19, 0xfa]
export const CMD_FEED = [0x0a]

export interface OpcionesEscPos {
  /** Columnas del papel; se usa para el separador en ASCII puro. */
  cortar?: boolean
  /** Abre el cajón de dinero (solo si la impresora lo tiene cableado). */
  abrirCajon?: boolean
  /** Líneas en blanco al final antes del corte. */
  avanceFinal?: number
  /** Codificación de los caracteres (por defecto latin1: cubre acentos y ñ). */
  encoding?: 'latin1' | 'utf8'
}

/**
 * Convierte el texto a bytes. Por defecto latin1, que es lo que las térmicas
 * económicas interpretan mejor (utf8 requiere `ESC t n` según el modelo).
 */
export function textoABytes(texto: string, encoding: OpcionesEscPos['encoding'] = 'latin1'): number[] {
  const buffer = Buffer.from(texto, encoding === 'utf8' ? 'utf8' : 'latin1')
  return Array.from(buffer)
}

/**
 * Normaliza el texto a lo imprimible: quita saltos de línea y tabulaciones
 * (romperían el alineado del ticket) y unifica las comillas tipográficas.
 */
export function sanearTexto(texto: string): string {
  return String(texto ?? '')
    // Se eliminan TODOS los caracteres de control (\n, \t y también ESC 0x1b):
    // si un nombre de producto trajera un ESC/POS embebido, abriría el cajón
    // o cortaría el papel a mitad del ticket.
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/[\u201c\u201d\u2018\u2019\u00ab\u00bb]/g, '"')
}

/** Construye los bytes del ticket completo. */
export function construirEscPos(lineas: LineaTicket[], opciones: OpcionesEscPos = {}): number[] {
  const { cortar = true, abrirCajon = false, avanceFinal = 3, encoding = 'latin1' } = opciones
  const bytes: number[] = [...CMD_INIT]

  let enNegrita = false
  let enDoble = false

  for (const linea of lineas) {
    const quiereNegrita = !!linea.negrita
    const quiereDoble = !!linea.doble
    if (quiereDoble !== enDoble) {
      bytes.push(...(quiereDoble ? CMD_SIZE_DOUBLE : CMD_SIZE_NORMAL))
      enDoble = quiereDoble
    }
    if (quiereNegrita !== enNegrita) {
      bytes.push(...(quiereNegrita ? CMD_BOLD_ON : CMD_BOLD_OFF))
      enNegrita = quiereNegrita
    }
    bytes.push(...(linea.centrada ? CMD_ALIGN_CENTER : CMD_ALIGN_LEFT))
    bytes.push(...textoABytes(sanearTexto(linea.texto), encoding), ...CMD_FEED)
  }

  if (enDoble) bytes.push(...CMD_SIZE_NORMAL)
  if (enNegrita) bytes.push(...CMD_BOLD_OFF)

  bytes.push(...CMD_ALIGN_LEFT)
  for (let i = 0; i < Math.max(avanceFinal, 0); i++) bytes.push(...CMD_FEED)
  if (abrirCajon) bytes.push(...CMD_DRAWER)
  if (cortar) bytes.push(...CMD_CUT)

  return bytes
}
