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
    CREATE TABLE cultivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      variedad TEXT,
      unidad TEXT NOT NULL DEFAULT 'kg',
      notas TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE siembras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cultivo_id INTEGER NOT NULL REFERENCES cultivos(id),
      descripcion TEXT,
      fecha_siembra TEXT NOT NULL DEFAULT (date('now')),
      area REAL NOT NULL DEFAULT 0,
      unidad_area TEXT NOT NULL DEFAULT 'ha',
      cantidad_sembrada REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'activa',
      fecha_cosecha TEXT,
      cantidad_cosechada REAL NOT NULL DEFAULT 0,
      notas TEXT,
      usuario_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE costos_campo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      siembra_id INTEGER NOT NULL REFERENCES siembras(id),
      fecha TEXT NOT NULL DEFAULT (date('now')),
      concepto TEXT NOT NULL,
      monto REAL NOT NULL DEFAULT 0,
      notas TEXT,
      usuario_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'productor'] as string[] }
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

import { registerProductorHandlers } from './handlers'

registerProductorHandlers()

const call = (channel: string, data: any = {}) => handles[channel](null, { usuario_id: 1, ...data })

beforeEach(() => {
  db.prepare('DELETE FROM costos_campo').run()
  db.prepare('DELETE FROM siembras').run()
  db.prepare('DELETE FROM cultivos').run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('cultivos','siembras','costos_campo')").run()
})

describe('Productor: cultivos', () => {
  it('crea y lista cultivos', async () => {
    const created = await call('productor:cultivo-create', { nombre: 'Maíz', variedad: 'Blanco', unidad: 'kg' })
    expect(created.id).toBeTruthy()
    const list = await call('productor:cultivos-list') as any[]
    expect(list).toHaveLength(1)
    expect(list[0].nombre).toBe('Maíz')
  })

  it('rechaza cultivo sin nombre', async () => {
    const res = await call('productor:cultivo-create', { nombre: '  ' })
    expect(res.success).toBe(false)
  })

  it('actualiza y desactiva cultivo', async () => {
    const created = await call('productor:cultivo-create', { nombre: 'Arroz' })
    await call('productor:cultivo-update', { id: created.id, data: { nombre: 'Arroz blanco', activo: 0 } })
    const activos = await call('productor:cultivos-list') as any[]
    expect(activos).toHaveLength(0)
    const todos = await call('productor:cultivos-list', { incluirInactivos: true }) as any[]
    expect(todos).toHaveLength(1)
    expect(todos[0].nombre).toBe('Arroz blanco')
  })
})

describe('Productor: siembras', () => {
  it('crea siembra asociada a cultivo activo', async () => {
    const cultivo = await call('productor:cultivo-create', { nombre: 'Maíz' })
    const siembra = await call('productor:siembra-create', {
      cultivo_id: cultivo.id, descripcion: 'Lote 3', area: 2.5, cantidad_sembrada: 100,
    })
    expect(siembra.id).toBeTruthy()

    const list = await call('productor:siembras-list') as any[]
    expect(list).toHaveLength(1)
    expect(list[0].cultivo_nombre).toBe('Maíz')
    expect(list[0].estado).toBe('activa')
  })

  it('rechaza siembra con cultivo inexistente', async () => {
    const res = await call('productor:siembra-create', { cultivo_id: 999 })
    expect(res.success).toBe(false)
  })

  it('filtra siembras por estado', async () => {
    const cultivo = await call('productor:cultivo-create', { nombre: 'Maíz' })
    await call('productor:siembra-create', { cultivo_id: cultivo.id, descripcion: 'A' })
    await call('productor:siembra-create', { cultivo_id: cultivo.id, descripcion: 'B' })
    await call('productor:siembra-cosechar', { id: 1, cantidad_cosechada: 50 })

    const activas = await call('productor:siembras-list', { estado: 'activa' }) as any[]
    expect(activas).toHaveLength(1)
    expect(activas[0].descripcion).toBe('B')
  })
})

describe('Productor: costos y cosecha', () => {
  it('registra costos y los acumula en el listado de siembras', async () => {
    const cultivo = await call('productor:cultivo-create', { nombre: 'Maíz' })
    await call('productor:siembra-create', { cultivo_id: cultivo.id, descripcion: 'Lote 1' })
    await call('productor:costo-create', { siembra_id: 1, concepto: 'Semilla', monto: 200 })
    await call('productor:costo-create', { siembra_id: 1, concepto: 'Riego', monto: 100.5 })

    const list = await call('productor:siembras-list') as any[]
    expect(list[0].costos_total).toBeCloseTo(300.5, 5)
    expect(list[0].costos_cantidad).toBe(2)

    const costos = await call('productor:costos-list', { siembra_id: 1 }) as any[]
    expect(costos).toHaveLength(2)
    expect(costos[0].cultivo_nombre).toBe('Maíz')
  })

  it('rechaza costo con monto inválido o siembra inexistente', async () => {
    const sinMonto = await call('productor:costo-create', { siembra_id: 1, concepto: 'X', monto: 0 })
    expect(sinMonto.success).toBe(false)
    const sinSiembra = await call('productor:costo-create', { siembra_id: 99, concepto: 'X', monto: 10 })
    expect(sinSiembra.success).toBe(false)
  })

  it('cosecha calcula el costo unitario real y no permite doble cosecha', async () => {
    const cultivo = await call('productor:cultivo-create', { nombre: 'Maíz' })
    await call('productor:siembra-create', { cultivo_id: cultivo.id, descripcion: 'Lote 1' })
    await call('productor:costo-create', { siembra_id: 1, concepto: 'Semilla', monto: 300 })
    await call('productor:costo-create', { siembra_id: 1, concepto: 'Cosecha', monto: 100 })

    const res = await call('productor:siembra-cosechar', { id: 1, cantidad_cosechada: 200 })
    expect(res.success).toBe(true)
    expect(res.costo_unitario).toBe(2) // 400 / 200
    expect(res.cultivo).toBe('Maíz')

    const doble = await call('productor:siembra-cosechar', { id: 1, cantidad_cosechada: 10 })
    expect(doble.success).toBe(false)
  })

  it('rechaza cosecha con cantidad inválida', async () => {
    const cultivo = await call('productor:cultivo-create', { nombre: 'Maíz' })
    await call('productor:siembra-create', { cultivo_id: cultivo.id })
    const res = await call('productor:siembra-cosechar', { id: 1, cantidad_cosechada: 0 })
    expect(res.success).toBe(false)
  })
})

describe('Productor: gating y permisos', () => {
  it('bloquea los handlers si el módulo no está en la licencia', async () => {
    state.active = ['comercializador']
    const res = await call('productor:cultivos-list')
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'productor']
  })

  it('bloquea sin permisos (sin usuario_id)', async () => {
    const res = await handles['productor:cultivos-list'](null, {})
    expect(res.success).toBe(false)
  })
})
