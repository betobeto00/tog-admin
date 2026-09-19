import { escapeHtml } from './utils'

/**
 * Generador único de documentos imprimibles del renderer.
 *
 * Todas las páginas imprimen con `window.open()` + `document.write()` (no hay
 * motor de PDF). Tener el esqueleto en un solo lugar evita tres cosas que ya
 * pasaron: títulos sin escapar, ventanas sin `document.close()` (el `load` no
 * dispara y la impresión sale en blanco) y documentos sin el CSS de `.no-print`.
 *
 * Reglas para quien lo usa:
 *   - `cuerpo` va dentro del `<body>`: escapá todo dato del usuario con
 *     `escapeHtml()` (nombres, notas, direcciones…).
 *   - `titulo` se escapa acá.
 *   - `estilos` es CSS suelto, sin la etiqueta `<style>`.
 */
export interface OpcionesDocumento {
  /** Título de la pestaña / encabezado de página del diálogo de impresión. */
  titulo: string
  /** HTML que va dentro del `<body>`. */
  cuerpo: string
  /** CSS propio del documento (sin `<style>`). */
  estilos?: string
  /** Ancho de la ventana de vista previa. */
  ancho?: number
  /** Alto de la ventana de vista previa. */
  alto?: number
  /** Abre el diálogo de impresión al terminar de cargar (default: true). */
  imprimir?: boolean
}

/**
 * CSS aplicado a todos los documentos.
 *
 * Deliberadamente mínimo: cada documento trae el suyo y este solo cubre lo que
 * debe ser igual en todos (box-sizing, tablas y el toggle para imprimir).
 */
export const ESTILOS_BASE = `
  *, *::before, *::after { box-sizing: border-box; }
  table { border-collapse: collapse; }
  @media print { .no-print { display: none !important; } }
`

/**
 * Abre una ventana con el documento y (por defecto) dispara la impresión.
 * Devuelve `false` si el navegador bloqueó la ventana emergente.
 */
export function abrirDocumento({
  titulo,
  cuerpo,
  estilos = '',
  ancho = 840,
  alto = 680,
  imprimir = true,
}: OpcionesDocumento): boolean {
  const win = window.open('', '_blank', `width=${ancho},height=${alto}`)
  if (!win) return false

  win.document.write(
    `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">` +
      `<title>${escapeHtml(titulo)}</title>` +
      `<style>${ESTILOS_BASE}${estilos}</style>` +
      `</head><body>${cuerpo}</body></html>`,
  )
  win.document.close()
  win.focus()
  if (imprimir) win.print()
  return true
}
