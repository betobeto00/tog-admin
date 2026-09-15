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

  /*
   * Escenario: Cadena encadenada
   *
   * Cadena A: "Cortar alambre" → producto intermedio "Alambre cortado"
   *   Pasos: Alambre galvanizado (0.50/m) × 1m
   *   Tiempo: 2 min, Mano de obra: $6/hr, Overhead: 5%
   *   Costo materiales: 0.50
   *   Mano de obra: (2/60)*6 = 0.20
   *   Overhead: 0.50 * 0.05 = 0.025
   *   Total: 0.725 → rounded to 0.73
   *
   * Cadena B: "Armar llavero" → producto final "Llavero"
   *   Pasos: Alambre cortado × 2 (intermedio, resuelve por cadena A ≈ 0.73/u)
   *          Cadena metal × 1 (base, $0.20/u)
   *   Costo materiales: (0.73 * 2) + (0.20 * 1) = 1.66
   *   Mano de obra: (3/60) * 6 = 0.30
   *   Overhead: 1.66 * 0.10 = 0.166
   *   Total: 2.126 → 2.13
   */

  // Materia prima
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (1, 'Alambre galvanizado', 0.50, 200, 'base')")
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (2, 'Cadena metal', 0.20, 100, 'base')")
  // Intermedio (producido por cadena A, insumo de cadena B)
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (5, 'Alambre cortado', 0, 0, 'intermedio')")
  // Final
  db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (10, 'Llavero', 0, 0, 'final')")

  // Cadena A: Alambre galvanizado → Alambre cortado
  db.exec("INSERT INTO cadena_produccion (id, producto_final_id, nombre, tiempo_estimado_minutos, costo_mano_obra_hora, overhead_porcentaje) VALUES (1, 5, 'Cortar alambre', 2, 6, 5)")
  db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad) VALUES (1, 1, 1, 1, 'm')")

  // Cadena B: Alambre cortado + Cadena → Llavero
  db.exec("INSERT INTO cadena_produccion (id, producto_final_id, nombre, tiempo_estimado_minutos, costo_mano_obra_hora, overhead_porcentaje) VALUES (2, 10, 'Armar llavero', 3, 6, 10)")
  db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad) VALUES (2, 1, 5, 2, 'ud')")
  db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad) VALUES (2, 2, 2, 1, 'ud')")

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
  getActiveModules: () => ['productor'],
}))
vi.mock('../../services/logger', () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {}, debug: () => {} },
}))
vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: () => null,
}))

import { registerCadenaHandlers } from './cadena'
import { registerLoteHandlers } from './lote'

registerCadenaHandlers()
registerLoteHandlers()

async function call(channel: string, data?: any) {
  return await handles[channel](null, data)
}

describe('Cadenas encadenadas (intermedio → cadena → producto final)', () => {
  beforeEach(() => {
    db.exec('DELETE FROM produccion_lote_detalle')
    db.exec('DELETE FROM produccion_lote')
    db.exec('DELETE FROM cadena_paso')
    db.exec('DELETE FROM cadena_produccion')
    // Recreate chains with explicit IDs
    db.exec("INSERT INTO cadena_produccion (id, producto_final_id, nombre, tiempo_estimado_minutos, costo_mano_obra_hora, overhead_porcentaje) VALUES (1, 5, 'Cortar alambre', 2, 6, 5)")
    db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad) VALUES (1, 1, 1, 1, 'm')")
    db.exec("INSERT INTO cadena_produccion (id, producto_final_id, nombre, tiempo_estimado_minutos, costo_mano_obra_hora, overhead_porcentaje) VALUES (2, 10, 'Armar llavero', 3, 6, 10)")
    db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad) VALUES (2, 1, 5, 2, 'ud')")
    db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad) VALUES (2, 2, 2, 1, 'ud')")
    // Restore stocks
    db.exec("UPDATE productos SET stock = 200 WHERE id = 1")
    db.exec("UPDATE productos SET stock = 100 WHERE id = 2")
    db.exec("UPDATE productos SET stock = 0 WHERE id = 5")
    db.exec("UPDATE productos SET stock = 0 WHERE id = 10")
  })

  it('cadena A calcula costo correctamente (materia prima)', async () => {
    const detail = await call('productor:cadena-detail', { id: 1, usuario_id: 1 })
    expect(detail.pasos.length).toBe(1)
    // Alambre: 0.50 * 1m = 0.50
    expect(detail.resumen.costo_materiales).toBe(0.50)
    // Mano de obra: (2/60) * 6 = 0.20
    expect(detail.resumen.costo_mano_obra).toBe(0.20)
    // Overhead: 0.50 * 0.05 = 0.025 → rounded to 0.03
    expect(detail.resumen.costo_overhead).toBe(0.03)
    // Total: 0.50 + 0.20 + 0.03 = 0.73
    expect(detail.resumen.costo_total).toBe(0.73)
  })

  it('cadena B resuelve costo del intermedio por cadena A', async () => {
    const detail = await call('productor:cadena-detail', { id: 2, usuario_id: 1 })
    expect(detail.pasos.length).toBe(2)

    // Paso 1: Alambre cortado × 2 (resuelve por cadena A = 0.73/u)
    const paso1 = detail.pasos.find((p: any) => p.producto_base_id === 5)
    expect(paso1).toBeDefined()
    expect(paso1.es_cadena_encadenada).toBe(true)
    expect(paso1.cadena_origen_id).toBe(1)
    // Costo unitario = 0.73 (rounded cost from chain A)
    expect(paso1.costo_unitario_calculado).toBe(0.73)
    // Costo línea: 0.73 * 2 = 1.46
    expect(paso1.costo_total_linea).toBe(1.46)

    // Paso 2: Cadena metal × 1 (base, $0.20)
    const paso2 = detail.pasos.find((p: any) => p.producto_base_id === 2)
    expect(paso2).toBeDefined()
    expect(paso2.es_cadena_encadenada).toBeFalsy()
    expect(paso2.costo_unitario_calculado).toBe(0.20)
    expect(paso2.costo_total_linea).toBe(0.20)

    // Total materiales: 1.46 + 0.20 = 1.66
    expect(detail.resumen.costo_materiales).toBe(1.66)
  })

  it('override tiene prioridad sobre cadena encadenada', async () => {
    await call('productor:cadena-paso-add', {
      cadena_id: 2, producto_base_id: 5, cantidad: 1, unidad: 'ud',
      costo_unitario_override: 0.50, usuario_id: 1,
    })
    const detail = await call('productor:cadena-detail', { id: 2, usuario_id: 1 })
    const overrideStep = detail.pasos.find((p: any) => p.costo_unitario_override === 0.50)
    expect(overrideStep).toBeDefined()
    expect(overrideStep.costo_unitario_calculado).toBe(0.50)
    expect(overrideStep.es_cadena_encadenada).toBeFalsy()
  })

  it('lote de cadena encadenada: produce intermedio primero, luego final', async () => {
    // Step 1: Produce 20 alambres cortados via chain A
    const loteA = await call('productor:lote-create', { cadena_id: 1, cantidad_producida: 20, usuario_id: 1 })
    expect(loteA.id).toBeDefined()

    // Complete chain A → adds 20 alambre cortado to inventory
    await call('productor:lote-completar', { id: loteA.id, usuario_id: 1 })
    const stockIntermedio = db.prepare('SELECT stock FROM productos WHERE id = 5').get() as any
    expect(stockIntermedio.stock).toBe(20)

    // Step 2: Now produce 5 llaveros via chain B (needs 2 alambre cortado each = 10)
    const loteB = await call('productor:lote-create', { cadena_id: 2, cantidad_producida: 5, usuario_id: 1 })
    expect(loteB.id).toBeDefined()
    expect(loteB.costo_total).toBeGreaterThan(0)

    // Alambre cortado: 20 - (2 * 5) = 10
    const stockDespues = db.prepare('SELECT stock FROM productos WHERE id = 5').get() as any
    expect(stockDespues.stock).toBe(10)

    // Cadena metal: 100 - (1 * 5) = 95
    const stockCadena = db.prepare('SELECT stock FROM productos WHERE id = 2').get() as any
    expect(stockCadena.stock).toBe(95)
  })

  it('precio recomendado de cadena encadenada', async () => {
    const precio = await call('productor:precio-recomendado', { producto_id: 10, margen_porcentaje: 100, usuario_id: 1 })
    expect(precio.costo_total).toBeGreaterThan(0)
    expect(precio.precio_recomendado).toBe(precio.costo_total * 2)
  })

  it('no hay recursión infinita con cadenas circulares', async () => {
    db.exec("INSERT INTO productos (id, nombre, precio_compra, stock, tipo_produccion) VALUES (99, 'Ciclico', 0, 0, 'intermedio')")
    db.exec("INSERT INTO cadena_produccion (id, producto_final_id, nombre) VALUES (99, 99, 'Cadena circular')")
    db.exec("INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad) VALUES (99, 1, 99, 1)")
    // Should not throw or hang
    const detail = await call('productor:cadena-detail', { id: 99, usuario_id: 1 })
    expect(detail).toBeDefined()
    expect(detail.resumen.costo_materiales).toBe(0) // Falls back to precio_compra=0
  })
})
