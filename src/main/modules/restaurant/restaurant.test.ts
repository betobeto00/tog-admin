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
          try {
            raw.exec('ROLLBACK')
          } catch {
            // sin transacción activa
          }
          throw err
        }
      }
    },
  }
  db.exec(`
    CREATE TABLE mesas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      capacidad INTEGER NOT NULL DEFAULT 4,
      estado TEXT NOT NULL DEFAULT 'libre',
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE comandas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      mesa_id INTEGER NOT NULL,
      usuario_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'abierta',
      notas TEXT,
      venta_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      cerrado_en TEXT
    );
    CREATE TABLE comanda_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      comanda_id INTEGER NOT NULL,
      producto_id INTEGER,
      descripcion TEXT NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      notas TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'producto',
      precio_compra REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_venta INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      usuario_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      impuesto REAL NOT NULL DEFAULT 0,
      descuento REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      monto_pagado REAL NOT NULL DEFAULT 0,
      cambio REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'completada',
      notas TEXT,
      cliente_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE venta_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      producto_id INTEGER,
      descripcion TEXT,
      cantidad REAL NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL,
      descuento REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL,
      notas TEXT
    );
    CREATE TABLE creditos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL,
      cliente_id INTEGER,
      deudor_nombre TEXT NOT NULL,
      deudor_telefono TEXT,
      deudor_documento TEXT,
      monto_total REAL NOT NULL DEFAULT 0,
      saldo REAL NOT NULL DEFAULT 0,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      usuario_id INTEGER,
      notas TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
      estado TEXT NOT NULL DEFAULT 'abierta',
      fondo_inicial REAL NOT NULL DEFAULT 0,
      total_ventas REAL NOT NULL DEFAULT 0,
      total_entradas REAL NOT NULL DEFAULT 0,
      total_salidas REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE movimientos_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      monto REAL NOT NULL,
      descripcion TEXT,
      referencia_id INTEGER,
      fecha TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT
    );
    CREATE TABLE producto_componentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      componente_id INTEGER NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE venta_detalle_componentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_detalle_id INTEGER NOT NULL,
      componente_id INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  db.prepare("INSERT INTO configuracion (clave, valor) VALUES ('ticket_numero_venta', '0')").run()
  db.prepare("INSERT INTO mesas (nombre, capacidad) VALUES ('Mesa 1', 4)").run()
  db.prepare("INSERT INTO mesas (nombre, capacidad) VALUES ('Mesa 2', 2)").run()
  db.prepare("INSERT INTO productos (nombre, precio_venta, stock) VALUES ('Hamburguesa', 12, 50)").run()
  db.prepare("INSERT INTO productos (nombre, precio_venta, stock) VALUES ('Papas Fritas', 5, 80)").run()
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'restaurant'] as string[] }
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

import { registerRestaurantHandlers } from './index'

registerRestaurantHandlers()

const call = (channel: string, data: any = { usuario_id: 1 }) => handles[channel](null, data)

beforeEach(() => {
  db.prepare('DELETE FROM comanda_detalles').run()
  db.prepare('DELETE FROM comandas').run()
  db.prepare("UPDATE mesas SET estado = 'libre' WHERE 1=1").run()
  db.prepare("UPDATE mesas SET activo = 1 WHERE 1=1").run()
})

describe('Restaurant: mesas', () => {

  it('lista mesas con comanda abierta y total', async () => {
    const mesas = await call('mesas:list') as any[]
    expect(mesas.length).toBe(2)
    expect(mesas[0].nombre).toBe('Mesa 1')
    expect(mesas[0].estado).toBe('libre')
  })

  it('crea y elimina mesas (borrado lógico)', async () => {
    const created = await call('mesas:create', { nombre: 'Mesa VIP', capacidad: 8, usuario_id: 1 })
    expect(created.id).toBeTruthy()
    const mesas = await call('mesas:list') as any[]
    expect(mesas.some((m) => m.nombre === 'Mesa VIP')).toBe(true)

    await call('mesas:delete', { id: created.id, usuario_id: 1 })
    const after = await call('mesas:list') as any[]
    expect(after.some((m) => m.nombre === 'Mesa VIP')).toBe(false)
  })

  it('rechaza crear mesa sin nombre', async () => {
    const res = await call('mesas:create', { nombre: '   ', usuario_id: 1 })
    expect(res.success).toBe(false)
  })
})

describe('Restaurant: comandas', () => {
  it('abre comanda y ocupa la mesa; no permite abrir dos veces', async () => {
    const opened = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    expect(opened.comanda_id).toBeTruthy()

    const mesas = await call('mesas:list') as any[]
    const mesa1 = mesas.find((m) => m.id === 1)
    expect(mesa1.estado).toBe('ocupada')
    expect(mesa1.comanda_id).toBe(opened.comanda_id)

    const again = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    expect(again.success).toBe(false)
  })

  it('agrega ítems con precio autocompletado y ítems manuales', async () => {
    const opened = await call('comandas:open', { mesa_id: 2, usuario_id: 1 })
    const comandaId = opened.comanda_id

    await call('comandas:add-item', { comanda_id: comandaId, producto_id: 1, cantidad: 2, usuario_id: 1 })
    await call('comandas:add-item', { comanda_id: comandaId, cantidad: 1, descripcion: 'Agua', precio_unitario: 2.5, usuario_id: 1 })

    const comandas = await call('comandas:list', { activas: true, usuario_id: 1 }) as any[]
    const comanda = comandas.find((c) => c.id === comandaId)
    expect(comanda.detalles.length).toBe(2)
    const hamburguesa = comanda.detalles.find((d: any) => d.producto_id === 1)
    expect(hamburguesa.precio_unitario).toBe(12)
    expect(hamburguesa.subtotal).toBe(24)
    expect(comanda.total).toBe(26.5)
  })

  it('enviar a cocina y marcar ítems hasta servir la comanda', async () => {
    const opened = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    const comandaId = opened.comanda_id
    await call('comandas:add-item', { comanda_id: comandaId, producto_id: 1, cantidad: 1, usuario_id: 1 })
    const list = await call('comandas:list', { activas: true, usuario_id: 1 }) as any[]
    const detalleId = list.find((c) => c.id === comandaId).detalles[0].id

    await call('comandas:send-kitchen', { comanda_id: comandaId, usuario_id: 1 })
    await call('comandas:mark-item', { comanda_id: comandaId, detalle_id: detalleId, estado: 'en_preparacion', usuario_id: 1 })
    await call('comandas:mark-item', { comanda_id: comandaId, detalle_id: detalleId, estado: 'listo', usuario_id: 1 })
    await call('comandas:mark-item', { comanda_id: comandaId, detalle_id: detalleId, estado: 'servido', usuario_id: 1 })

    const after = await call('comandas:list', { activas: true, usuario_id: 1 }) as any[]
    const comanda = after.find((c) => c.id === comandaId)
    expect(comanda.estado).toBe('servida')
  })

  it('cobra la mesa: crea venta con solo ítems servidos y libera la mesa', async () => {
    const opened = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    const comandaId = opened.comanda_id
    await call('comandas:add-item', { comanda_id: comandaId, producto_id: 1, cantidad: 2, usuario_id: 1 }) // 24
    await call('comandas:add-item', { comanda_id: comandaId, producto_id: 2, cantidad: 1, usuario_id: 1 }) // 5
    const list = await call('comandas:list', { activas: true, usuario_id: 1 }) as any[]
    const comanda = list.find((c) => c.id === comandaId)
    // Servir solo el primer ítem; el segundo queda pendiente
    await call('comandas:mark-item', { comanda_id: comandaId, detalle_id: comanda.detalles[0].id, estado: 'servido', usuario_id: 1 })

    const res = await call('comandas:checkout', { comanda_id: comandaId, metodo_pago: 'efectivo', monto_pagado: 30, usuario_id: 1 })
    expect(res.success).toBe(true)
    expect(res.numero_venta).toBe(1)

    const venta = db.prepare('SELECT * FROM ventas WHERE id = ?').get(res.venta_id) as any
    expect(venta.total).toBe(24)
    expect(venta.metodo_pago).toBe('efectivo')
    expect(venta.monto_pagado).toBe(30)
    expect(venta.cambio).toBe(6)

    const detalles = db.prepare('SELECT * FROM venta_detalles WHERE venta_id = ?').all(res.venta_id) as any[]
    expect(detalles.length).toBe(1)
    expect(detalles[0].producto_id).toBe(1)

    // El ítem pendiente se descarta y la comanda queda cobrada
    const comandaFinal = db.prepare('SELECT * FROM comandas WHERE id = ?').get(comandaId) as any
    expect(comandaFinal.estado).toBe('cobrada')
    expect(comandaFinal.venta_id).toBe(res.venta_id)
    const descartado = db.prepare("SELECT estado FROM comanda_detalles WHERE comanda_id = ? AND producto_id = 2").get(comandaId) as any
    expect(descartado.estado).toBe('cancelado')

    const mesas = await call('mesas:list') as any[]
    expect(mesas.find((m) => m.id === 1).estado).toBe('libre')
  })

  it('rechaza cobrar sin ítems servidos o listos', async () => {
    const opened = await call('comandas:open', { mesa_id: 2, usuario_id: 1 })
    await call('comandas:add-item', { comanda_id: opened.comanda_id, producto_id: 1, cantidad: 1, usuario_id: 1 })
    const res = await call('comandas:checkout', { comanda_id: opened.comanda_id, metodo_pago: 'efectivo', usuario_id: 1 })
    expect(res.success).toBe(false)
  })

  it('mueve la comanda a otra mesa libre', async () => {
    const opened = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    const res = await call('comandas:move', { comanda_id: opened.comanda_id, mesa_destino_id: 2, usuario_id: 1 })
    expect(res.success).toBe(true)
    const mesas = await call('mesas:list') as any[]
    expect(mesas.find((m) => m.id === 1).estado).toBe('libre')
    expect(mesas.find((m) => m.id === 2).estado).toBe('ocupada')
  })

  it('fusiona dos mesas ocupadas: junta ítems en la comanda destino y libera la origen', async () => {
    const a = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    await call('comandas:add-item', { comanda_id: a.comanda_id, producto_id: 1, cantidad: 1, usuario_id: 1 }) // 12
    const b = await call('comandas:open', { mesa_id: 2, usuario_id: 1 })
    await call('comandas:add-item', { comanda_id: b.comanda_id, producto_id: 2, cantidad: 2, usuario_id: 1 }) // 10

    const res = await call('comandas:merge', { comanda_id: a.comanda_id, mesa_destino_id: 2, usuario_id: 1 })
    expect(res.success).toBe(true)
    expect(res.comanda_id).toBe(b.comanda_id)

    const comandas = await call('comandas:list', { activas: true, usuario_id: 1 }) as any[]
    const destino = comandas.find((c) => c.id === b.comanda_id)
    expect(destino.detalles.length).toBe(2)
    expect(destino.total).toBe(22)

    // La mesa origen queda libre; la destino sigue ocupada con la comanda fusionada
    const mesas = await call('mesas:list') as any[]
    expect(mesas.find((m) => m.id === 1).estado).toBe('libre')
    expect(mesas.find((m) => m.id === 2).estado).toBe('ocupada')
    expect(mesas.find((m) => m.id === 2).comanda_id).toBe(b.comanda_id)
  })

  it('rechaza fusionar hacia una mesa sin comanda abierta', async () => {
    const a = await call('comandas:open', { mesa_id: 1, usuario_id: 1 })
    const res = await call('comandas:merge', { comanda_id: a.comanda_id, mesa_destino_id: 2, usuario_id: 1 })
    expect(res.success).toBe(false)
  })
})

describe('Restaurant: gating y permisos', () => {
  it('bloquea los handlers si el módulo no está en la licencia', async () => {
    state.active = ['comercializador']
    const res = await call('mesas:list')
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'restaurant']
  })

  it('bloquea sin permisos (sin usuario_id)', async () => {
    const res = await handles['mesas:list'](null, {})
    expect(res.success).toBe(false)
  })
})