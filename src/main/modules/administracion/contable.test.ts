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
  }
  db.exec(`
    CREATE TABLE ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_venta INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      usuario_id INTEGER,
      cliente_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      descuento REAL NOT NULL DEFAULT 0,
      impuesto REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      estado TEXT NOT NULL DEFAULT 'completada'
    );
    CREATE TABLE venta_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER NOT NULL REFERENCES ventas(id),
      producto_id INTEGER NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      precio_unitario REAL NOT NULL DEFAULT 0,
      descuento REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE compras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_compra INTEGER NOT NULL,
      fecha TEXT NOT NULL,
      proveedor_id INTEGER,
      usuario_id INTEGER,
      subtotal REAL NOT NULL DEFAULT 0,
      impuesto REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      metodo_pago TEXT NOT NULL DEFAULT 'efectivo',
      estado TEXT NOT NULL DEFAULT 'completada'
    );
    CREATE TABLE compra_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      compra_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1,
      costo_unitario REAL NOT NULL DEFAULT 0,
      subtotal REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL);
    CREATE TABLE proveedores (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL);
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'producto',
      precio_compra REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      activo INTEGER NOT NULL DEFAULT 1,
      es_combo INTEGER NOT NULL DEFAULT 0,
      costo_real REAL
    );
    CREATE TABLE ajustes_inventario (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      producto_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      stock_anterior INTEGER NOT NULL,
      stock_nuevo INTEGER NOT NULL,
      diferencia INTEGER NOT NULL,
      justificacion TEXT NOT NULL,
      fecha TEXT NOT NULL
    );
    CREATE TABLE asientos_contables (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha TEXT NOT NULL,
      tipo TEXT NOT NULL,
      descripcion TEXT NOT NULL,
      referencia_tipo TEXT,
      referencia_id INTEGER,
      cuenta TEXT NOT NULL,
      debe REAL NOT NULL DEFAULT 0,
      haber REAL NOT NULL DEFAULT 0,
      usuario_id INTEGER
    );
    CREATE TABLE caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      fecha_cierre TEXT,
      estado TEXT NOT NULL DEFAULT 'abierta',
      diferencia REAL NOT NULL DEFAULT 0
    );
  `)
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'administracion'] as string[] }
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

import { registerContableHandlers } from './contable'

registerContableHandlers()

const call = (channel: string, data: any = {}) => handles[channel](null, { usuario_id: 1, ...data })

const hoy = new Date()
const YYYY = hoy.getFullYear()
const MM = String(hoy.getMonth() + 1).padStart(2, '0')
const DD = String(hoy.getDate()).padStart(2, '0')
const DESDE = `${YYYY}-${MM}-01`
const HASTA = `${YYYY}-${MM}-${DD}`
const fechaEnPeriodo = `${YYYY}-${MM}-${DD} 10:00:00`

beforeEach(() => {
  db.prepare('DELETE FROM venta_detalles').run()
  db.prepare('DELETE FROM ventas').run()
  db.prepare('DELETE FROM compra_detalles').run()
  db.prepare('DELETE FROM compras').run()
  db.prepare('DELETE FROM ajustes_inventario').run()
  db.prepare('DELETE FROM asientos_contables').run()
  db.prepare('DELETE FROM caja').run()
  db.prepare('DELETE FROM productos').run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('ventas','compras')").run()
})

describe('Contable: resumen', () => {
  it('calcula ventas, costo de ventas y utilidad bruta del período', async () => {
    db.prepare("INSERT INTO productos (id, nombre, precio_compra, precio_venta) VALUES (1, 'Cuaderno', 3, 10)").run()
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, impuesto, total, estado) VALUES (1, ?, 20, 0, 20, 'completada')").run(fechaEnPeriodo)
    db.prepare('INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (1, 1, 2, 10, 20)').run()

    const res = await call('contable:resumen', { desde: DESDE, hasta: HASTA })
    expect(res.ventas.total).toBe(20)
    expect(res.costoVentas).toBe(6)
    expect(res.utilidadBruta).toBe(14)
  })

  it('excluye ventas anuladas del resumen', async () => {
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, estado) VALUES (1, ?, 100, 100, 'anulada')").run(fechaEnPeriodo)
    const res = await call('contable:resumen', { desde: DESDE, hasta: HASTA })
    expect(res.ventas.total).toBe(0)
    expect(res.ventas.cantidad).toBe(0)
  })

  it('usa costo_real para combos en el costo de ventas', async () => {
    db.prepare("INSERT INTO productos (id, nombre, precio_compra, precio_venta, es_combo, costo_real) VALUES (2, 'Combo', 5, 15, 1, 4)").run()
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, estado) VALUES (1, ?, 15, 15, 'completada')").run(fechaEnPeriodo)
    db.prepare('INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (1, 2, 1, 15, 15)').run()
    const res = await call('contable:resumen', { desde: DESDE, hasta: HASTA })
    expect(res.costoVentas).toBe(4)
  })
})

describe('Contable: libros', () => {
  it('libro de ventas lista filas con totales y CSV', async () => {
    db.prepare('INSERT INTO clientes (id, nombre) VALUES (1, ?)').run('Batey Store')
    db.prepare("INSERT INTO ventas (numero_venta, fecha, cliente_id, subtotal, descuento, impuesto, total, metodo_pago, estado) VALUES (7, ?, 1, 100, 5, 16, 111, 'efectivo', 'completada')").run(fechaEnPeriodo)

    const res = await call('contable:libro-ventas', { desde: DESDE, hasta: HASTA })
    expect(res.filas).toHaveLength(1)
    expect(res.filas[0].numero_venta).toBe(7)
    expect(res.filas[0].cliente_nombre).toBe('Batey Store')
    expect(res.totales.total).toBe(111)
    expect(res.csv).toContain('Numero')
    expect(res.csv).toContain('7')
  })

  it('libro de ventas excluye anuladas y borradores', async () => {
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, estado) VALUES (1, ?, 50, 50, 'anulada')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, estado) VALUES (2, ?, 60, 60, 'borrador')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, estado) VALUES (3, ?, 70, 70, 'completada')").run(fechaEnPeriodo)

    const res = await call('contable:libro-ventas', { desde: DESDE, hasta: HASTA })
    expect(res.filas).toHaveLength(1)
    expect(res.filas[0].numero_venta).toBe(3)
  })

  it('libro de compras acumula totales y CSV con proveedor', async () => {
    db.prepare('INSERT INTO proveedores (id, nombre) VALUES (1, ?)').run('Papelera Central')
    db.prepare("INSERT INTO compras (numero_compra, fecha, proveedor_id, subtotal, impuesto, total, estado) VALUES (3, ?, 1, 200, 32, 232, 'completada')").run(fechaEnPeriodo)

    const res = await call('contable:libro-compras', { desde: DESDE, hasta: HASTA })
    expect(res.filas).toHaveLength(1)
    expect(res.filas[0].proveedor_nombre).toBe('Papelera Central')
    expect(res.totales.total).toBe(232)
    expect(res.csv).toContain('Papelera Central')
  })

  it('libro de inventario arma kardex con entradas, salidas y ajustes', async () => {
    db.prepare("INSERT INTO productos (id, nombre, stock, precio_compra) VALUES (1, 'Resma', 40, 3)").run()
    db.prepare("INSERT INTO compras (numero_compra, fecha, subtotal, total, estado) VALUES (1, ?, 150, 150, 'completada')").run(fechaEnPeriodo)
    db.prepare('INSERT INTO compra_detalles (compra_id, producto_id, cantidad, costo_unitario, subtotal) VALUES (1, 1, 50, 3, 150)').run()
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, estado) VALUES (1, ?, 20, 20, 'completada')").run(fechaEnPeriodo)
    db.prepare('INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (1, 1, 4, 5, 20)').run()
    db.prepare('INSERT INTO ajustes_inventario (producto_id, usuario_id, stock_anterior, stock_nuevo, diferencia, justificacion, fecha) VALUES (1, 1, 10, 8, -2, ?, ?)').run('merma', fechaEnPeriodo)

    const res = await call('contable:libro-inventario', { desde: DESDE, hasta: HASTA })
    expect(res.filas).toHaveLength(1)
    expect(res.filas[0].motivo).toBe('merma')
    const k = res.kardex.find((x: any) => x.id === 1)
    expect(k.entradas_compras).toBe(50)
    expect(k.salidas_ventas).toBe(4)
    expect(k.ajustes).toBe(-2)
    expect(k.valor_stock).toBe(120)
    expect(res.csv).toContain('merma')
  })

  it('libro diario devuelve asientos con totales debe/haber', async () => {
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'Venta #1', 'caja', 100, 0)").run(fechaEnPeriodo)
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'Venta #1', 'ingresos', 0, 100)").run(fechaEnPeriodo)

    const res = await call('contable:libro-diario', { desde: DESDE, hasta: HASTA })
    expect(res.asientos).toHaveLength(2)
    expect(res.totales.debe).toBe(100)
    expect(res.totales.haber).toBe(100)
  })
})

describe('Contable: gating y permisos', () => {
  it('bloquea los handlers si el módulo no está en la licencia', async () => {
    state.active = ['comercializador']
    const res = await call('contable:resumen')
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'administracion']
  })

  it('bloquea sin permisos (sin usuario_id)', async () => {
    const res = await handles['contable:resumen'](null, {})
    expect(res.success).toBe(false)
  })

  it('usa el mes actual si no se envía período', async () => {
    const res = await call('contable:resumen')
    const hoyISO = new Date().toISOString().slice(0, 10)
    expect(res.periodo.desde).toBe(`${hoyISO.slice(0, 7)}-01`)
    expect(res.periodo.hasta).toContain(hoyISO)
  })
})
