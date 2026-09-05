import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRedServer, generarCodigoEnlace, type RedServer } from './red-server'

type Db = ReturnType<typeof crearDb>

function crearDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, descripcion TEXT, actualizado_en TEXT);
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT, contrasena TEXT, nombre TEXT, rol TEXT, activo INTEGER DEFAULT 1);
    CREATE TABLE pcs_enlazadas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      par_id TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      ip TEXT,
      cert_hash TEXT NOT NULL,
      last_seen TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE sesiones_activas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER NOT NULL UNIQUE,
      par_id TEXT NOT NULL,
      sesion_token TEXT NOT NULL UNIQUE,
      opened_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_heartbeat TEXT
    );
    CREATE TABLE codigos_enlace (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo TEXT NOT NULL UNIQUE,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      expira_en TEXT NOT NULL,
      usado INTEGER NOT NULL DEFAULT 0,
      usado_en TEXT
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

describe('red-client (PC Hija) ↔ red-server (PC Base)', () => {
  let dbBase: Db
  let dbHija: Db
  let server: RedServer
  let base: string

  async function clientConDb(dbHijaReal: Db) {
    vi.resetModules()
    vi.doMock('../db/database', () => ({ getDatabase: () => dbHijaReal }))
    return import('./red-client')
  }

  beforeEach(async () => {
    dbBase = crearDb()
    dbHija = crearDb()
    server = createRedServer({
      getDb: () => dbBase,
      getHandler: (c) =>
        c === 'productos:list' ? () => [{ id: 1, nombre: 'Papel A4' }] : undefined,
      getMaxPcs: () => 5,
      port: 0,
    })
    const puerto = await server.start()
    base = `http://127.0.0.1:${puerto}`
  })

  afterEach(async () => {
    vi.doUnmock('../db/database')
    vi.resetModules()
    await server.stop()
  })

  it('flujo completo: generar código → vincular → rpc → logout', async () => {
    // La Base genera el código de enlace (lo hace el admin desde Config)
    const { codigo } = generarCodigoEnlace(dbBase)

    // La hija se vincula (persiste par_id + cert_hash en su DB local)
    const { vincularABase } = await clientConDb(dbHija)
    const vin = await vincularABase(base, codigo, 'Caja 1')
    expect(vin.success).toBe(true)

    const modo = dbHija.prepare("SELECT valor FROM configuracion WHERE clave = 'red_modo'").get() as any
    expect(modo?.valor).toBe('hija')
    const parGuardado = dbHija.prepare("SELECT valor FROM configuracion WHERE clave = 'red_par_id'").get() as any
    expect(parGuardado?.valor).toBeTruthy()

    // La Base registró la PC enlazada
    const enlazadas = dbBase.prepare('SELECT * FROM pcs_enlazadas').all() as any[]
    expect(enlazadas).toHaveLength(1)
    expect(enlazadas[0].nombre).toBe('Caja 1')

    // rpc: sin sesión activa, los canales de negocio se rechazan con error claro
    const { rpcABase } = await clientConDb(dbHija)
    await expect(rpcABase('productos:list', [])).rejects.toThrow(/sesión activa/i)
  })

  it('vincular con código inválido falla y no persiste config', async () => {
    const { vincularABase } = await clientConDb(dbHija)
    const res = await vincularABase(base, 'INVALIDO', 'Caja X')
    expect(res.success).toBe(false)
    const modo = dbHija.prepare("SELECT valor FROM configuracion WHERE clave = 'red_modo'").get()
    expect(modo).toBeUndefined()
  })

  it('rpc sin vincular devuelve error claro', async () => {
    const { rpcABase } = await clientConDb(dbHija)
    await expect(rpcABase('productos:list', [])).rejects.toThrow(/no está enlazada/i)
  })
})