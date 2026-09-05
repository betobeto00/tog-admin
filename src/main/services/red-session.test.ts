import { describe, it, expect, beforeEach } from 'vitest'
import { registrarSesion, liberarSesionesDePar, parTieneSesionActiva, listarSesionesActivas } from './red-session'

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
})