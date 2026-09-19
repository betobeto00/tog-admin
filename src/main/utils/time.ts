/**
 * Helpers de fecha/hora LOCAL para el proceso main.
 *
 * Contexto: SQLite guarda `datetime('now')` en UTC, pero TOG Admin es una app
 * de escritorio monousuario y toda la UI + reportes hablan en hora local (el
 * renderer envía fechas `YYYY-MM-DD` locales y `formatDateTime` parsea los
 * timestamps como locales). Mezclar ambos husos hacía que una venta hecha de
 * noche (p. ej. 20:00–23:59 en UTC-4) quedara con la fecha del día UTC
 * siguiente y desapareciera de los reportes del día.
 *
 * Regla:
 *  - Fechas de negocio (ventas, compras, caja, créditos, abonos, ajustes de
 *    inventario, asientos): se guardan en hora local, sin zona.
 *  - Campos de auditoría (`creado_en`, `actualizado_en`, intentos de login,
 *    heartbeats): siguen en UTC.
 */

/** Fecha local `YYYY-MM-DD`. */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Fecha y hora local `YYYY-MM-DD HH:MM:SS` (formato que entiende SQLite). */
export function localDateTimeStr(d: Date = new Date()): string {
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return `${localDateStr(d)} ${hh}:${mm}:${ss}`
}
