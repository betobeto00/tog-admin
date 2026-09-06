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
      monto_pagado REAL,
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
      fecha_apertura TEXT,
      fecha_cierre TEXT,
      fondo_inicial REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'abierta',
      diferencia REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE movimientos_caja (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      caja_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      monto REAL NOT NULL,
      descripcion TEXT,
      referencia_id INTEGER,
      fecha TEXT NOT NULL
    );
    CREATE TABLE creditos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      venta_id INTEGER,
      cliente_id INTEGER,
      deudor_nombre TEXT NOT NULL,
      monto_total REAL NOT NULL DEFAULT 0,
      saldo REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente'
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
import { registrarAsientosVenta, registrarAsientosCompra, revertirAsientosVenta } from './asientos'

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
  db.prepare('DELETE FROM movimientos_caja').run()
  db.prepare('DELETE FROM caja').run()
  db.prepare('DELETE FROM creditos').run()
  db.prepare('DELETE FROM productos').run()
  db.prepare('DELETE FROM clientes').run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('ventas','compras','caja','movimientos_caja','creditos')").run()
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

describe('Contable: mayor y balance', () => {
  it('mayor agrupa por cuenta con saldos debe/haber', async () => {
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'Venta #1', 'caja', 100, 0)").run(fechaEnPeriodo)
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'Venta #1', 'ingresos', 0, 100)").run(fechaEnPeriodo)
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'Venta #2', 'caja', 50, 0)").run(fechaEnPeriodo)

    const res = await call('contable:mayor', { desde: DESDE, hasta: HASTA })
    const caja = res.cuentas.find((c: any) => c.cuenta === 'caja')
    const ingresos = res.cuentas.find((c: any) => c.cuenta === 'ingresos')
    expect(caja.saldo).toBe(150)
    expect(caja.movimientos).toHaveLength(2)
    expect(ingresos.saldo).toBe(-100)
    expect(res.totales.debe).toBe(150)
    expect(res.totales.haber).toBe(100)
  })

  it('balance clasifica cuentas deudoras y acreedoras con saldos naturales', async () => {
    // Venta de 100 al contado con costo 40
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'V', 'caja', 100, 0)").run(fechaEnPeriodo)
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'V', 'ingresos', 0, 100)").run(fechaEnPeriodo)
    db.prepare("INSERT INTO asientos_contables (fecha, tipo, descripcion, cuenta, debe, haber) VALUES (?, 'venta', 'V costo', 'costo', 40, 0)").run(fechaEnPeriodo)

    const res = await call('contable:balance', { desde: DESDE, hasta: HASTA })
    const caja = res.detalle.find((d: any) => d.cuenta === 'caja')
    const ingresos = res.detalle.find((d: any) => d.cuenta === 'ingresos')
    const costo = res.detalle.find((d: any) => d.cuenta === 'costo')
    expect(caja.clase).toBe('activo')
    expect(caja.saldo).toBe(100)
    expect(costo.clase).toBe('activo')
    expect(ingresos.clase).toBe('pasivo_y_capital')
    expect(ingresos.saldo).toBe(100)
    // Utilidad (ingresos - costo) = 60 cuadra con activos (caja 100 - costo ya descontado... aquí saldo natural)
    expect(res.totales.activo).toBe(140)
    expect(res.totales.pasivo_y_capital).toBe(100)
    expect(res.totales.cuadre).toBe(40)
  })
})

describe('Contable: flujo de efectivo', () => {
  it('suma ventas cobradas, entradas, salidas y fondos iniciales', async () => {
    db.prepare("INSERT INTO productos (id, nombre, precio_compra, precio_venta) VALUES (1, 'Lapiz', 1, 2)").run()
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, metodo_pago, monto_pagado, estado) VALUES (1, ?, 20, 20, 'efectivo', 20, 'completada')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, metodo_pago, monto_pagado, estado) VALUES (2, ?, 10, 10, 'fiado', 4, 'completada')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO caja (fecha_apertura, fondo_inicial, estado) VALUES (?, 100, 'abierta')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO movimientos_caja (caja_id, tipo, monto, fecha) VALUES (1, 'entrada', 15, ?)").run(fechaEnPeriodo)
    db.prepare("INSERT INTO movimientos_caja (caja_id, tipo, monto, fecha) VALUES (1, 'salida', 5, ?)").run(fechaEnPeriodo)

    const res = await call('contable:flujo-efectivo', { desde: DESDE, hasta: HASTA })
    expect(res.totales.inflow).toBe(39) // 20 + 4 (parcial fiado) + 15
    expect(res.totales.outflow).toBe(5)
    expect(res.totales.aperturas).toBe(100)
    expect(res.totales.neto).toBe(34)
  })

  it('excluye ventas anuladas del flujo', async () => {
    db.prepare("INSERT INTO ventas (numero_venta, fecha, total, metodo_pago, estado) VALUES (1, ?, 50, 'efectivo', 'anulada')").run(fechaEnPeriodo)
    const res = await call('contable:flujo-efectivo', { desde: DESDE, hasta: HASTA })
    expect(res.totales.inflow).toBe(0)
  })
})

describe('Contable: análisis financiero', () => {
  it('calcula márgenes, ticket promedio y composición por método de pago', async () => {
    db.prepare("INSERT INTO productos (id, nombre, precio_compra, precio_venta) VALUES (1, 'Regla', 2, 10)").run()
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, impuesto, total, metodo_pago, estado) VALUES (1, ?, 100, 16, 116, 'efectivo', 'completada')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, impuesto, total, metodo_pago, estado) VALUES (2, ?, 50, 8, 58, 'transferencia', 'completada')").run(fechaEnPeriodo)
    db.prepare('INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (1, 1, 10, 10, 100)').run()
    db.prepare('INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (2, 1, 5, 10, 50)').run()

    const res = await call('contable:analisis', { desde: DESDE, hasta: HASTA })
    expect(res.base.ventas).toBe(174)
    expect(res.base.costo).toBe(30)
    expect(res.base.utilidadBruta).toBe(144)
    expect(res.base.dias).toBe(1)
    const margen = res.ratios.find((r: any) => r.clave === 'margen_bruto')
    expect(margen.valor).toBeCloseTo(82.8, 1)
    const ticket = res.ratios.find((r: any) => r.clave === 'ticket_promedio')
    expect(ticket.valor).toBe(87)
    expect(res.porMetodo).toHaveLength(2)
  })

  it('reporta CxC pendiente desde créditos', async () => {
    db.prepare("INSERT INTO clientes (id, nombre) VALUES (1, 'Cliente Fiado')").run()
    db.prepare("INSERT INTO ventas (numero_venta, fecha, subtotal, total, cliente_id, metodo_pago, estado) VALUES (1, ?, 30, 30, 1, 'fiado', 'completada')").run(fechaEnPeriodo)
    db.prepare("INSERT INTO creditos (venta_id, cliente_id, deudor_nombre, monto_total, saldo, estado) VALUES (1, 1, 'Cliente Fiado', 30, 12, 'pendiente')").run()

    const res = await call('contable:analisis', { desde: DESDE, hasta: HASTA })
    const cxc = res.ratios.find((r: any) => r.clave === 'cxc_pendiente')
    expect(cxc.valor).toBe(12)
    const ops = res.ratios.find((r: any) => r.clave === 'cxc_operaciones')
    expect(ops.valor).toBe(1)
  })
})

describe('Contable: asientos automáticos', () => {
  it('registrarAsientosVenta genera caja/ingresos/iva/costo y anulación los revierte', async () => {
    db.prepare("INSERT INTO productos (id, nombre, precio_compra, precio_venta) VALUES (1, 'Tijeras', 5, 20)").run()
    db.prepare("INSERT INTO ventas (id, numero_venta, fecha, subtotal, impuesto, total, metodo_pago, monto_pagado, estado) VALUES (9, 1, ?, 100, 16, 116, 'efectivo', 116, 'completada')").run(fechaEnPeriodo)
    db.prepare('INSERT INTO venta_detalles (venta_id, producto_id, cantidad, precio_unitario, subtotal) VALUES (9, 1, 5, 20, 100)').run()

    registrarAsientosVenta(db, { id: 9, numero_venta: 1, fecha: fechaEnPeriodo, total: 116, impuesto: 16, metodo_pago: 'efectivo', monto_pagado: 116 }, 1)

    let asientos = db.prepare('SELECT cuenta, debe, haber FROM asientos_contables ORDER BY cuenta').all() as any[]
    const porCuenta = Object.fromEntries(asientos.map((a) => [a.cuenta, { debe: a.debe, haber: a.haber }]))
    expect(porCuenta.caja.debe).toBe(116)
    expect(porCuenta.ingresos.haber).toBe(116)
    expect(porCuenta.iva.haber).toBe(16)
    expect(porCuenta.costo.debe).toBe(25)

    revertirAsientosVenta(db, 9)
    asientos = db.prepare('SELECT COUNT(*) as n FROM asientos_contables').all() as any[]
    expect(asientos[0].n).toBe(0)
  })

  it('registrarAsientosCompra genera gasto/iva/caja y venta fiado genera cxc', async () => {
    registrarAsientosCompra(db, { id: 3, numero_compra: 3, fecha: fechaEnPeriodo, subtotal: 200, impuesto: 32, total: 232 }, 1)
    const compra = db.prepare('SELECT cuenta, debe, haber FROM asientos_contables WHERE referencia_id = 3 ORDER BY cuenta').all() as any[]
    const porCuenta = Object.fromEntries(compra.map((a) => [a.cuenta, { debe: a.debe, haber: a.haber }]))
    expect(porCuenta.gasto.debe).toBe(200)
    expect(porCuenta.iva.debe).toBe(32)
    expect(porCuenta.caja.haber).toBe(232)

    registrarAsientosVenta(db, { id: 5, numero_venta: 5, fecha: fechaEnPeriodo, total: 90, impuesto: 0, metodo_pago: 'fiado', monto_pagado: 30 }, 1)
    const venta = db.prepare("SELECT cuenta, debe FROM asientos_contables WHERE referencia_id = 5 AND cuenta IN ('caja','cxc')").all() as any[]
    const mapa = Object.fromEntries(venta.map((a) => [a.cuenta, a.debe]))
    expect(mapa.caja).toBe(30)
    expect(mapa.cxc).toBe(60)
  })

  it('un fallo en el asiento no propaga el error (best-effort)', async () => {
    // Tabla sin asientos_contables simulada: insertamos en una tabla que no existe vía db roto
    const dbRoto = { prepare: () => { throw new Error('boom') } } as any
    expect(() => registrarAsientosVenta(dbRoto, { id: 1, numero_venta: 1, fecha: fechaEnPeriodo, total: 10, impuesto: 0, metodo_pago: 'efectivo', monto_pagado: 10 }, 1)).not.toThrow()
    expect(() => registrarAsientosCompra(dbRoto, { id: 1, numero_compra: 1, fecha: fechaEnPeriodo, subtotal: 10, impuesto: 0, total: 10 }, 1)).not.toThrow()
    expect(() => revertirAsientosVenta(dbRoto, 1)).not.toThrow()
  })
})
