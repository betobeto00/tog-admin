import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db, handles } = vi.hoisted(() => {
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
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barras TEXT, sku TEXT, nombre TEXT NOT NULL, descripcion TEXT,
      categoria_id INTEGER, subcategoria_id INTEGER, marca TEXT,
      tipo TEXT NOT NULL DEFAULT 'producto',
      precio_compra REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      stock_minimo REAL NOT NULL DEFAULT 5,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      imagen TEXT, imagen_path TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
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
      tipo_comprobante TEXT NOT NULL DEFAULT 'factura',
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
    CREATE TABLE caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_apertura TEXT NOT NULL DEFAULT (datetime('now')),
      fecha_cierre TEXT,
      fondo_inicial REAL NOT NULL DEFAULT 0,
      total_ventas REAL NOT NULL DEFAULT 0,
      total_entradas REAL NOT NULL DEFAULT 0,
      total_salidas REAL NOT NULL DEFAULT 0,
      total_esperado REAL NOT NULL DEFAULT 0,
      total_real REAL NOT NULL DEFAULT 0,
      diferencia REAL NOT NULL DEFAULT 0,
      usuario_id INTEGER,
      estado TEXT NOT NULL DEFAULT 'abierta',
      notas TEXT,
      cerrado_en TEXT
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
    CREATE TABLE creditos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL, cliente_id INTEGER,
      deudor_nombre TEXT NOT NULL, deudor_telefono TEXT, deudor_documento TEXT,
      monto_total REAL NOT NULL DEFAULT 0, saldo REAL NOT NULL DEFAULT 0,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      usuario_id INTEGER, notas TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE credito_abonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credito_id INTEGER NOT NULL, monto REAL NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      usuario_id INTEGER, notas TEXT
    );
    CREATE TABLE metodos_pago (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL,
      icono TEXT NOT NULL DEFAULT 'DollarSign',
      requiere_terminal INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL, contrasena TEXT NOT NULL,
      nombre TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER NOT NULL DEFAULT 1
    );
  `)
  db.prepare("INSERT INTO configuracion (clave, valor) VALUES ('ticket_numero_venta', '0')").run()
  db.prepare("INSERT INTO metodos_pago (clave, nombre) VALUES ('efectivo', 'Efectivo')").run()
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  return { db, handles }
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
  getActiveModules: () => ['comercializador'],
}))

import { registerCajaHandlers } from './caja'
import { registerVentasHandlers } from './ventas'
import { registerProductosHandlers } from '../inventario/productos'

registerCajaHandlers()
registerVentasHandlers()
registerProductosHandlers()

const send = (ch: string, data: any) => handles[ch](null, data)

const crearProducto = (overrides: any = {}) => {
  const res = db.prepare(`
    INSERT INTO productos (nombre, tipo, precio_venta, precio_compra, stock, stock_minimo, unidad)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.nombre || 'Producto X',
    overrides.tipo || 'producto',
    overrides.precio_venta ?? 10,
    overrides.precio_compra ?? 5,
    overrides.stock ?? 50,
    overrides.stock_minimo ?? 5,
    overrides.unidad || 'unidad',
  )
  return res.lastInsertRowid as number
}

const baseVenta = (overrides: any = {}) => ({
  usuario_id: 1,
  subtotal: 100,
  impuesto: 0,
  descuento: 0,
  total: 100,
  metodo_pago: 'efectivo',
  monto_pagado: 100,
  cambio: 0,
  detalles: [{ producto_id: 1, cantidad: 1, precio_unitario: 100, descuento: 0, subtotal: 100 }],
  ...overrides,
})

describe('flujo caja: abrir → venta → cerrar', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM venta_detalles').run()
    db.prepare('DELETE FROM ventas').run()
    db.prepare('DELETE FROM movimientos_caja').run()
    db.prepare('DELETE FROM caja').run()
    db.prepare('DELETE FROM productos').run()
    db.prepare('DELETE FROM creditos').run()
    db.prepare("UPDATE configuracion SET valor = '0' WHERE clave = 'ticket_numero_venta'").run()
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('productos','ventas','venta_detalles','caja','movimientos_caja')")
  })

  it('rechaza abrir segunda caja mientras hay una abierta', async () => {
    const abrir1 = await send('caja:abrir', { usuario_id: 1, fondo_inicial: 100 })
    expect(abrir1.success).toBe(true)
    const abrir2 = await send('caja:abrir', { usuario_id: 1, fondo_inicial: 50 })
    expect(abrir2.success).toBe(false)
    expect(abrir2.error).toBeTruthy()
  })

  it('venta con caja abierta registra movimiento y suma a total_ventas', async () => {
    crearProducto({ nombre: 'Cuaderno', stock: 20, precio_venta: 50 })
    const abrir = await send('caja:abrir', { usuario_id: 1, fondo_inicial: 100 })
    expect(abrir.success).toBe(true)
    const cajaId = abrir.id as number

    const venta = await send('ventas:create', baseVenta({
      total: 150,
      monto_pagado: 150,
      detalles: [{ producto_id: 1, cantidad: 3, precio_unitario: 50, descuento: 0, subtotal: 150 }],
    }))
    expect(venta.success).toBe(true)

    const movimientos = db.prepare("SELECT * FROM movimientos_caja WHERE caja_id = ?").all(cajaId) as any[]
    expect(movimientos.length).toBe(1)
    expect(movimientos[0].tipo).toBe('venta')
    expect(movimientos[0].monto).toBe(150)

    const caja: any = db.prepare('SELECT * FROM caja WHERE id = ?').get(cajaId)
    expect(caja.total_ventas).toBe(150)
  })

  it('movimiento manual de entrada y salida actualiza totales', async () => {
    const abrir = await send('caja:abrir', { usuario_id: 1, fondo_inicial: 100 })
    const cajaId = abrir.id as number

    await send('caja:movimiento', { usuario_id: 1, tipo: 'entrada', monto: 50, descripcion: 'Vueltos' })
    await send('caja:movimiento', { usuario_id: 1, tipo: 'salida', monto: 20, descripcion: 'Café' })

    const caja: any = db.prepare('SELECT * FROM caja WHERE id = ?').get(cajaId)
    expect(caja.total_entradas).toBe(50)
    expect(caja.total_salidas).toBe(20)
  })

  it('cierre concilia: esperado = fondo + ventas + entradas − salidas', async () => {
    crearProducto({ nombre: 'Resma', stock: 10, precio_venta: 30 })
    await send('caja:abrir', { usuario_id: 1, fondo_inicial: 100 })
    const caja: any = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get()
    const cajaId = caja.id as number

    await send('ventas:create', baseVenta({
      total: 60,
      monto_pagado: 60,
      detalles: [{ producto_id: 1, cantidad: 2, precio_unitario: 30, descuento: 0, subtotal: 60 }],
    }))
    await send('caja:movimiento', { usuario_id: 1, tipo: 'entrada', monto: 10, descripcion: 'Extra' })

    const cerrar = await send('caja:cerrar', { usuario_id: 1, caja_id: cajaId, total_real: 170, notas: '' })
    expect(cerrar.success).toBe(true)

    const cerrada: any = db.prepare('SELECT * FROM caja WHERE id = ?').get(cajaId)
    expect(cerrada.estado).toBe('cerrada')
    // fondo 100 + ventas 60 + entradas 10 = 170
    expect(cerrada.total_esperado).toBe(170)
    expect(cerrada.diferencia).toBe(0)
    expect(cerrada.fecha_cierre).toBeTruthy()
  })

  it('cierre detecta diferencia cuando el conteo físico no coincide', async () => {
    await send('caja:abrir', { usuario_id: 1, fondo_inicial: 100 })
    const caja: any = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get()

    const cerrar = await send('caja:cerrar', { usuario_id: 1, caja_id: caja.id, total_real: 95, notas: 'Faltan 5' })
    expect(cerrar.success).toBe(true)
    expect(cerrar.diferencia).toBe(-5)

    const cerrada: any = db.prepare('SELECT * FROM caja WHERE id = ?').get(caja.id)
    expect(cerrada.diferencia).toBe(-5)
    expect(cerrada.notas).toBe('Faltan 5')
  })

  it('caja:status devuelve null con caja cerrada', async () => {
    await send('caja:abrir', { usuario_id: 1, fondo_inicial: 100 })
    const caja: any = db.prepare("SELECT id FROM caja WHERE estado = 'abierta' LIMIT 1").get()
    await send('caja:cerrar', { usuario_id: 1, caja_id: caja.id, total_real: 100 })

    const status = await send('caja:status', { usuario_id: 1 })
    expect(status).toBeUndefined()
  })
})