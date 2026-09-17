/**
 * Rate limit de `/api/red/vincular` (código de enlace de 6 caracteres).
 *
 * Antes vivía en un `Map` en memoria: se perdía al reiniciar la app y no dejaba
 * rastro de los intentos. Ahora se registra en la tabla `intentos_vincular`
 * (migración 052), así el límite sobrevive reinicios y queda auditable.
 *
 * El código de enlace sigue siendo la barrera principal (6 hex, TTL 5 min, un
 * solo uso); esto sólo acota la fuerza bruta desde una misma IP.
 */

import type { DbLike } from './red-session'

/** Ventana en la que se cuentan los intentos. */
export const VINCULAR_VENTANA_MS = 60_000

/** Intentos permitidos por IP dentro de la ventana. */
export const VINCULAR_MAX_INTENTOS = 5

/** Antigüedad a partir de la cual se purgan los intentos registrados. */
const PURGA_MS = 24 * 60 * 60 * 1000

/**
 * Registra el intento y dice si se permite.
 *
 * Devuelve `true` mientras el total de intentos de esa IP dentro de la ventana
 * sea menor al máximo (el 6.º en un minuto se rechaza con 429).
 *
 * Si la tabla no está disponible no se bloquea el emparejamiento: la app
 * migra el esquema al arrancar, así que ese caso es un problema mayor que este
 * límite, y dejar sin poder emparejar una PC sería peor.
 */
export function permitirIntentoVincular(db: DbLike, ip: string, now: Date = new Date()): boolean {
  const clave = (ip || '').trim() || 'desconocida'
  const desde = new Date(now.getTime() - VINCULAR_VENTANA_MS).toISOString()
  try {
    const fila = db
      .prepare(
        `SELECT COUNT(*) AS c FROM intentos_vincular
         WHERE ip = ? AND datetime(creado_en) > datetime(?)`,
      )
      .get(clave, desde) as { c: number } | undefined
    if ((fila?.c ?? 0) >= VINCULAR_MAX_INTENTOS) return false

    db.prepare('INSERT INTO intentos_vincular (ip, creado_en) VALUES (?, ?)').run(clave, now.toISOString())

    // Purga oportunista: la tabla no debe crecer sin límite.
    db.prepare('DELETE FROM intentos_vincular WHERE datetime(creado_en) < datetime(?)').run(
      new Date(now.getTime() - PURGA_MS).toISOString(),
    )
    return true
  } catch {
    return true
  }
}

/** Borra los intentos registrados (tests y desbloqueo manual). */
export function resetVincularRateLimit(db: DbLike): void {
  try {
    db.prepare('DELETE FROM intentos_vincular').run()
  } catch {
    // best-effort
  }
}
