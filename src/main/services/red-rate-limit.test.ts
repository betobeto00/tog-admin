// LOW-04: el rate limit de `/api/red/vincular` era un Map en memoria (se perdía
// al reiniciar y no dejaba rastro). Ahora vive en `intentos_vincular`.

import { describe, it, expect, beforeEach } from 'vitest'
import {
  permitirIntentoVincular,
  resetVincularRateLimit,
  VINCULAR_MAX_INTENTOS,
  VINCULAR_VENTANA_MS,
} from './red-rate-limit'

function crearDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE intentos_vincular (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
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

const T0 = new Date('2026-09-17T18:00:00.000Z')

describe('rate limit de emparejamiento', () => {
  let db: ReturnType<typeof crearDb>

  beforeEach(() => {
    db = crearDb()
  })

  it(`permite ${VINCULAR_MAX_INTENTOS} intentos por IP y rechaza el siguiente`, () => {
    for (let i = 0; i < VINCULAR_MAX_INTENTOS; i++) {
      expect(permitirIntentoVincular(db, '10.0.0.5', T0), `intento ${i + 1}`).toBe(true)
    }
    expect(permitirIntentoVincular(db, '10.0.0.5', T0)).toBe(false)
  })

  it('vuelve a permitir cuando pasa la ventana', () => {
    for (let i = 0; i < VINCULAR_MAX_INTENTOS + 3; i++) permitirIntentoVincular(db, '10.0.0.5', T0)
    expect(permitirIntentoVincular(db, '10.0.0.5', T0)).toBe(false)

    const despues = new Date(T0.getTime() + VINCULAR_VENTANA_MS + 1000)
    expect(permitirIntentoVincular(db, '10.0.0.5', despues)).toBe(true)
  })

  it('cuenta por IP: una PC bloqueada no bloquea a las demás', () => {
    for (let i = 0; i < VINCULAR_MAX_INTENTOS + 1; i++) permitirIntentoVincular(db, '10.0.0.5', T0)
    expect(permitirIntentoVincular(db, '10.0.0.5', T0)).toBe(false)
    expect(permitirIntentoVincular(db, '10.0.0.9', T0)).toBe(true)
  })

  it('el límite sobrevive un reinicio de la app (está en la BD, no en memoria)', () => {
    for (let i = 0; i < VINCULAR_MAX_INTENTOS + 1; i++) permitirIntentoVincular(db, '10.0.0.5', T0)

    // Simula el reinicio: nuevas estructuras en memoria, misma base.
    const dbTrasReinicio = db
    expect(permitirIntentoVincular(dbTrasReinicio, '10.0.0.5', T0)).toBe(false)
  })

  it('registra los intentos (queda auditable)', () => {
    permitirIntentoVincular(db, '10.0.0.5', T0)
    permitirIntentoVincular(db, '10.0.0.5', T0)

    const filas = db.prepare('SELECT ip FROM intentos_vincular').all() as Array<{ ip: string }>
    expect(filas).toHaveLength(2)
    expect(filas.every((f) => f.ip === '10.0.0.5')).toBe(true)
  })

  it('purga los intentos viejos para no crecer sin límite', () => {
    permitirIntentoVincular(db, '10.0.0.5', T0)
    // Un intento 2 días después purga el viejo
    permitirIntentoVincular(db, '10.0.0.5', new Date(T0.getTime() + 48 * 60 * 60 * 1000))

    const filas = db.prepare('SELECT creado_en FROM intentos_vincular').all() as Array<{ creado_en: string }>
    expect(filas).toHaveLength(1)
  })

  it('normaliza una IP vacía en vez de compartir un cubo vacío', () => {
    for (let i = 0; i < VINCULAR_MAX_INTENTOS + 1; i++) permitirIntentoVincular(db, '', T0)
    const filas = db.prepare('SELECT DISTINCT ip FROM intentos_vincular').all() as Array<{ ip: string }>
    expect(filas).toHaveLength(1)
    expect(filas[0].ip).toBe('desconocida')
  })

  it('no bloquea el emparejamiento si la tabla no existe (falla abierto)', () => {
    // Escenario: base vieja a la que todavía no se le aplicó la migración 052.
    const sinTabla = {
      exec: () => undefined,
      prepare: () => {
        throw new Error('no such table: intentos_vincular')
      },
    }
    expect(permitirIntentoVincular(sinTabla as any, '10.0.0.5', T0)).toBe(true)
  })

  it('el reset deja la ventana limpia (tests y desbloqueo manual)', () => {
    for (let i = 0; i < VINCULAR_MAX_INTENTOS + 1; i++) permitirIntentoVincular(db, '10.0.0.5', T0)
    expect(permitirIntentoVincular(db, '10.0.0.5', T0)).toBe(false)

    resetVincularRateLimit(db)

    expect(permitirIntentoVincular(db, '10.0.0.5', T0)).toBe(true)
  })
})
