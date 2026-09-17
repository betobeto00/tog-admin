/**
 * Presentación segura de claves de API que viven en la configuración.
 *
 * El renderer **nunca** debe recibir la clave en claro: con `invoke` genérico,
 * cualquier JS que corra en el renderer (XSS, dependencia npm comprometida) puede
 * pedir el canal de configuración y quedarse con el crédito de la API del negocio
 * —o revenderla—. El proceso main es el único que la usa, para llamar a la API.
 *
 * El admin sí necesita saber *si* hay una clave cargada y poder reemplazarla; para
 * eso alcanza con `configurado` + una pista enmascarada.
 */

/**
 * Enmascara una clave dejando visibles sólo sus últimos 4 caracteres.
 *
 * - Vacía o ausente → `null` (no hay nada que mostrar).
 * - Muy corta (≤ 4) → se enmascara entera: mostrar sus últimos 4 sería mostrarla
 *   completa.
 * - El resto → a lo sumo 8 puntos suspensivos + los últimos 4 (una clave larga no
 *   revela su longitud real).
 */
export function enmascararApiKey(clave: string | null | undefined): string | null {
  const valor = (clave ?? '').trim()
  if (!valor) return null
  if (valor.length <= 4) return '•'.repeat(valor.length)
  return `${'•'.repeat(Math.min(valor.length - 4, 8))}${valor.slice(-4)}`
}
