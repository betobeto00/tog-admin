import { describe, it, expect, beforeEach } from 'vitest'
import {
  registrarSesion,
  liberarSesionesDePar,
  parTieneSesionActiva,
  listarSesionesActivas,
  getUsuarioDeToken,
  liberarSesionPorToken,
  actualizarHeartbeatSesiones,
  barrerSesionesInactivas,
  RED_SESION_TTL_MS,
} from './red-session'

type Db = ReturnType<typeof crearDb>

function crearDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT, contrasena TEXT, nombre TEXT, rol TEXT, activo INTEGER DEFAULT 1);
    CREATE TABLE sesiones_activas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      par_id TEXT NOT NULL,
      sesion_token TEXT NOT NULL UNIQUE,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_heartbeat TEXT
    );
    CREATE TABLE pcs_enlazadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      par_id TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      ip TEXT,
      cert_hash TEXT NOT NULL,
      last_seen TEXT,
      last_heartbeat TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  raw.prepare("INSERT INTO usuarios (usuario, contrasena, nombre, rol) VALUES ('admin', 'x', 'Admin', 'admin')").run()
  const stmts = new Map<string, any>()
  return {
    exec(sql: string) {
      return raw.exec(sql)
    },
    prepare(sql: string) {
      if (!stmts.has(sql)) stmts.set(sql, raw.prepare(sql))
      const stmt = stmts.get(sql)
      const norm = (args: unknown[]) => args.map((a) => (a === undefined ? null : a))
      return {
        get: (...args: unknown[]) => stmt.get(...norm(args)),
        all: (...args: unknown[]) => stmt.all(...norm(args)),
        run: (...args: unknown[]) => stmt.run(...norm(args)),
      }
    },
  }
}

describe('red-session', () => {
  let db: Db

  beforeEach(() => {
    db = crearDb()
  })

  it('registra sesión nueva y la lista', () => {
    const res = registrarSesion(db, 1, 'par-1')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.sesion.par_id).toBe('par-1')
    const sesiones = listarSesionesActivas(db)
    expect(sesiones).toHaveLength(1)
    expect(sesiones[0].usuario_id).toBe(1)
    expect(parTieneSesionActiva(db, 'par-1')).toBe(true)
  })

  it('permite re-login en el MISMO par (actualiza, no duplica)', () => {
    registrarSesion(db, 1, 'par-1')
    const res2 = registrarSesion(db, 1, 'par-1')
    expect(res2.ok).toBe(true)
    expect(listarSesionesActivas(db)).toHaveLength(1)
  })

  it('rechaza sesión en OTRO par (sesión única)', () => {
    registrarSesion(db, 1, 'par-1')
    const res = registrarSesion(db, 1, 'par-2')
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toContain('otra PC')
    // La sesión original sigue viva
    expect(parTieneSesionActiva(db, 'par-1')).toBe(true)
  })

  it('libera sesiones del par al desloguear/cerrar la hija', () => {
    registrarSesion(db, 1, 'par-1')
    liberarSesionesDePar(db, 'par-1')
    expect(parTieneSesionActiva(db, 'par-1')).toBe(false)
    expect(listarSesionesActivas(db)).toHaveLength(0)
  })

  it('emite un token de sesión y lo resuelve a su usuario', () => {
    const res = registrarSesion(db, 1, 'par-1')
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.sesionToken).toMatch(/^[0-9a-f]{32}$/)
    expect(getUsuarioDeToken(db, res.sesionToken)).toBe(1)
  })

  it('no resuelve tokens inexistentes, vacíos o de otro tipo', () => {
    expect(getUsuarioDeToken(db, 'no-existe')).toBeNull()
    expect(getUsuarioDeToken(db, '')).toBeNull()
    expect(getUsuarioDeToken(db, undefined)).toBeNull()
    expect(getUsuarioDeToken(db, 123 as unknown as string)).toBeNull()
  })

  it('rota el token al re-loguear en el mismo par (el anterior deja de servir)', () => {
    const primera = registrarSesion(db, 1, 'par-1')
    const segunda = registrarSesion(db, 1, 'par-1')
    expect(primera.ok && segunda.ok).toBe(true)
    if (!primera.ok || !segunda.ok) return
    expect(segunda.sesionToken).not.toBe(primera.sesionToken)
    expect(getUsuarioDeToken(db, primera.sesionToken)).toBeNull()
    expect(getUsuarioDeToken(db, segunda.sesionToken)).toBe(1)
  })

  it('libera la sesión por token sin tocar las demás', () => {
    const a = registrarSesion(db, 1, 'par-1')
    if (!a.ok) return
    liberarSesionPorToken(db, a.sesionToken)
    expect(getUsuarioDeToken(db, a.sesionToken)).toBeNull()
    expect(parTieneSesionActiva(db, 'par-1')).toBe(false)

    // No explota con tokens basura
    liberarSesionPorToken(db, 'no-existe')
    liberarSesionPorToken(db, null)
  })
})

describe('expulsión de sesiones por heartbeat (PC Base)', () => {
  let db: Db
  const AHORA = new Date('2026-09-17T18:00:00.000Z')

  /** Enlaza un par con su último latido en el formato que se le pase. */
  function enlazarPar(parId: string, lastHeartbeat: string | null, creadoEn = '2026-09-17 17:00:00') {
    db.prepare(
      'INSERT INTO pcs_enlazadas (par_id, nombre, ip, cert_hash, last_seen, last_heartbeat, creado_en) VALUES (?, ?, ?, ?, ?, ?, ?)',
    ).run(parId, `PC ${parId}`, '10.0.0.5', 'hash', '2026-09-17 17:00:00', lastHeartbeat, creadoEn)
  }

  beforeEach(() => {
    db = crearDb()
  })

  it('expulsa el par sin latido por más del TTL y libera su sesión', () => {
    enlazarPar('par-viejo', '2026-09-17 17:40:00')
    registrarSesion(db, 1, 'par-viejo')

    const expulsados = barrerSesionesInactivas(db, AHORA)

    expect(expulsados).toEqual(['par-viejo'])
    expect(parTieneSesionActiva(db, 'par-viejo')).toBe(false)
    expect(listarSesionesActivas(db)).toHaveLength(0)
  })

  it('mantiene viva la sesión de un par que late dentro del TTL', () => {
    // Formato SQLite (`datetime('now')`), que es el que escribe el vincular y
    // el que antes se comparaba como texto contra un ISO con `T`: el `' '`
    // ordena antes que la `T`, así que un par recién enlazado parecía inactivo.
    enlazarPar('par-activo', '2026-09-17 17:59:30')
    registrarSesion(db, 1, 'par-activo')

    expect(barrerSesionesInactivas(db, AHORA)).toEqual([])
    expect(parTieneSesionActiva(db, 'par-activo')).toBe(true)
  })

  it('mantiene viva la sesión cuando el latido está en ISO 8601 con T y Z', () => {
    enlazarPar('par-iso', '2026-09-17T17:59:30.000Z')
    registrarSesion(db, 1, 'par-iso')

    expect(barrerSesionesInactivas(db, AHORA)).toEqual([])
  })

  it('NO expulsa las sesiones locales de la PC Base', () => {
    // La Base guarda su propio login con par_id = 'base' y no tiene fila en
    // pcs_enlazadas: el barrido jamás debe dejarla sin sesión.
    registrarSesion(db, 1, 'base')
    enlazarPar('par-muerto', null)

    const expulsados = barrerSesionesInactivas(db, new Date(AHORA.getTime() + 60 * 24 * 60 * 60 * 1000))

    expect(expulsados).toEqual(['par-muerto'])
    expect(parTieneSesionActiva(db, 'base')).toBe(true)
  })

  it('expulsa un par que nunca latió, una vez que pasó el TTL desde su alta', () => {
    enlazarPar('par-sin-latido', null, '2026-09-17 17:00:00')
    registrarSesion(db, 1, 'par-sin-latido')

    expect(barrerSesionesInactivas(db, AHORA)).toEqual(['par-sin-latido'])
  })

  it('no expulsa un par recién enlazado que todavía no latió', () => {
    enlazarPar('par-nuevo', null, '2026-09-17 17:58:00')
    registrarSesion(db, 1, 'par-nuevo')

    expect(barrerSesionesInactivas(db, AHORA)).toEqual([])
  })

  it('el latido de la hija actualiza last_heartbeat de sus sesiones', () => {
    enlazarPar('par-1', '2026-09-17 17:40:00')
    registrarSesion(db, 1, 'par-1')
    db.prepare("UPDATE sesiones_activas SET last_heartbeat = '2026-09-17 17:40:00' WHERE par_id = 'par-1'").run()

    actualizarHeartbeatSesiones(db, 'par-1', AHORA)

    const fila = db
      .prepare("SELECT last_heartbeat FROM sesiones_activas WHERE par_id = 'par-1'")
      .get() as { last_heartbeat: string }
    expect(fila.last_heartbeat).toBe(AHORA.toISOString())
  })

  it('el TTL tolera el intervalo de latido real (60 s) con margen', () => {
    expect(RED_SESION_TTL_MS).toBeGreaterThanOrEqual(3 * 60 * 1000)
  })
})