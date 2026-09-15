import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db, handles } = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  const stmts = new Map()
  const db = {
    exec(sql: string) { return raw.exec(sql) },
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
        try { const r = fn(...args); raw.exec('COMMIT'); return r }
        catch (e) { try { raw.exec('ROLLBACK') } catch {} throw e }
      }
    },
  }

  db.exec(`
    CREATE TABLE usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL UNIQUE,
      contrasena TEXT NOT NULL, nombre TEXT NOT NULL, rol TEXT NOT NULL DEFAULT 'cajero',
      activo INTEGER NOT NULL DEFAULT 1, debe_cambiar_contrasena INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')), actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE productos (
      id INTEGER PRIMARY KEY AUTOINCREMENT, codigo_barras TEXT, sku TEXT, nombre TEXT NOT NULL,
      descripcion TEXT, categoria_id INTEGER, precio_compra REAL NOT NULL DEFAULT 0,
      precio_venta REAL NOT NULL DEFAULT 0, stock INTEGER NOT NULL DEFAULT 0,
      stock_minimo INTEGER NOT NULL DEFAULT 5, unidad TEXT NOT NULL DEFAULT 'unidad',
      imagen TEXT, activo INTEGER NOT NULL DEFAULT 1, tipo TEXT NOT NULL DEFAULT 'producto',
      tipo_produccion TEXT DEFAULT NULL,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')), actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cadena_produccion (
      id INTEGER PRIMARY KEY AUTOINCREMENT, producto_final_id INTEGER NOT NULL,
      nombre TEXT NOT NULL, descripcion TEXT, tiempo_estimado_minutos REAL NOT NULL DEFAULT 0,
      costo_mano_obra_hora REAL NOT NULL DEFAULT 0, overhead_porcentaje REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')), actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE cadena_paso (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cadena_id INTEGER NOT NULL,
      orden INTEGER NOT NULL DEFAULT 1, producto_base_id INTEGER NOT NULL,
      cantidad REAL NOT NULL DEFAULT 1, unidad TEXT NOT NULL DEFAULT 'unidad',
      costo_unitario_override REAL, notas TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE produccion_lote (
      id INTEGER PRIMARY KEY AUTOINCREMENT, cadena_id INTEGER NOT NULL,
      producto_final_id INTEGER NOT NULL,
      cantidad_producida REAL NOT NULL DEFAULT 1, costo_materiales REAL NOT NULL DEFAULT 0,
      costo_mano_obra REAL NOT NULL DEFAULT 0, costo_overhead REAL NOT NULL DEFAULT 0,
      costo_total REAL NOT NULL DEFAULT 0, costo_unitario REAL NOT NULL DEFAULT 0,
      fecha_inicio TEXT NOT NULL DEFAULT (datetime('now')), fecha_fin TEXT,
      estado TEXT NOT NULL DEFAULT 'en_proceso', notas TEXT, usuario_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE produccion_lote_detalle (
      id INTEGER PRIMARY KEY AUTOINCREMENT, lote_id INTEGER NOT NULL,
      producto_base_id INTEGER NOT NULL,
      cantidad_consumida REAL NOT NULL DEFAULT 0, costo_unitario REAL NOT NULL DEFAULT 0,
      costo_total REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE configuracion (clave TEXT PRIMARY KEY, valor TEXT NOT NULL, descripcion TEXT);
  `)

  // Seed products
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (1, 'Alambre', 0.50, 100, 'base')")
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (2, 'Cadena', 0.20, 50, 'base')")
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (3, 'Bano', 0.30, 30, 'base')")
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (10, 'Llavero', 0, 0, 'final')")

  return { db, handles: {} as Record<string, Function> }
})

vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, fn: any) => { handles[channel] = fn } },
}))

vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (channel: string, fn: any) => { handles[channel] = fn },
}))

vi.mock('../../db/database', () => ({ getDatabase: () => db }))
vi.mock('../../services/license', () => ({
  getActiveModules: () => ['productor', 'distribuidor', 'restaurant'],
}))
vi.mock('../../services/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}))
vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: () => null,
}))

// Import AFTER mocks
import { registerCadenaHandlers } from './cadena'
import { registerLoteHandlers } from './lote'

registerCadenaHandlers()
registerLoteHandlers()

async function call(channel: string, data?: any) {
  return await handles[channel](null, data)
}

describe('Cadena + Lotes de Producción', () => {
  // Clean slate between tests — prevent cross-test chain accumulation
  beforeEach(() => {
    db.exec('DELETE FROM produccion_lote_detalle')
    db.exec('DELETE FROM produccion_lote')
    db.exec('DELETE FROM cadena_paso')
    db.exec('DELETE FROM cadena_produccion')
    // Restore product stocks
    db.exec("UPDATE productos SET stock = 100 WHERE id = 1")
    db.exec("UPDATE productos SET stock = 50 WHERE id = 2")
    db.exec("UPDATE productos SET stock = 30 WHERE id = 3")
    db.exec("UPDATE productos SET stock = 0 WHERE id = 10")
  })

  async function crearCadenaConPasos() {
    const c = await call('productor:cadena-create', {
      producto_final_id: 10, nombre: 'Llavero', tiempo_estimado_minutos: 5,
      costo_mano_obra_hora: 3.00, overhead_porcentaje: 10, usuario_id: 1,
    })
    await call('productor:cadena-paso-add', { cadena_id: c.id, producto_base_id: 1, cantidad: 0.40, unidad: 'm', usuario_id: 1 })
    await call('productor:cadena-paso-add', { cadena_id: c.id, producto_base_id: 2, cantidad: 1, usuario_id: 1 })
    await call('productor:cadena-paso-add', { cadena_id: c.id, producto_base_id: 3, cantidad: 1, usuario_id: 1 })
    return c
  }

  it('crear cadena y listar', async () => {
    const c = await call('productor:cadena-create', { producto_final_id: 10, nombre: 'Llavero', usuario_id: 1 })
    expect(c.id).toBeDefined()
    const list = await call('productor:cadena-list', { usuario_id: 1 })
    expect(list.length).toBe(1)
    expect(list[0].nombre).toBe('Llavero')
  })

  it('calcular costos de cadena', async () => {
    const c = await crearCadenaConPasos()
    const detail = await call('productor:cadena-detail', { id: c.id, usuario_id: 1 })
    expect(detail.pasos.length).toBe(3)
    expect(detail.resumen.costo_materiales).toBe(0.70)
    expect(detail.resumen.costo_mano_obra).toBe(0.25)
    expect(detail.resumen.costo_overhead).toBe(0.07)
    expect(detail.resumen.costo_total).toBe(1.02)
  })

  it('precio recomendado 150%', async () => {
    await crearCadenaConPasos()
    const p = await call('productor:precio-recomendado', { producto_id: 10, margen_porcentaje: 150, usuario_id: 1 })
    expect(p.costo_total).toBe(1.02)
    expect(p.precio_recomendado).toBe(2.55)
  })

  it('crear lote descuenta stock', async () => {
    const c = await crearCadenaConPasos()
    const lote = await call('productor:lote-create', { cadena_id: c.id, cantidad_producida: 10, usuario_id: 1 })
    expect(lote.id).toBeDefined()
    expect(lote.costo_total).toBeGreaterThan(0)
    const stock = db.prepare('SELECT stock FROM productos WHERE id = 1').get() as any
    expect(stock.stock).toBe(96)
  })

  it('completar lote agrega stock final', async () => {
    const c = await crearCadenaConPasos()
    const lote = await call('productor:lote-create', { cadena_id: c.id, cantidad_producida: 5, usuario_id: 1 })
    const r = await call('productor:lote-completar', { id: lote.id, usuario_id: 1 })
    expect(r.success).toBe(true)
    const stock = db.prepare('SELECT stock FROM productos WHERE id = 10').get() as any
    expect(stock.stock).toBe(5)
  })

  it('cancelar lote devuelve stock', async () => {
    const c = await crearCadenaConPasos()
    const lote = await call('productor:lote-create', { cadena_id: c.id, cantidad_producida: 10, usuario_id: 1 })
    const antes = (db.prepare('SELECT stock FROM productos WHERE id = 1').get() as any).stock
    await call('productor:lote-cancelar', { id: lote.id, usuario_id: 1 })
    const despues = (db.prepare('SELECT stock FROM productos WHERE id = 1').get() as any).stock
    expect(despues).toBe(antes + 4)
  })

  it('no completar lote ya completado', async () => {
    const c = await crearCadenaConPasos()
    const lote = await call('productor:lote-create', { cadena_id: c.id, cantidad_producida: 5, usuario_id: 1 })
    await call('productor:lote-completar', { id: lote.id, usuario_id: 1 })
    const r = await call('productor:lote-completar', { id: lote.id, usuario_id: 1 })
    expect(r.success).toBe(false)
    expect(r.error).toContain('completado')
  })

  it('estructura de costos', async () => {
    await crearCadenaConPasos()
    const e = await call('productor:costo-estructura', { producto_id: 10, usuario_id: 1 })
    expect(e.costo_materiales).toBe(0.70)
    expect(e.costo_mano_obra).toBe(0.25)
    expect(e.costo_overhead).toBe(0.07)
    expect(e.costo_total).toBe(1.02)
    expect(e.pasos.length).toBe(3)
  })

  it('editar y eliminar cadena', async () => {
    const c = await call('productor:cadena-create', { producto_final_id: 10, nombre: 'Original', usuario_id: 1 })
    await call('productor:cadena-update', { id: c.id, data: { nombre: 'Nueva' }, usuario_id: 1 })
    // Verify by detail, not list order
    const detail = await call('productor:cadena-detail', { id: c.id, usuario_id: 1 })
    expect(detail.cadena.nombre).toBe('Nueva')
    await call('productor:cadena-delete', { id: c.id, usuario_id: 1 })
    const list = await call('productor:cadena-list', { usuario_id: 1 })
    expect(list.length).toBe(0)
  })
})
