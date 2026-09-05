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
  | { ok: true; sesion: SesionActiva }
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
    db.prepare('UPDATE sesiones_activas SET opened_at = ?, last_heartbeat = ? WHERE id = ?').run(
      openedAt,
      openedAt,
      activa.id,
    )
    return { ok: true, sesion: { usuario_id: usuarioId, par_id: parId, opened_at: openedAt } }
  }

  const sesionToken = generarToken()
  db.prepare(
    'INSERT INTO sesiones_activas (usuario_id, par_id, sesion_token, opened_at, last_heartbeat) VALUES (?, ?, ?, ?, ?)',
  ).run(usuarioId, parId, sesionToken, openedAt, openedAt)
  return { ok: true, sesion: { usuario_id: usuarioId, par_id: parId, opened_at: openedAt } }
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

/** Devuelve los par_ids que están inactivos (sin heartbeat por más de ttlMs). */
export function listarParesInactivos(db: DbLike, ttlMs: number, now: Date = new Date()): string[] {
  const cutoff = new Date(now.getTime() - ttlMs).toISOString()
  const rows = db
    .prepare(
      `SELECT par_id FROM pcs_enlazadas
       WHERE (last_heartbeat IS NULL OR last_heartbeat < ?)
         AND creado_en < ?`,
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

/** true si el par tiene al menos un usuario con sesión activa. */
export function parTieneSesionActiva(db: DbLike, parId: string): boolean {
  return !!db.prepare('SELECT 1 FROM sesiones_activas WHERE par_id = ? LIMIT 1').get(parId)
}

export function listarSesionesActivas(db: DbLike): SesionActiva[] {
  return db
    .prepare('SELECT usuario_id, par_id, opened_at FROM sesiones_activas ORDER BY opened_at DESC')
    .all() as SesionActiva[]
}

export function generarToken(bytes = 16): string {
  return crypto.randomBytes(bytes).toString('hex')
}