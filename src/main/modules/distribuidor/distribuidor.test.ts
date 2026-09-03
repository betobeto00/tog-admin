import { describe, it, expect, vi, beforeEach } from 'vitest'

// Estado compartido + DB en memoria (vi.hoisted corre antes que los mocks).
// Mejor-sqlite3 está compilado para el Node de Electron; en vitest (Node del
// sistema) usamos node:sqlite detrás de un adaptador con la misma API
// (prepare/get/all/run + transaction).
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
      return stmts.get(sql)
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
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      precio_venta REAL NOT NULL DEFAULT 0,
      stock REAL NOT NULL DEFAULT 0,
      unidad TEXT NOT NULL DEFAULT 'unidad',
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE pedidos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero TEXT NOT NULL UNIQUE,
      cliente_id INTEGER NOT NULL,
      fecha TEXT NOT NULL DEFAULT (datetime('now')),
      estado TEXT NOT NULL DEFAULT 'pendiente',
      subtotal REAL NOT NULL DEFAULT 0,
      impuesto REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notas TEXT
    );
    CREATE TABLE pedido_detalles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      pedido_id INTEGER NOT NULL,
      producto_id INTEGER NOT NULL,
      cantidad REAL NOT NULL,
      precio REAL NOT NULL,
      subtotal REAL NOT NULL
    );
    CREATE TABLE configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT
    );
  `)
  db.prepare("INSERT INTO productos (nombre, precio_venta, stock, unidad) VALUES ('Caja de Maíz', 50, 100, 'cj')").run()
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'distribuidor'] as string[] }
  return { db, handles, state }
})

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: any) => { handles[channel] = fn } },
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

import { registerClientesHandlers } from './clientes'
import { registerPedidosHandlers } from './pedidos'

registerClientesHandlers()
registerPedidosHandlers()

const list = (ch: string) => handles[ch](null, { usuario_id: 1 })
const send = (ch: string, data: any) => handles[ch](null, data)

describe('clientes (Distribuidor)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM clientes').run()
  })

  it('lista clientes activos ordenados por nombre', async () => {
    db.prepare("INSERT INTO clientes (nombre, documento) VALUES ('B', 'J-1'), ('A', 'J-2')").run()
    const rows: any[] = await list('clientes:list')
    expect(rows.map((r) => r.nombre)).toEqual(['A', 'B'])
  })

  it('crea un cliente con documento internacional y lo persiste', async () => {
    const res = await send('clientes:create', {
      usuario_id: 1,
      nombre: 'Distribuidora Los Andes',
      documento: 'RFC-XYZ010203ABC',
      email: 'ventas@andes.com',
      limite_credito: 500,
    })
    expect(res.id).toBeGreaterThan(0)
    const row: any = db.prepare('SELECT * FROM clientes WHERE id = ?').get(res.id)
    expect(row.nombre).toBe('Distribuidora Los Andes')
    expect(row.documento).toBe('RFC-XYZ010203ABC')
    expect(row.limite_credito).toBe(500)
  })

  it('rechaza crear cliente sin nombre (validación zod)', async () => {
    const res = await send('clientes:create', { usuario_id: 1, nombre: '' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('Nombre')
  })

  it('rechaza email inválido', async () => {
    const res = await send('clientes:create', { usuario_id: 1, nombre: 'X', email: 'no-es-mail' })
    expect(res.success).toBe(false)
  })

  it('actualiza sin pisar campos con undefined', async () => {
    const created = await send('clientes:create', { usuario_id: 1, nombre: 'Original', documento: 'J-1' })
    const res = await send('clientes:update', {
      usuario_id: 1,
      id: created.id,
      data: { nombre: 'Renombrado', documento: undefined, telefono: undefined },
    })
    expect(res.success).toBe(true)
    const row: any = db.prepare('SELECT * FROM clientes WHERE id = ?').get(created.id)
    expect(row.nombre).toBe('Renombrado')
    expect(row.documento).toBe('J-1') // no fue pisado por undefined
  })

  it('elimina con borrado lógico (activo = 0)', async () => {
    const created = await send('clientes:create', { usuario_id: 1, nombre: 'A Eliminar' })
    await send('clientes:delete', { usuario_id: 1, id: created.id })
    const rows: any[] = await list('clientes:list')
    expect(rows).toHaveLength(0)
    const raw: any = db.prepare('SELECT activo FROM clientes WHERE id = ?').get(created.id)
    expect(raw.activo).toBe(0)
  })

  it('bloquea las operaciones si el módulo no está activo en la licencia', async () => {
    state.active = ['comercializador']
    const res = await send('clientes:create', { usuario_id: 1, nombre: 'X' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'distribuidor']
  })

  it('exige usuario autenticado (checkPermissionOrFail)', async () => {
    const res = await handles['clientes:list'](null, {})
    expect(res.success).toBe(false)
  })
})

describe('pedidos (Distribuidor)', () => {
  beforeEach(() => {
    db.prepare('DELETE FROM pedido_detalles').run()
    db.prepare('DELETE FROM pedidos').run()
    db.prepare("DELETE FROM configuracion WHERE clave = 'pedido_numero'").run()
    db.prepare('DELETE FROM clientes').run()
  })

  const crearClienteYProducto = () => {
    const cliente: any = db.prepare("INSERT INTO clientes (nombre) VALUES ('Cliente A')").run()
    const producto: any = db.prepare('SELECT * FROM productos LIMIT 1').get()
    return { clienteId: cliente.lastInsertRowid, producto }
  }

  it('devuelve el catálogo de productos del Core', async () => {
    const rows: any[] = await list('pedidos:catalogo')
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0]).toHaveProperty('precio_venta')
  })

  it('crea un pedido con numeración secuencial y total calculado', async () => {
    const { clienteId, producto } = crearClienteYProducto()
    const res = await send('pedidos:create', {
      usuario_id: 1,
      cliente_id: clienteId,
      items: [
        { producto_id: producto.id, cantidad: 2, precio: 50 },
        { producto_id: producto.id, cantidad: 1, precio: 25 },
      ],
    })
    expect(res.success).toBe(true)
    expect(res.numero).toBe(1)
    expect(res.total).toBe(125)

    const segundo = await send('pedidos:create', {
      usuario_id: 1,
      cliente_id: clienteId,
      items: [{ producto_id: producto.id, cantidad: 1, precio: 10 }],
    })
    expect(segundo.numero).toBe(2)

    const detalle: any = db.prepare('SELECT COUNT(*) AS n FROM pedido_detalles').get()
    expect(detalle.n).toBe(3)
  })

  it('rechaza pedido sin productos o sin cliente', async () => {
    const sinItems = await send('pedidos:create', { usuario_id: 1, cliente_id: 1, items: [] })
    expect(sinItems.success).toBe(false)

    const sinCliente = await send('pedidos:create', { usuario_id: 1, items: [{ producto_id: 1, cantidad: 1, precio: 5 }] })
    expect(sinCliente.success).toBe(false)
  })

  it('lista pedidos con nombre del cliente y cantidad de renglones', async () => {
    const { clienteId, producto } = crearClienteYProducto()
    db.prepare("UPDATE clientes SET nombre = 'Cliente A' WHERE id = ?").run(clienteId)
    await send('pedidos:create', {
      usuario_id: 1,
      cliente_id: clienteId,
      notas: 'Urgente',
      items: [{ producto_id: producto.id, cantidad: 3, precio: 50 }],
    })
    const rows: any[] = await list('pedidos:list')
    expect(rows).toHaveLength(1)
    expect(rows[0].cliente_nombre).toBe('Cliente A')
    expect(rows[0].lineas).toBe(1)
    expect(rows[0].estado).toBe('pendiente')
    expect(rows[0].total).toBe(150)
  })

  it('valida las transiciones de estado', async () => {
    const { clienteId, producto } = crearClienteYProducto()
    const pedido: any = await send('pedidos:create', {
      usuario_id: 1,
      cliente_id: clienteId,
      items: [{ producto_id: producto.id, cantidad: 1, precio: 10 }],
    })

    const despachado = await send('pedidos:update', { usuario_id: 1, id: pedido.id, estado: 'despachado' })
    expect(despachado.success).toBe(true)

    const entregado = await send('pedidos:update', { usuario_id: 1, id: pedido.id, estado: 'entregado' })
    expect(entregado.success).toBe(true)

    // un pedido entregado no puede volver a despachado
    const regreso = await send('pedidos:update', { usuario_id: 1, id: pedido.id, estado: 'despachado' })
    expect(regreso.success).toBe(false)
    expect(regreso.error).toContain('No se puede pasar')

    const invalido = await send('pedidos:update', { usuario_id: 1, id: pedido.id, estado: 'nave-espacial' })
    expect(invalido.success).toBe(false)
  })

  it('anula un pedido pendiente y actualiza notas', async () => {
    const { clienteId, producto } = crearClienteYProducto()
    const pedido: any = await send('pedidos:create', {
      usuario_id: 1,
      cliente_id: clienteId,
      items: [{ producto_id: producto.id, cantidad: 1, precio: 10 }],
    })
    await send('pedidos:update', { usuario_id: 1, id: pedido.id, notas: 'Nota nueva' })
    const anulado = await send('pedidos:update', { usuario_id: 1, id: pedido.id, estado: 'anulado' })
    expect(anulado.success).toBe(true)
    const row: any = db.prepare('SELECT * FROM pedidos WHERE id = ?').get(pedido.id)
    expect(row.estado).toBe('anulado')
    expect(row.notas).toBe('Nota nueva')
    // anulado no puede reactivarse
    const revivir = await send('pedidos:update', { usuario_id: 1, id: pedido.id, estado: 'pendiente' })
    expect(revivir.success).toBe(false)
  })

  it('bloquea pedidos si el módulo no está activo', async () => {
    state.active = ['comercializador']
    const res = await send('pedidos:catalogo', { usuario_id: 1 })
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'distribuidor']
  })
})
