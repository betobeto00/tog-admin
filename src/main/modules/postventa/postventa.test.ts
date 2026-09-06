import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db, handles, state } = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  const stmts = new Map()
  const db = {
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
    transaction(fn: (...args: any[]) => any) {
      return (...args: any[]) => {
        raw.exec('BEGIN')
        try {
          const result = fn(...args)
          raw.exec('COMMIT')
          return result
        } catch (err) {
          try { raw.exec('ROLLBACK') } catch { }
          throw err
        }
      }
    },
  }
  db.exec(`
    CREATE TABLE tickets_postventa (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      venta_id INTEGER,
      cliente_nombre TEXT NOT NULL,
      cliente_telefono TEXT,
      asunto TEXT NOT NULL,
      descripcion TEXT,
      estado TEXT NOT NULL DEFAULT 'abierto',
      prioridad TEXT NOT NULL DEFAULT 'media',
      usuario_id INTEGER,
      cerrado_en TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ticket_mensajes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets_postventa(id),
      autor TEXT NOT NULL,
      mensaje TEXT NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE devoluciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      ticket_id INTEGER,
      producto_id INTEGER,
      cantidad REAL NOT NULL DEFAULT 1,
      monto REAL NOT NULL DEFAULT 0,
      motivo TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'devolucion',
      usuario_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE garantias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      ticket_id INTEGER,
      producto_id INTEGER,
      vence_en TEXT,
      estado TEXT NOT NULL DEFAULT 'vigente',
      resolucion TEXT,
      resuelto_en TEXT,
      usuario_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      stock REAL NOT NULL DEFAULT 0,
      tipo TEXT NOT NULL DEFAULT 'producto'
    );
    CREATE TABLE ventas (id INTEGER PRIMARY KEY AUTOINCREMENT, numero_venta INTEGER);
  `)
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'postventa'] as string[] }
  return { db, handles, state }
})

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: any) => { handles[channel] = fn } },
}))

vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (channel: string, fn: any) => { handles[channel] = fn },
}))

vi.mock('../../db/database', () => ({ getDatabase: () => db }))

vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: (data: any) => {
    if (!data || data.usuario_id !== 1) {
      return { success: false as const, error: 'Sin permisos', channel: 'test' }
    }
    return null
  },
}))

vi.mock('../../services/license', () => ({
  getActiveModules: () => state.active,
}))

import { registerPostventaHandlers } from './handlers'

registerPostventaHandlers()

const call = (channel: string, data: any = {}) => handles[channel](null, { usuario_id: 1, ...data })

beforeEach(() => {
  db.prepare('DELETE FROM ticket_mensajes').run()
  db.prepare('DELETE FROM tickets_postventa').run()
  db.prepare('DELETE FROM devoluciones').run()
  db.prepare('DELETE FROM garantias').run()
  db.prepare('DELETE FROM productos').run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('tickets_postventa','devoluciones','garantias')").run()
})

describe('Postventa: tickets', () => {
  it('crea ticket con numeración secuencial PV-000001 y mensaje inicial', async () => {
    const created = await call('postventa:ticket-create', {
      cliente_nombre: 'Ana', asunto: 'Cuaderno defectuoso', descripcion: 'Hojas sueltas',
    })
    expect(created.numero).toBe('PV-000001')

    const list = await call('postventa:tickets-list') as any[]
    expect(list).toHaveLength(1)
    expect(list[0].mensajes).toBe(1)
    expect(list[0].estado).toBe('abierto')
  })

  it('numera secuencialmente los siguientes tickets', async () => {
    await call('postventa:ticket-create', { cliente_nombre: 'A', asunto: 'X' })
    const tercero = await call('postventa:ticket-create', { cliente_nombre: 'B', asunto: 'Y' })
    expect(tercero.numero).toBe('PV-000002')
  })

  it('rechaza ticket sin cliente o sin asunto', async () => {
    const sinCliente = await call('postventa:ticket-create', { asunto: 'X' })
    expect(sinCliente.success).toBe(false)
    const sinAsunto = await call('postventa:ticket-create', { cliente_nombre: 'A' })
    expect(sinAsunto.success).toBe(false)
  })

  it('rechaza prioridad y estado inválidos', async () => {
    const res = await call('postventa:ticket-create', { cliente_nombre: 'A', asunto: 'X', prioridad: 'urgante' })
    expect(res.success).toBe(false)
    const upd = await call('postventa:ticket-update', { id: 1, data: { estado: 'volando' } })
    expect(upd.success).toBe(false)
  })

  it('actualiza estado y sella cerrado_en', async () => {
    const created = await call('postventa:ticket-create', { cliente_nombre: 'A', asunto: 'X' })
    await call('postventa:ticket-update', { id: created.id, data: { estado: 'resuelto' } })
    const list = await call('postventa:tickets-list') as any[]
    expect(list[0].estado).toBe('resuelto')
    expect(list[0].cerrado_en).toBeTruthy()
  })

  it('mensaje de seguimiento mueve el ticket a en_proceso', async () => {
    const created = await call('postventa:ticket-create', { cliente_nombre: 'A', asunto: 'X' })
    await call('postventa:ticket-mensaje', { id: created.id, mensaje: 'Estamos revisando' })
    const list = await call('postventa:tickets-list') as any[]
    expect(list[0].estado).toBe('en_proceso')
    // sin descripcion inicial solo hay el mensaje de seguimiento
    expect(list[0].mensajes).toBe(1)
  })

  it('filtra tickets por estado', async () => {
    await call('postventa:ticket-create', { cliente_nombre: 'A', asunto: 'X' })
    const t2 = await call('postventa:ticket-create', { cliente_nombre: 'B', asunto: 'Y' })
    await call('postventa:ticket-update', { id: t2.id, data: { estado: 'cerrado' } })

    const abiertos = await call('postventa:tickets-list', { estado: 'abierto' }) as any[]
    expect(abiertos).toHaveLength(1)
    expect(abiertos[0].cliente_nombre).toBe('A')
  })
})

describe('Postventa: devoluciones', () => {
  it('registra devolución y repone stock del producto', async () => {
    db.prepare("INSERT INTO productos (id, nombre, stock) VALUES (1, 'Resma', 10)").run()
    db.prepare('INSERT INTO ventas (id, numero_venta) VALUES (5, 5)').run()

    const res = await call('postventa:devolucion-create', {
      venta_id: 5, producto_id: 1, cantidad: 2, monto: 30, motivo: 'Producto dañado',
    })
    expect(res.id).toBeTruthy()

    const stock = db.prepare('SELECT stock FROM productos WHERE id = 1').get() as any
    expect(stock.stock).toBe(12)

    const list = await call('postventa:devoluciones-list') as any[]
    expect(list).toHaveLength(1)
    expect(list[0].producto_nombre).toBe('Resma')
    expect(list[0].numero_venta).toBe(5)
    expect(list[0].tipo).toBe('devolucion')
  })

  it('acepta nota de crédito y producto inexistente (sin reposición)', async () => {
    const res = await call('postventa:devolucion-create', {
      cantidad: 1, monto: 20, motivo: 'Error de venta', tipo: 'nota_credito', producto_id: 999,
    })
    expect(res.id).toBeTruthy()
    const list = await call('postventa:devoluciones-list') as any[]
    expect(list[0].tipo).toBe('nota_credito')
  })

  it('rechaza devolución sin motivo o con monto inválido', async () => {
    const sinMotivo = await call('postventa:devolucion-create', { monto: 10, motivo: '  ' })
    expect(sinMotivo.success).toBe(false)
    const sinMonto = await call('postventa:devolucion-create', { monto: 0, motivo: 'X' })
    expect(sinMonto.success).toBe(false)
  })
})

describe('Postventa: garantías', () => {
  it('resuelve garantía vigente con reposición de stock', async () => {
    db.prepare("INSERT INTO productos (id, nombre, stock) VALUES (1, 'Tijeras', 5)").run()
    db.prepare("INSERT INTO garantias (venta_id, producto_id, vence_en) VALUES (1, 1, '2027-01-01')").run()

    const res = await call('postventa:garantia-resolver', { id: 1, resolucion: 'repuesto' })
    expect(res.success).toBe(true)

    const stock = db.prepare('SELECT stock FROM productos WHERE id = 1').get() as any
    expect(stock.stock).toBe(6)

    const list = await call('postventa:garantias-list') as any[]
    expect(list[0].estado).toBe('resuelta')
    expect(list[0].resuelto_en).toBeTruthy()
  })

  it('rechaza garantía inexistente o ya resuelta', async () => {
    db.prepare("INSERT INTO garantias (venta_id) VALUES (1)").run()
    await call('postventa:garantia-resolver', { id: 1, resolucion: 'rechazado' })
    const doble = await call('postventa:garantia-resolver', { id: 1, resolucion: 'repuesto' })
    expect(doble.success).toBe(false)
  })

  it('lista garantías vigentes primero', async () => {
    db.prepare("INSERT INTO garantias (venta_id) VALUES (1)").run()
    db.prepare("INSERT INTO garantias (venta_id) VALUES (2)").run()
    await call('postventa:garantia-resolver', { id: 1, resolucion: 'rechazado' })

    const list = await call('postventa:garantias-list') as any[]
    expect(list[0].id).toBe(2)
  })
})

describe('Postventa: gating y permisos', () => {
  it('bloquea los handlers si el módulo no está en la licencia', async () => {
    state.active = ['comercializador']
    const res = await call('postventa:tickets-list')
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'postventa']
  })

  it('bloquea sin permisos (sin usuario_id)', async () => {
    const res = await handles['postventa:tickets-list'](null, {})
    expect(res.success).toBe(false)
  })
})
