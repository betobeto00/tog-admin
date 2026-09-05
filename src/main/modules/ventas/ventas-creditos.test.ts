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
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      codigo_barras TEXT,
      sku TEXT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria_id INTEGER,
      subcategoria_id INTEGER,
      marca TEXT,
      tipo TEXT NOT NULL DEFAULT 'producto',
      precio_compra REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      stock_minimo REAL NOT NULL DEFAULT 5,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      imagen TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE categorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE subcategorias (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      categoria_id INTEGER NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      documento TEXT,
      telefono TEXT,
      email TEXT,
      direccion TEXT,
      limite_credito REAL NOT NULL DEFAULT 0,
      notas TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
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
    CREATE TABLE credito_abonos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      credito_id INTEGER NOT NULL,
      monto REAL NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      usuario_id INTEGER,
      notas TEXT
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
    CREATE TABLE metodos_pago (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      clave TEXT NOT NULL UNIQUE,
      nombre TEXT NOT NULL,
      icono TEXT NOT NULL DEFAULT 'DollarSign',
      requiere_terminal INTEGER NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      orden INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL,
      contrasena TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER NOT NULL DEFAULT 1
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
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'distribuidor'] as string[] }
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

import { registerVentasHandlers } from './ventas'
import { registerCreditosHandlers } from './creditos'
import { registerProductosHandlers } from '../inventario/productos'
import { registerSubcategoriasHandlers } from '../inventario/subcategorias'
import { registerCombosHandlers } from '../inventario/combos'

registerVentasHandlers()
registerCreditosHandlers()
registerProductosHandlers()
registerSubcategoriasHandlers()
registerCombosHandlers()

const send = (ch: string, data: any) => handles[ch](null, data)

const crearProducto = (overrides: any = {}) => {
  const res = db.prepare(`
    INSERT INTO productos (nombre, tipo, precio_venta, precio_compra, stock, stock_minimo, unidad, marca, imagen)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    overrides.nombre || 'Producto X',
    overrides.tipo || 'producto',
    overrides.precio_venta ?? 10,
    overrides.precio_compra ?? 5,
    overrides.stock ?? 50,
    overrides.stock_minimo ?? 5,
    overrides.unidad || 'unidad',
    overrides.marca || null,
    overrides.imagen || null,
  )
  return res.lastInsertRowid as number
}

const crearCliente = (limite = 0) => {
  const res = db.prepare('INSERT INTO clientes (nombre, limite_credito) VALUES (?, ?)').run('Cliente Test', limite)
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

describe('ventas:create — tipo producto vs servicio', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM venta_detalles').run()
    db.prepare('DELETE FROM ventas').run()
    db.prepare('DELETE FROM creditos').run()
    db.prepare('DELETE FROM productos').run()
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('productos','ventas','venta_detalles','creditos')")
  })

  it('descuenta stock solo de productos (no servicios)', async () => {
    crearProducto({ nombre: 'Artículo físico', tipo: 'producto', stock: 10 })
    const servicio = crearProducto({ nombre: 'Mano de obra', tipo: 'servicio', stock: 0 })

    const res = await send('ventas:create', baseVenta({
      total: 200,
      monto_pagado: 200,
      detalles: [
        { producto_id: 1, cantidad: 3, precio_unitario: 50, descuento: 0, subtotal: 150 },
        { producto_id: servicio, cantidad: 2, precio_unitario: 25, descuento: 0, subtotal: 50 },
      ],
    }))
    expect(res.success).toBe(true)

    const fisico: any = db.prepare('SELECT stock FROM productos WHERE id = 1').get()
    expect(fisico.stock).toBe(7)
    const svc: any = db.prepare('SELECT stock FROM productos WHERE id = ?').get(servicio)
    expect(svc.stock).toBe(0)
  })

  it('permite venta de servicio sin stock suficiente', async () => {
    crearProducto({ nombre: 'Servicio premium', tipo: 'servicio', stock: 0 })
    const res = await send('ventas:create', baseVenta({
      total: 300,
      monto_pagado: 300,
      detalles: [{ producto_id: 1, cantidad: 30, precio_unitario: 10, descuento: 0, subtotal: 300 }],
    }))
    expect(res.success).toBe(true)
  })

  it('rechaza venta con stock insuficiente de producto físico', async () => {
    crearProducto({ nombre: 'Físico', tipo: 'producto', stock: 2 })
    const res = await send('ventas:create', baseVenta({
      detalles: [{ producto_id: 1, cantidad: 5, precio_unitario: 10, descuento: 0, subtotal: 50 }],
    }))
    expect(res.success).toBe(false)
    expect(res.error).toContain('Stock insuficiente')
  })

  it('persiste líneas de venta rápida (descripción, sin producto)', async () => {
    crearProducto({ nombre: 'Físico', stock: 10 })
    const res = await send('ventas:create', baseVenta({
      detalles: [
        { producto_id: 1, cantidad: 1, precio_unitario: 10, descuento: 0, subtotal: 10 },
        { producto_id: null, descripcion: 'Flete express', cantidad: 1, precio_unitario: 20, descuento: 0, subtotal: 20 },
      ],
    }))
    expect(res.success).toBe(true)
    const fila: any = db.prepare("SELECT * FROM venta_detalles WHERE descripcion = 'Flete express'").get()
    expect(fila.producto_id).toBe(null)
  })
})

describe('crédito / fiado', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM movimientos_caja').run()
    db.prepare('DELETE FROM caja').run()
    db.prepare('DELETE FROM credito_abonos').run()
    db.prepare('DELETE FROM creditos').run()
    db.prepare('DELETE FROM venta_detalles').run()
    db.prepare('DELETE FROM ventas').run()
    db.prepare('DELETE FROM productos').run()
    db.prepare('DELETE FROM clientes').run()
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('productos','ventas','venta_detalles','creditos','credito_abonos','clientes','caja','movimientos_caja')")
  })

  it('registra fiado a nombre libre con saldo pendiente', async () => {
    crearProducto({ stock: 10 })
    const res = await send('ventas:create', baseVenta({
      metodo_pago: 'fiado',
      monto_pagado: 20,
      cambio: 0,
      deudor_nombre: 'Juan Pérez',
      deudor_telefono: '555-1234',
    }))
    expect(res.success).toBe(true)
    expect(res.credito_id).toBeGreaterThan(0)
    const credito: any = db.prepare('SELECT * FROM creditos WHERE venta_id = ?').get(res.id)
    expect(credito.deudor_nombre).toBe('Juan Pérez')
    expect(credito.cliente_id).toBe(null)
    expect(credito.monto_total).toBe(100)
    expect(credito.saldo).toBe(80)
    expect(credito.estado).toBe('pendiente')
  })

  it('exige deudor o cliente al vender fiado', async () => {
    crearProducto({ stock: 10 })
    const res = await send('ventas:create', baseVenta({ metodo_pago: 'fiado', monto_pagado: 0 }))
    expect(res.success).toBe(false)
    expect(res.error).toContain('deudor')
  })

  it('respeta el límite de crédito del cliente registrado', async () => {
    const cliente = crearCliente(100)
    crearProducto({ stock: 100 })
    const primera = await send('ventas:create', baseVenta({
      metodo_pago: 'fiado',
      monto_pagado: 0,
      cliente_id: cliente,
      total: 60,
      subtotal: 60,
      detalles: [{ producto_id: 1, cantidad: 1, precio_unitario: 60, descuento: 0, subtotal: 60 }],
    }))
    expect(primera.success).toBe(true)

    const excedida = await send('ventas:create', baseVenta({
      metodo_pago: 'fiado',
      monto_pagado: 0,
      cliente_id: cliente,
      total: 50,
      subtotal: 50,
      detalles: [{ producto_id: 1, cantidad: 1, precio_unitario: 50, descuento: 0, subtotal: 50 }],
    }))
    expect(excedida.success).toBe(false)
    expect(excedida.error).toContain('Límite de crédito excedido')
  })

  it('bloquea fiado a cliente si el módulo Distribuidor no está activo', async () => {
    const cliente = crearCliente(1000)
    crearProducto({ stock: 100 })
    state.active = ['comercializador']
    const res = await send('ventas:create', baseVenta({
      metodo_pago: 'fiado',
      monto_pagado: 0,
      cliente_id: cliente,
    }))
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'distribuidor']
  })

  it('cuando hay caja abierta, solo cuenta lo cobrado (abono inicial)', async () => {
    crearProducto({ stock: 10 })
    db.prepare("INSERT INTO caja (estado, fondo_inicial) VALUES ('abierta', 0)").run()
    const res = await send('ventas:create', baseVenta({
      metodo_pago: 'fiado',
      monto_pagado: 30,
      cambio: 0,
      deudor_nombre: 'Ana',
    }))
    expect(res.success).toBe(true)
    const caja: any = db.prepare('SELECT total_ventas FROM caja').get()
    expect(caja.total_ventas).toBe(30)
  })

  it('registra abonos, reduce saldo y pasa a pagado al saldar', async () => {
    crearProducto({ stock: 10 })
    const venta = await send('ventas:create', baseVenta({
      metodo_pago: 'fiado',
      monto_pagado: 20,
      deudor_nombre: 'Carlos',
    }))
    expect(venta.credito_id).toBeGreaterThan(0)
    const creditoId = venta.credito_id as number

    const parcial = await send('creditos:abono', { usuario_id: 1, credito_id: creditoId, monto: 30, notas: 'Primer pago' })
    expect(parcial.success).toBe(true)
    expect(parcial.saldo).toBe(50)

    const final = await send('creditos:abono', { usuario_id: 1, credito_id: creditoId, monto: 50 })
    expect(final.success).toBe(true)
    expect(final.estado).toBe('pagado')

    const credito: any = db.prepare('SELECT * FROM creditos WHERE id = ?').get(creditoId)
    expect(credito.estado).toBe('pagado')
    expect(credito.saldo).toBe(0)
    const abonos: any = db.prepare('SELECT COUNT(*) as n FROM credito_abonos WHERE credito_id = ?').get(creditoId)
    expect(abonos.n).toBe(2)
  })

  it('rechaza abono mayor al saldo y abono sobre crédito pagado', async () => {
    crearProducto({ stock: 10 })
    const venta = await send('ventas:create', baseVenta({ metodo_pago: 'fiado', monto_pagado: 0, deudor_nombre: 'Luis' }))
    const creditoId = venta.credito_id as number

    const excede = await send('creditos:abono', { usuario_id: 1, credito_id: creditoId, monto: 999 })
    expect(excede.success).toBe(false)
    expect(excede.error).toContain('supera el saldo')

    await send('creditos:abono', { usuario_id: 1, credito_id: creditoId, monto: 100 })
    const otraVez = await send('creditos:abono', { usuario_id: 1, credito_id: creditoId, monto: 10 })
    expect(otraVez.success).toBe(false)
  })

  it('anula venta fiado pendiente sin abonos y marca el crédito anulado', async () => {
    crearProducto({ stock: 10 })
    const venta = await send('ventas:create', baseVenta({ metodo_pago: 'fiado', monto_pagado: 0, deudor_nombre: 'Pedro' }))
    const res = await send('ventas:anular', { usuario_id: 1, id: venta.id, motivo: 'Error de caja' })
    expect(res.success).toBe(true)
    const credito: any = db.prepare('SELECT * FROM creditos WHERE venta_id = ?').get(venta.id)
    expect(credito.estado).toBe('anulado')
  })

  it('bloquea anular venta fiado con abonos registrados', async () => {
    crearProducto({ stock: 10 })
    const venta = await send('ventas:create', baseVenta({ metodo_pago: 'fiado', monto_pagado: 0, deudor_nombre: 'Rosa' }))
    await send('creditos:abono', { usuario_id: 1, credito_id: venta.credito_id, monto: 10 })
    const res = await send('ventas:anular', { usuario_id: 1, id: venta.id, motivo: 'X' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('No se puede anular')
  })
})

describe('subcategorias + marca en productos', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM productos').run()
    db.prepare('DELETE FROM subcategorias').run()
    db.prepare('DELETE FROM categorias').run()
  })

  it('CRUD de subcategorías ligadas a una categoría', async () => {
    const cat = db.prepare("INSERT INTO categorias (nombre) VALUES ('Papelería')").run().lastInsertRowid as number
    const creada = await send('subcategorias:create', { usuario_id: 1, nombre: 'Cuadernos', categoria_id: cat })
    expect(creada.id).toBeGreaterThan(0)

    const filas: any[] = await send('subcategorias:list', { usuario_id: 1, categoria_id: cat })
    expect(filas).toHaveLength(1)
    expect(filas[0].categoria_nombre).toBe('Papelería')

    await send('subcategorias:update', { usuario_id: 1, id: creada.id, data: { nombre: 'Blocks' } })
    const actualizada: any = db.prepare('SELECT nombre FROM subcategorias WHERE id = ?').get(creada.id)
    expect(actualizada.nombre).toBe('Blocks')

    await send('subcategorias:delete', { usuario_id: 1, id: creada.id })
    const vacias: any[] = await send('subcategorias:list', { usuario_id: 1 })
    expect(vacias).toHaveLength(0)
  })

  it('persiste tipo, marca e imagen al crear y actualizar producto', async () => {
    const creado = await send('productos:create', {
      usuario_id: 1,
      nombre: 'Limpieza de PC',
      tipo: 'servicio',
      marca: 'TOG Services',
      precio_venta: 15,
      stock: 0,
      imagen: 'data:image/png;base64,xxxx',
    })
    expect(creado.id).toBeGreaterThan(0)
    const fila: any = db.prepare('SELECT * FROM productos WHERE id = ?').get(creado.id)
    expect(fila.tipo).toBe('servicio')
    expect(fila.marca).toBe('TOG Services')
    expect(fila.imagen).toContain('base64')
    expect(fila.stock).toBe(0)

    const update = await send('productos:update', {
      usuario_id: 1,
      id: creado.id,
      data: { nombre: 'Limpieza Premium', tipo: 'servicio', marca: '', imagen: '' },
    })
    expect(update.success).toBe(true)
    const limpio: any = db.prepare('SELECT marca, imagen FROM productos WHERE id = ?').get(creado.id)
    expect(limpio.marca).toBe(null)
    expect(limpio.imagen).toBe(null)
  })
})

describe('ventas:resumen-dia — distribución por método configurado', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM venta_detalles').run()
    db.prepare('DELETE FROM ventas').run()
    db.prepare('DELETE FROM creditos').run()
    db.prepare('DELETE FROM productos').run()
    db.prepare('DELETE FROM metodos_pago').run()
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('productos','ventas','venta_detalles','creditos','metodos_pago')")
  })

  it('agrupa las ventas del día por método con el nombre configurado', async () => {
    db.prepare("INSERT INTO metodos_pago (clave, nombre, orden) VALUES ('efectivo','Efectivo',1)").run()
    db.prepare("INSERT INTO metodos_pago (clave, nombre, orden) VALUES ('transferencia','Transferencia Bancaria',2)").run()
    db.prepare("INSERT INTO metodos_pago (clave, nombre, orden) VALUES ('fiado','Fiado',3)").run()
    crearProducto()

    await send('ventas:create', baseVenta({ metodo_pago: 'efectivo', monto_pagado: 100, total: 100 }))
    await send('ventas:create', baseVenta({ metodo_pago: 'transferencia', monto_pagado: 200, total: 200 }))
    const fiado = await send('ventas:create', {
      ...baseVenta({ metodo_pago: 'fiado', monto_pagado: 20, total: 100, deudor_nombre: 'Luis' }),
      detalles: [{ producto_id: 1, cantidad: 1, precio_unitario: 100, descuento: 0, subtotal: 100 }],
    })
    expect(fiado.success).toBe(true)

    const res = await send('ventas:resumen-dia', { usuario_id: 1 })
    expect(res.monto_total).toBe(400)
    expect(res.por_metodo).toEqual(expect.arrayContaining([
      expect.objectContaining({ clave: 'efectivo', nombre: 'Efectivo', total: 100 }),
      expect.objectContaining({ clave: 'transferencia', nombre: 'Transferencia Bancaria', total: 200 }),
      expect.objectContaining({ clave: 'fiado', nombre: 'Fiado', total: 100 }),
    ]))
  })

  it('no incluye las ventas anuladas en el desglose', async () => {
    db.prepare("INSERT INTO metodos_pago (clave, nombre, orden) VALUES ('efectivo','Efectivo',1)").run()
    crearProducto()
    await send('ventas:create', baseVenta({ metodo_pago: 'efectivo', monto_pagado: 100, total: 100 }))
    const venta = await send('ventas:create', baseVenta({ metodo_pago: 'efectivo', monto_pagado: 50, total: 50 }))
    await send('ventas:anular', { usuario_id: 1, id: venta.id, motivo: 'prueba' })

    const res = await send('ventas:resumen-dia', { usuario_id: 1 })
    expect(res.total_ventas).toBe(1)
    expect(res.monto_total).toBe(100)
    const efectivo = res.por_metodo.find((p: any) => p.clave === 'efectivo')
    expect(efectivo?.total).toBe(100)
  })
})

describe('combos / productos compuestos', () => {
  const limpiar = () => {
    db.prepare('DELETE FROM venta_detalle_componentes').run()
    db.prepare('DELETE FROM venta_detalles').run()
    db.prepare('DELETE FROM ventas').run()
    db.prepare('DELETE FROM creditos').run()
    db.prepare('DELETE FROM producto_componentes').run()
    db.prepare('DELETE FROM productos').run()
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('productos','ventas','venta_detalles','venta_detalle_componentes','producto_componentes')")
  }

  const guardarCombo = async (productoId: number, componentes: { componente_id: number; cantidad: number }[]) =>
    send('combos:guardar', { usuario_id: 1, producto_id: productoId, componentes })

  it('guarda componentes y calcula el costo real', async () => {
    const harina = crearProducto({ nombre: 'Harina', precio_compra: 2, stock: 100 })
    const queso = crearProducto({ nombre: 'Queso', precio_compra: 5, stock: 50 })
    const combo = crearProducto({ nombre: 'Arepa rellena', precio_compra: 0, precio_venta: 12 })

    const res = await guardarCombo(combo, [
      { componente_id: harina, cantidad: 1 },
      { componente_id: queso, cantidad: 2 },
    ])
    expect(res.success).toBe(true)
    expect(res.costo_real).toBe(12)

    const detalle = await send('combos:get', { usuario_id: 1, producto_id: combo })
    expect(detalle.costo_real).toBe(12)
    expect(detalle.componentes).toHaveLength(2)

    const listado = await send('productos:list', { usuario_id: 1 })
    const fila = listado.find((p: any) => p.id === combo)
    expect(fila.es_combo).toBe(1)
    expect(fila.stock).toBe(25) // min(floor(100/1), floor(50/2))
    expect(fila.costo_real).toBe(12)
  })

  it('rechaza componentes duplicados, inexistentes y ciclos', async () => {
    limpiar()
    const a = crearProducto({ nombre: 'A', stock: 10 })
    const b = crearProducto({ nombre: 'B', stock: 10 })
    const c = crearProducto({ nombre: 'C', stock: 10 })

    const dup = await guardarCombo(a, [{ componente_id: b, cantidad: 1 }, { componente_id: b, cantidad: 2 }])
    expect(dup.success).toBe(false)
    const duplicado = db.prepare('SELECT COUNT(*) as n FROM producto_componentes').get() as any
    expect(duplicado.n).toBe(0) // la validación no insertó nada

    // a → b válido; b → a crearía ciclo
    expect((await guardarCombo(a, [{ componente_id: b, cantidad: 1 }])).success).toBe(true)
    const ciclo = await guardarCombo(b, [{ componente_id: a, cantidad: 1 }])
    expect(ciclo.success).toBe(false)

    // c → a válido; a → c después crearía ciclo (a→b…→c→a no, pero c→a ya no existe como hijo de a)
    expect((await guardarCombo(c, [{ componente_id: a, cantidad: 1 }])).success).toBe(true)
    const ciclo2 = await guardarCombo(a, [{ componente_id: c, cantidad: 1 }])
    expect(ciclo2.success).toBe(false)

    const inexistente = await guardarCombo(a, [{ componente_id: 9999, cantidad: 1 }])
    expect(inexistente.success).toBe(false)
  })

  it('vender un combo descuenta el stock de los componentes y guarda el desglose', async () => {
    limpiar()
    const harina = crearProducto({ nombre: 'Harina', precio_compra: 2, stock: 100 })
    const queso = crearProducto({ nombre: 'Queso', precio_compra: 5, stock: 10 })
    const combo = crearProducto({ nombre: 'Arepa', precio_compra: 0, precio_venta: 12 })
    await guardarCombo(combo, [
      { componente_id: harina, cantidad: 1 },
      { componente_id: queso, cantidad: 2 },
    ])

    const res = await send('ventas:create', baseVenta({
      total: 12,
      monto_pagado: 12,
      detalles: [{ producto_id: combo, cantidad: 3, precio_unitario: 12, descuento: 0, subtotal: 36 }],
    }))
    expect(res.success).toBe(true)

    const h: any = db.prepare('SELECT stock FROM productos WHERE id = ?').get(harina)
    const q: any = db.prepare('SELECT stock FROM productos WHERE id = ?').get(queso)
    const c: any = db.prepare('SELECT stock FROM productos WHERE id = ?').get(combo)
    expect(h.stock).toBe(97) // 100 - 3×1
    expect(q.stock).toBe(4) // 10 - 3×2
    expect(c.stock).toBe(50) // el combo no descontó su propio stock (default crearProducto)

    const lineas = db.prepare('SELECT * FROM venta_detalle_componentes').all() as any[]
    expect(lineas).toHaveLength(2)
    expect(lineas.map((l: any) => l.cantidad).sort()).toEqual([3, 6])
  })

  it('rechaza la venta si algún componente no tiene stock suficiente', async () => {
    limpiar()
    const harina = crearProducto({ nombre: 'Harina', stock: 100 })
    const queso = crearProducto({ nombre: 'Queso', stock: 1 })
    const combo = crearProducto({ nombre: 'Arepa', stock: 0 })
    await guardarCombo(combo, [
      { componente_id: harina, cantidad: 1 },
      { componente_id: queso, cantidad: 2 },
    ])

    const res = await send('ventas:create', baseVenta({
      detalles: [{ producto_id: combo, cantidad: 1, precio_unitario: 12, descuento: 0, subtotal: 12 }],
    }))
    expect(res.success).toBe(false)
    expect(res.error).toContain('Queso')
  })

  it('anular una venta con combo restaura el stock de los componentes', async () => {
    limpiar()
    const harina = crearProducto({ nombre: 'Harina', stock: 100 })
    const queso = crearProducto({ nombre: 'Queso', stock: 10 })
    const combo = crearProducto({ nombre: 'Arepa', stock: 0 })
    await guardarCombo(combo, [
      { componente_id: harina, cantidad: 1 },
      { componente_id: queso, cantidad: 2 },
    ])

    const venta = await send('ventas:create', baseVenta({
      detalles: [{ producto_id: combo, cantidad: 2, precio_unitario: 12, descuento: 0, subtotal: 24 }],
    }))
    expect(venta.success).toBe(true)

    const anulada = await send('ventas:anular', { usuario_id: 1, id: venta.id, motivo: 'prueba' })
    expect(anulada.success).toBe(true)

    const h: any = db.prepare('SELECT stock FROM productos WHERE id = ?').get(harina)
    const q: any = db.prepare('SELECT stock FROM productos WHERE id = ?').get(queso)
    expect(h.stock).toBe(100)
    expect(q.stock).toBe(10)
  })

  it('expone el desglose de componentes en ventas:getById', async () => {
    limpiar()
    const harina = crearProducto({ nombre: 'Harina', stock: 100 })
    const queso = crearProducto({ nombre: 'Queso', stock: 10 })
    const combo = crearProducto({ nombre: 'Arepa', stock: 0 })
    await guardarCombo(combo, [
      { componente_id: harina, cantidad: 1 },
      { componente_id: queso, cantidad: 2 },
    ])

    const venta = await send('ventas:create', baseVenta({
      detalles: [{ producto_id: combo, cantidad: 1, precio_unitario: 12, descuento: 0, subtotal: 12 }],
    }))
    const detalle = await send('ventas:getById', { usuario_id: 1, id: venta.id })
    const linea = detalle.detalles.find((d: any) => d.producto_id === combo)
    expect(linea).toBeTruthy()
    expect(linea.componentes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ componente_id: harina, cantidad: 1, nombre: 'Harina' }),
        expect.objectContaining({ componente_id: queso, cantidad: 2, nombre: 'Queso' }),
      ]),
    )
  })
})
