import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createRedServer, generarCodigoEnlace, type RedServer } from './red-server'

type Db = ReturnType<typeof crearDb>

function crearDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
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

describe('red-server (PC Base)', () => {
  let db: Db
  let server: RedServer
  let base: string

  // Imita el comportamiento real: auth-service.login registra la sesión con
  // el par_id que el servidor inyecta como __par_id (ver red-server RPC).
  const handlerFake = (canal: string, _event: unknown, ...args: unknown[]) => {
    if (canal === 'app:version') return '1.0.0'
    if (canal === 'productos:list') return [{ id: 1, nombre: 'Producto A' }]
    if (canal === 'auth:login') {
      const data = (args[0] || {}) as { __par_id?: string }
      const parId = data.__par_id || 'base'
      db.prepare(
        'INSERT INTO sesiones_activas (usuario_id, par_id, sesion_token, opened_at, last_heartbeat) VALUES (?, ?, ?, ?, ?)',
      ).run(1, parId, 'token-test', new Date().toISOString(), new Date().toISOString())
      return { success: true, usuario: { id: 1, usuario: 'admin' } }
    }
    return undefined
  }

  async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return { status: res.status, json: await res.json() }
  }

  beforeEach(async () => {
    db = crearDb()
    server = createRedServer({
      getDb: () => db,
      getHandler: (c) => {
        const fn = handlerFake.bind(null, c)
        // getIpcListener real devuelve undefined para canales sin handler
        return c.startsWith('no:') ? undefined : fn
      },
      getMaxPcs: () => 5,
      port: 0,
    })
    const puerto = await server.start()
    base = `http://127.0.0.1:${puerto}`
  })

  afterEach(async () => {
    await server.stop()
  })

  it('vincular: acepta código válido y devuelve credenciales de par', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const res = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    expect(res.status).toBe(201)
    expect(res.json.success).toBe(true)
    expect(res.json.par_id).toBeTruthy()
    expect(res.json.cert_hash).toBeTruthy()

    const enlazadas = db.prepare('SELECT * FROM pcs_enlazadas').all() as any[]
    expect(enlazadas).toHaveLength(1)
    expect(enlazadas[0].nombre).toBe('Caja 1')
  })

  it('vincular: código de un solo uso', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const r1 = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    expect(r1.status).toBe(201)
    const r2 = await post('/api/red/vincular', { codigo, nombre: 'Caja 2' })
    expect(r2.status).toBe(409)
    expect(r2.json.error).toContain('utilizado')
  })

  it('vincular: rechaza código expirado', async () => {
    const { codigo } = generarCodigoEnlace(db, new Date(Date.now() - 6 * 60 * 1000), 5 * 60 * 1000)
    const res = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    expect(res.status).toBe(410)
    expect(res.json.error).toContain('expirado')
  })

  it('vincular: rechaza código inexistente y respeta tope max_pcs', async () => {
    const inexistente = await post('/api/red/vincular', { codigo: 'ZZZZ', nombre: 'Caja' })
    expect(inexistente.status).toBe(404)

    // Tope: enlazar 5 PCs (max_pcs = 5) y el sexto debe rechazarse
    for (let i = 0; i < 5; i++) {
      const { codigo } = generarCodigoEnlace(db)
      const r = await post('/api/red/vincular', { codigo, nombre: `Caja ${i}` })
      expect(r.status).toBe(201)
    }
    const { codigo: sexto } = generarCodigoEnlace(db)
    const r6 = await post('/api/red/vincular', { codigo: sexto, nombre: 'Caja 6' })
    expect(r6.status).toBe(403)
    expect(r6.json.error).toContain('Límite')
  })

  it('rpc: rechaza par sin credenciales válidas', async () => {
    const res = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id: 'fake', cert_hash: 'fake' })
    expect(res.status).toBe(401)
  })

  it('rpc: despacha canales preauth sin sesión activa', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id, cert_hash } = vin.json

    const res = await post('/api/red/rpc', { canal: 'app:version', args: [], par_id, cert_hash })
    expect(res.status).toBe(200)
    expect(res.json.response).toBe('1.0.0')
  })

  it('rpc: exige sesión activa para canales de negocio', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id, cert_hash } = vin.json

    const res = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id, cert_hash })
    expect(res.status).toBe(401)
    expect(res.json.error).toContain('sesión activa')
  })

  it('rpc: login desde hija habilita canales de negocio', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id, cert_hash } = vin.json

    const login = await post('/api/red/rpc', {
      canal: 'auth:login',
      args: [{ usuario: 'admin', contrasena: 'x' }],
      par_id,
      cert_hash,
    })
    expect(login.status).toBe(200)
    expect(login.json.response.success).toBe(true)

    // La sesión quedó registrada → los canales de negocio pasan
    const list = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id, cert_hash })
    expect(list.status).toBe(200)
    expect(list.json.response).toEqual([{ id: 1, nombre: 'Producto A' }])
  })

  it('rpc: canal desconocido devuelve 404', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id, cert_hash } = vin.json
    await post('/api/red/rpc', { canal: 'auth:login', args: [{ usuario: 'admin', contrasena: 'x' }], par_id, cert_hash })

    const res = await post('/api/red/rpc', { canal: 'no:existe', args: [], par_id, cert_hash })
    expect(res.status).toBe(404)
  })

  it('logout: libera las sesiones del par', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id, cert_hash } = vin.json
    await post('/api/red/rpc', { canal: 'auth:login', args: [{ usuario: 'admin', contrasena: 'x' }], par_id, cert_hash })
    expect(parTieneSesion(db, par_id)).toBe(true)

    const logout = await post('/api/red/logout', { par_id, cert_hash })
    expect(logout.status).toBe(200)
    expect(parTieneSesion(db, par_id)).toBe(false)
  })
})

function parTieneSesion(db: Db, parId: string): boolean {
  return !!db.prepare('SELECT 1 FROM sesiones_activas WHERE par_id = ?').get(parId)
}