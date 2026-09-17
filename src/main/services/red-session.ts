import crypto from 'crypto'

// Tipo estructural mínimo (compatible con better-sqlite3 y node:sqlite) para
// poder testear sin Electron ni binarios nativos compilados.
export interface DbLike {
  exec(sql: string): unknown
  prepare(sql: string): {
    get(...args: unknown[]): unknown
    all(...args: unknown[]): unknown[]
    run(...args: unknown[]): unknown
  }
}

export interface SesionActiva {
  usuario_id: number
  par_id: string
  opened_at: string
}

export type RegistrarSesionResult =
  | {
      ok: true
      sesion: SesionActiva
      /**
       * Token de sesión que el renderer debe presentar en cada llamada IPC.
       * Es la ÚNICA fuente de identidad del actor: el `usuario_id` que manda el
       * cliente ya no autoriza nada (ver `core/auth/permissions.ts`).
       */
      sesionToken: string
    }
  | { ok: false; error: string }

/**
 * Sesión única por usuario en todo el grupo: un usuario solo puede estar
 * conectado a la vez. Si ya tiene sesión activa en OTRO par_id, se rechaza
 * (el heartbeat para expulsar sesiones muertas llega en la fase 2).
 */
export function registrarSesion(
  db: DbLike,
  usuarioId: number,
  parId: string,
  now: Date = new Date(),
): RegistrarSesionResult {
  const activa = db
    .prepare('SELECT id, par_id FROM sesiones_activas WHERE usuario_id = ?')
    .get(usuarioId) as { id: number; par_id: string } | undefined

  const openedAt = now.toISOString()

  if (activa) {
    if (activa.par_id !== parId) {
      return {
        ok: false,
        error: `El usuario ya tiene sesión activa en otra PC (${activa.par_id}). Cerrá sesión allí antes de volver a entrar.`,
      }
    }
    // Re-login del mismo usuario en el mismo par: se ROTA el token, así el
    // renderer anterior (o un token filtrado) deja de servir.
    const sesionToken = generarToken()
    db.prepare(
      'UPDATE sesiones_activas SET sesion_token = ?, opened_at = ?, last_heartbeat = ? WHERE id = ?',
    ).run(sesionToken, openedAt, openedAt, activa.id)
    return { ok: true, sesion: { usuario_id: usuarioId, par_id: parId, opened_at: openedAt }, sesionToken }
  }

  const sesionToken = generarToken()
  db.prepare(
    'INSERT INTO sesiones_activas (usuario_id, par_id, sesion_token, opened_at, last_heartbeat) VALUES (?, ?, ?, ?, ?)',
  ).run(usuarioId, parId, sesionToken, openedAt, openedAt)
  return { ok: true, sesion: { usuario_id: usuarioId, par_id: parId, opened_at: openedAt }, sesionToken }
}

/**
 * usuario_id dueño de un token de sesión válido, o `null`.
 *
 * Es la resolución confiable del actor: el cliente no puede inventar un
 * `usuario_id` porque no conoce el token de otro usuario.
 */
export function getUsuarioDeToken(db: DbLike, token: unknown): number | null {
  if (typeof token !== 'string' || !token) return null
  const row = db
    .prepare('SELECT usuario_id FROM sesiones_activas WHERE sesion_token = ?')
    .get(token) as { usuario_id: number } | undefined
  return row ? row.usuario_id : null
}

/** Cierra la sesión asociada a un token (logout local). */
export function liberarSesionPorToken(db: DbLike, token: unknown): void {
  if (typeof token !== 'string' || !token) return
  db.prepare('DELETE FROM sesiones_activas WHERE sesion_token = ?').run(token)
}



/** Libera todas las sesiones de un par (logout o cierre de la PC hija). */
export function liberarSesionesDePar(db: DbLike, parId: string): void {
  db.prepare('DELETE FROM sesiones_activas WHERE par_id = ?').run(parId)
}

/** Actualiza last_heartbeat de pcs_enlazadas para el par. */
export function actualizarHeartbeatPar(db: DbLike, parId: string, now: Date = new Date()): void {
  db.prepare("UPDATE pcs_enlazadas SET last_heartbeat = ?, last_seen = ? WHERE par_id = ?").run(
    now.toISOString(),
    now.toISOString(),
    parId,
  )
}

/** Actualiza last_heartbeat de TODAS las sesiones de un par. */
export function actualizarHeartbeatSesiones(db: DbLike, parId: string, now: Date = new Date()): void {
  db.prepare("UPDATE sesiones_activas SET last_heartbeat = ? WHERE par_id = ?").run(now.toISOString(), parId)
}

export interface ExpulsarParesInactivosOpts {
  ttlMs: number
  now?: Date
}

/**
 * Devuelve los par_ids que están inactivos (sin heartbeat por más de ttlMs).
 *
 * Las fechas se comparan con `datetime(...)` y **no** como texto. `pcs_enlazadas`
 * mezcla dos formatos: al vincular se escribe con `datetime('now')`
 * (`2026-09-17 17:20:00`) y `actualizarHeartbeatPar` escribe ISO 8601
 * (`2026-09-17T17:20:00.000Z`). Comparadas como texto,
 * `'2026-09-17 17:20:00' < '2026-09-17T17:15:00.000Z'` es **verdadero** (el
 * espacio ordena antes que la `T`), así que una PC recién enlazada se veía
 * "inactiva" y el barrido le borraba las sesiones.
 *
 * `par_id != 'base'` es un cinturón de seguridad: las sesiones locales de la PC
 * Base usan `par_id = 'base'` y no deben expirarse nunca por este camino (hoy no
 * están en `pcs_enlazadas`, pero la consulta no debe depender de eso).
 */
export function listarParesInactivos(db: DbLike, ttlMs: number, now: Date = new Date()): string[] {
  const cutoff = new Date(now.getTime() - ttlMs).toISOString()
  const rows = db
    .prepare(
      `SELECT par_id FROM pcs_enlazadas
       WHERE par_id != 'base'
         AND (last_heartbeat IS NULL OR datetime(last_heartbeat) < datetime(?))
         AND datetime(creado_en) < datetime(?)`,
    )
    .all(cutoff, cutoff) as Array<{ par_id: string }>
  return rows.map((r) => r.par_id)
}

/** Expulsa pares sin heartbeat por más de ttlMs: libera sesiones y devuelve la lista. */
export function expulsarParesInactivos(db: DbLike, opts: ExpulsarParesInactivosOpts): string[] {
  const now = opts.now ?? new Date()
  const inactivos = listarParesInactivos(db, opts.ttlMs, now)
  for (const parId of inactivos) {
    liberarSesionesDePar(db, parId)
  }
  return inactivos
}

/**
 * TTL de una sesión sin latido.
 *
 * La PC Hija late cada 60 s (`useRedHeartbeat`), así que 5 minutos toleran
 * cortes breves de red sin expulsar a nadie que esté trabajando.
 */
export const RED_SESION_TTL_MS = 5 * 60 * 1000

/**
 * Barrido que ejecuta la PC Base: libera las sesiones de las terminales que
 * dejaron de latir (PC apagada, app cerrada, cable cortado).
 *
 * Es necesario porque `sesiones_activas.usuario_id` es UNIQUE: sin esto, la
 * sesión de una terminal muerta queda trabada para siempre y ese usuario no
 * puede volver a entrar desde otra PC ("ya tiene sesión activa en otra PC"),
 * ni siquiera reiniciando la Base.
 */
export function barrerSesionesInactivas(db: DbLike, now: Date = new Date()): string[] {
  return expulsarParesInactivos(db, { ttlMs: RED_SESION_TTL_MS, now })
}

/** true si el par tiene al menos un usuario con sesión activa. */
export function parTieneSesionActiva(db: DbLike, parId: string): boolean {
  return !!db.prepare('SELECT 1 FROM sesiones_activas WHERE par_id = ? LIMIT 1').get(parId)
}

/**
 * usuario_id que la Base tiene registrado como logueado en ese par.
 *
 * Es la autoridad para el RPC remoto: el `usuario_id` que viaja en los
 * argumentos lo elige el cliente, así que la Base nunca debe confiar en él
 * sin compararlo contra esta sesión (ver `red-server.ts` → `/api/red/rpc`).
 */
export function getSesionUsuario(db: DbLike, parId: string): number | null {
  const row = db
    .prepare('SELECT usuario_id FROM sesiones_activas WHERE par_id = ? LIMIT 1')
    .get(parId) as { usuario_id: number } | undefined
  return row ? row.usuario_id : null
}

export function listarSesionesActivas(db: DbLike): SesionActiva[] {
  return db
    .prepare('SELECT usuario_id, par_id, opened_at FROM sesiones_activas ORDER BY opened_at DESC')
    .all() as SesionActiva[]
}

export function generarToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex')
}