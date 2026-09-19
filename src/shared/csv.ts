/**
 * CSV seguro para abrir en Excel / Google Sheets.
 *
 * Además del escapado normal (comillas, separador, saltos de línea) neutraliza
 * las celdas que la planilla interpretaría como **fórmula**: un producto llamado
 * `=HYPERLINK("http://sitio-malo","clic")`, un cliente `@SUM(1+1)` o una nota
 * que empiece con `+`/`-` se ejecutan al abrir el archivo exportado (CSV
 * injection). Se antepone un apóstrofo, que es la mitigación recomendada.
 *
 * Los números reales se dejan intactos para no corromper las columnas de
 * importes (un `-15.50` legítimo no se toca).
 */

/** Valores que Excel interpreta como inicio de fórmula. */
const INICIO_FORMULA = /^[=+\-@\t\r]/

/** Número plano (incluye notación científica): esos NO se neutralizan. */
const ES_NUMERO = /^[+-]?(\d+(\.\d+)?|\.\d+)([eE][+-]?\d+)?$/

/**
 * Escapa una celda. `separador` es el del archivo (`,` o `;`).
 */
export function celdaCsv(valor: unknown, separador = ','): string {
  let s = valor === null || valor === undefined ? '' : String(valor)

  if (INICIO_FORMULA.test(s) && !ES_NUMERO.test(s)) s = `'${s}`

  if (s.includes('"') || s.includes(separador) || /[\r\n]/.test(s)) {
    s = `"${s.replace(/"/g, '""')}"`
  }
  return s
}

/** Convierte filas de valores en un CSV completo (sin BOM). */
export function aCsv(filas: unknown[][], separador = ','): string {
  return filas.map((fila) => fila.map((v) => celdaCsv(v, separador)).join(separador)).join('\n')
}
