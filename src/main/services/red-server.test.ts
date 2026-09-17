import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createRedServer, generarCodigoEnlace, sanitizeCrashFilename, type RedServer } from './red-server'
import { resetVincularRateLimit } from './red-rate-limit'
import { barrerSesionesInactivas, RED_SESION_TTL_MS } from './red-session'

type Db = ReturnType<typeof crearDb>

// La capa de permisos (`core/auth/permissions.ts`) resuelve el actor contra
// `getDatabase()`. Se apunta a la misma BD en memoria del test para poder
// ejercitar la autorización REAL por token en el camino de red local.
const dbHolder = vi.hoisted(() => ({ db: null as any }))
vi.mock('../db/database', () => ({ getDatabase: () => dbHolder.db }))

function crearDb() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { DatabaseSync }: any = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  raw.exec(`
    CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT, contrasena TEXT, nombre TEXT, rol TEXT, activo INTEGER DEFAULT 1, permisos TEXT);
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
    CREATE TABLE intentos_vincular (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT NOT NULL,
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

describe('red-server (PC Base)', () => {
  let db: Db
  let server: RedServer
  let base: string

  // Imita el comportamiento real: auth-service.login registra la sesión con
  // el par_id que el servidor inyecta como __par_id (ver red-server RPC).
  const handlerFake = (canal: string, _event: unknown, ...args: unknown[]) => {
    if (canal === 'app:version') return '1.0.0'
    if (canal === 'license:status') return { valid: true }
    if (canal === 'license:initial-password') return { password: 'secret' }
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
    resetVincularRateLimit(db)
    db = crearDb()
    dbHolder.db = db
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
    expect(res.json.nombre).toBe('Caja 1')

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

  it('vincular: rechaza código inexistente', async () => {
    const res = await post('/api/red/vincular', { codigo: 'ZZZZ', nombre: 'Caja' })
    expect(res.status).toBe(404)
  })

  it('vincular: respeta tope max_pcs', async () => {
    await server.stop()
    const maxPcs = 3
    server = createRedServer({
      getDb: () => db,
      getHandler: (c) => {
        const fn = handlerFake.bind(null, c)
        return c.startsWith('no:') ? undefined : fn
      },
      getMaxPcs: () => maxPcs,
      port: 0,
    })
    const puerto = await server.start()
    base = `http://127.0.0.1:${puerto}`

    for (let i = 0; i < maxPcs; i++) {
      const { codigo } = generarCodigoEnlace(db)
      const r = await post('/api/red/vincular', { codigo, nombre: `Caja ${i}` })
      expect(r.status).toBe(201)
    }
    const { codigo: extra } = generarCodigoEnlace(db)
    const rExtra = await post('/api/red/vincular', { codigo: extra, nombre: 'Caja extra' })
    expect(rExtra.status).toBe(403)
    expect(rExtra.json.error).toContain('Límite')
  })

  it('rpc: rechaza par sin credenciales válidas', async () => {
    const res = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id: 'fake', cert_hash: 'fake' })
    expect(res.status).toBe(401)
  })

  it('rpc: despacha canales preauth sin sesión activa', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

    const res = await post('/api/red/rpc', { canal: 'license:status', args: [], par_id, cert_hash })
    expect(res.status).toBe(200)
    expect(res.json.response).toEqual({ valid: true })
  })

  it('rpc: bloquea canales locales o sensibles aunque la PC esté emparejada', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

    // license:initial-password era preauth: cualquier hija emparejada obtenía
    // la contraseña del admin en texto plano.
    const password = await post('/api/red/rpc', {
      canal: 'license:initial-password',
      args: [],
      par_id,
      cert_hash,
    })
    expect(password.status).toBe(403)
    expect(password.json.success).toBe(false)

    for (const canal of ['app:version', 'db:reset', 'red:generar-codigo', 'crash-report:save', 'feedback:send']) {
      const res = await post('/api/red/rpc', { canal, args: [], par_id, cert_hash })
      expect(res.status, `canal ${canal}`).toBe(403)
    }
  })

  it('rpc: rechaza un usuario_id que no corresponde a la sesión del par', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

    await post('/api/red/rpc', { canal: 'auth:login', args: [{ usuario: 'admin', contrasena: 'x' }], par_id, cert_hash })

    // La sesión del par es del usuario 1; reclamar ser otro usuario se rechaza.
    const suplantacion = await post('/api/red/rpc', {
      canal: 'productos:list',
      args: [{ usuario_id: 7 }],
      par_id,
      cert_hash,
    })
    expect(suplantacion.status).toBe(403)
    expect(suplantacion.json.error).toContain('sesión activa')

    // El mismo canal con el usuario de la sesión sigue funcionando.
    const legitimo = await post('/api/red/rpc', {
      canal: 'productos:list',
      args: [{ usuario_id: 1 }],
      par_id,
      cert_hash,
    })
    expect(legitimo.status).toBe(200)
    expect(legitimo.json.response).toEqual([{ id: 1, nombre: 'Producto A' }])
  })

  it('rpc: exige sesión activa para canales de negocio', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

    const res = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id, cert_hash })
    expect(res.status).toBe(401)
    expect(res.json.error).toContain('sesión activa')
  })

  it('rpc: login desde hija habilita canales de negocio', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

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

  it('heartbeat: el latido por HTTP mantiene la sesión viva y su ausencia la libera', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

    await post('/api/red/rpc', {
      canal: 'auth:login',
      args: [{ usuario: 'admin', contrasena: 'x' }],
      par_id,
      cert_hash,
    })

    // 1) El endpoint real de heartbeat deja la SESIÓN marcada como viva.
    const hb = await post('/api/red/heartbeat', { par_id, cert_hash })
    expect(hb.status).toBe(200)
    const sesion = db
      .prepare('SELECT last_heartbeat FROM sesiones_activas WHERE par_id = ?')
      .get(par_id) as { last_heartbeat: string | null }
    expect(sesion.last_heartbeat).toBeTruthy()

    // 2) Punto de referencia controlado: la PC se enlazó hace una hora, así que
    // el único dato que puede salvarla del barrido es su último latido.
    const T0 = new Date()
    db.prepare('UPDATE pcs_enlazadas SET last_heartbeat = ?, creado_en = ? WHERE par_id = ?').run(
      T0.toISOString(),
      new Date(T0.getTime() - 60 * 60 * 1000).toISOString(),
      par_id,
    )

    // 3) Dentro del TTL: la sesión sobrevive y la terminal sigue operando.
    const dentroDelTtl = new Date(T0.getTime() + RED_SESION_TTL_MS - 60 * 1000)
    expect(barrerSesionesInactivas(db, dentroDelTtl)).toEqual([])
    const viva = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id, cert_hash })
    expect(viva.status).toBe(200)

    // 4) Pasado el TTL sin latir: la Base libera la sesión y la terminal queda
    // afuera hasta que su usuario vuelva a iniciar sesión.
    const fueraDelTtl = new Date(T0.getTime() + RED_SESION_TTL_MS + 60 * 1000)
    expect(barrerSesionesInactivas(db, fueraDelTtl)).toEqual([par_id])
    const muerta = await post('/api/red/rpc', { canal: 'productos:list', args: [], par_id, cert_hash })
    expect(muerta.status).toBe(401)
    expect(muerta.json.error).toContain('sesión activa')
  })

  it('heartbeat: el barrido libera la sesión trabada para que el usuario pueda entrar en otra PC', async () => {
    // Con `usuario_id` UNIQUE, una terminal apagada con sesión abierta dejaba al
    // usuario fuera en cualquier otra PC (“ya tiene sesión activa en otra PC”).
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja vieja' })
    const { par_id } = vin.json
    await post('/api/red/rpc', {
      canal: 'auth:login',
      args: [{ usuario: 'admin', contrasena: 'x' }],
      par_id,
      cert_hash: vin.json.cert_hash,
    })

    const T0 = new Date()
    db.prepare('UPDATE pcs_enlazadas SET last_heartbeat = ?, creado_en = ? WHERE par_id = ?').run(
      new Date(T0.getTime() - 60 * 60 * 1000).toISOString(),
      new Date(T0.getTime() - 60 * 60 * 1000).toISOString(),
      par_id,
    )

    expect(barrerSesionesInactivas(db, T0)).toEqual([par_id])
    // Sin la fila en sesiones_activas, el login del mismo usuario ya no choca.
    const sesiones = db.prepare('SELECT COUNT(*) AS c FROM sesiones_activas').get() as { c: number }
    expect(sesiones.c).toBe(0)
  })

  it('rpc: el token emitido en el login autoriza canales con la capa de permisos real', async () => {
    // A diferencia del resto del archivo (handlers fake), acá el handler de
    // `productos:list` llama a la autorización REAL (`checkPermissionOrFail`),
    // que resuelve el usuario desde el token contra la BD de la Base.
    await server.stop()
    const { checkPermissionOrFail } = await import('../core/auth/permissions')
    const { registrarSesion } = await import('./red-session')

    server = createRedServer({
      getDb: () => db,
      getHandler: (canal) => {
        if (canal === 'auth:login') {
          return async (_event: unknown, data: any) => {
            const parId = data?.__par_id || 'base'
            const sesion = registrarSesion(db, 1, parId)
            if (!sesion.ok) return { success: false, error: sesion.error }
            return { success: true, usuario: { id: 1, usuario: 'admin' }, sesionToken: sesion.sesionToken }
          }
        }
        if (canal === 'productos:list') {
          return async (_event: unknown, data: any) => {
            const fail = checkPermissionOrFail(data, 'productos:list', 'pos_access')
            if (fail) return fail
            return [{ id: 1, nombre: 'Producto A' }]
          }
        }
        return undefined
      },
      getMaxPcs: () => 5,
      port: 0,
    })
    base = `http://127.0.0.1:${await server.start()}`

    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }

    const login = await post('/api/red/rpc', {
      canal: 'auth:login',
      args: [{ usuario: 'admin', contrasena: 'x' }],
      par_id,
      cert_hash,
    })
    expect(login.status).toBe(200)
    const token = login.json.response.sesionToken as string
    expect(token).toMatch(/^[0-9a-f]{32}$/)

    // Con el token de la sesión, el canal de negocio pasa la autorización real
    const ok = await post('/api/red/rpc', {
      canal: 'productos:list',
      args: [{ usuario_id: 1, session_token: token }],
      par_id,
      cert_hash,
    })
    expect(ok.status).toBe(200)
    expect(ok.json.response).toEqual([{ id: 1, nombre: 'Producto A' }])

    // Con un token inventado, la misma llamada queda sin autorización: la hija
    // no puede fabricar credenciales, solo presentar su token real.
    const falso = await post('/api/red/rpc', {
      canal: 'productos:list',
      args: [{ usuario_id: 1, session_token: 'fabricado' }],
      par_id,
      cert_hash,
    })
    expect(falso.status).toBe(200)
    expect(falso.json.response.success).toBe(false)
    expect(falso.json.response.error).toContain('sesión activa')
  })

  it('rpc: canal desconocido devuelve 404', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }
    await post('/api/red/rpc', { canal: 'auth:login', args: [{ usuario: 'admin', contrasena: 'x' }], par_id, cert_hash })

    const res = await post('/api/red/rpc', { canal: 'no:existe', args: [], par_id, cert_hash })
    expect(res.status).toBe(404)
  })

  it('logout: libera las sesiones del par', async () => {
    const { codigo } = generarCodigoEnlace(db)
    const vin = await post('/api/red/vincular', { codigo, nombre: 'Caja 1' })
    const { par_id } = vin.json
    const { cert_hash } = db.prepare('SELECT cert_hash FROM pcs_enlazadas WHERE par_id = ?').get(par_id) as { cert_hash: string }
    await post('/api/red/rpc', { canal: 'auth:login', args: [{ usuario: 'admin', contrasena: 'x' }], par_id, cert_hash })
    expect(parTieneSesion(db, par_id)).toBe(true)

    const logout = await post('/api/red/logout', { par_id, cert_hash })
    expect(logout.status).toBe(200)
    expect(parTieneSesion(db, par_id)).toBe(false)
  })

  it('body overflow: rechaza cuerpo mayor a 1MB con 413', async () => {
    const largeBody = 'x'.repeat(1024 * 1024 + 1)
    const res = await fetch(base + '/api/red/vincular', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: largeBody,
    })
    expect(res.status).toBe(413)
    const json = await res.json() as { success: boolean; error: string }
    expect(json.success).toBe(false)
    expect(json.error).toContain('1MB')
  })

  it('rate limiting: bloquea después de 5 intentos a /api/red/vincular', async () => {
    for (let i = 0; i < 5; i++) {
      const { codigo } = generarCodigoEnlace(db)
      const res = await post('/api/red/vincular', { codigo, nombre: `PC ${i}` })
      expect(res.status).toBe(201)
    }
    const { codigo } = generarCodigoEnlace(db)
    const res = await post('/api/red/vincular', { codigo, nombre: 'PC 6' })
    expect(res.status).toBe(429)
    expect(res.json.error).toContain('Demasiados intentos')
  })

  it('rate limiting: no aplica a otros endpoints', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await post('/api/red/heartbeat', { par_id: 'fake', cert_hash: 'fake' })
      expect(res.status).toBe(401)
    }
  })
})

describe('sanitizeCrashFilename', () => {
  it('acepta nombres válidos', () => {
    expect(sanitizeCrashFilename('crash-2026-09-11-120000-abcd.txt')).toBe(true)
    expect(sanitizeCrashFilename('test_file-1.txt')).toBe(true)
    expect(sanitizeCrashFilename('A.txt')).toBe(true)
  })

  it('rechaza path traversal con ..', () => {
    expect(sanitizeCrashFilename('../../etc/passwd')).toBe(false)
    expect(sanitizeCrashFilename('..\\windows\\system32')).toBe(false)
    expect(sanitizeCrashFilename('crash/../etc/shadow')).toBe(false)
  })

  it('rechaza slashes', () => {
    expect(sanitizeCrashFilename('foo/bar')).toBe(false)
    expect(sanitizeCrashFilename('foo\\bar')).toBe(false)
    expect(sanitizeCrashFilename('/etc/passwd')).toBe(false)
  })

  it('rechaza caracteres especiales', () => {
    expect(sanitizeCrashFilename('crash@2026.txt')).toBe(false)
    expect(sanitizeCrashFilename('crash 2026.txt')).toBe(false)
    expect(sanitizeCrashFilename('crash.txt; rm -rf /')).toBe(false)
    expect(sanitizeCrashFilename('')).toBe(false)
  })
})

function parTieneSesion(db: Db, parId: string): boolean {
  return !!db.prepare('SELECT 1 FROM sesiones_activas WHERE par_id = ?').get(parId)
}