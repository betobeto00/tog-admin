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
    CREATE TABLE empleados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      documento TEXT,
      cargo TEXT,
      salario_mensual REAL NOT NULL DEFAULT 0,
      telefono TEXT,
      direccion TEXT,
      fecha_ingreso TEXT NOT NULL DEFAULT (date('now')),
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE asistencia (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      fecha TEXT NOT NULL,
      estado TEXT NOT NULL DEFAULT 'presente',
      notas TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(empleado_id, fecha)
    );
    CREATE TABLE nominas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      empleado_id INTEGER NOT NULL REFERENCES empleados(id),
      periodo_inicio TEXT NOT NULL,
      periodo_fin TEXT NOT NULL,
      salario_base REAL NOT NULL DEFAULT 0,
      dias_trabajados INTEGER NOT NULL DEFAULT 0,
      bonos REAL NOT NULL DEFAULT 0,
      deducciones REAL NOT NULL DEFAULT 0,
      total_pagar REAL NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      pagado_en TEXT,
      usuario_id INTEGER,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(empleado_id, periodo_inicio, periodo_fin)
    );
  `)
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const state = { active: ['comercializador', 'rrhh'] as string[] }
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

import { registerRrhhHandlers } from './handlers'

registerRrhhHandlers()

const call = (channel: string, data: any = {}) => handles[channel](null, { usuario_id: 1, ...data })

beforeEach(() => {
  db.prepare('DELETE FROM nominas').run()
  db.prepare('DELETE FROM asistencia').run()
  db.prepare('DELETE FROM empleados').run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('empleados')").run()
})

describe('RRHH: empleados', () => {
  it('crea, lista, actualiza y borra empleados', async () => {
    const created = await call('rrhh:empleado-create', {
      nombre: 'Ana Pérez', documento: 'V-12345678', cargo: 'Cajera',
      salario_mensual: 300, telefono: '0414-0000000', fecha_ingreso: '2026-01-15',
    })
    expect(created.id).toBeTruthy()

    let list = await call('rrhh:empleados-list') as any[]
    expect(list).toHaveLength(1)
    expect(list[0].nombre).toBe('Ana Pérez')

    await call('rrhh:empleado-update', { id: created.id, data: { salario_mensual: 350, cargo: 'Cajera Senior' } })
    list = await call('rrhh:empleados-list') as any[]
    expect(list[0].salario_mensual).toBe(350)

    await call('rrhh:empleado-delete', { id: created.id })
    list = await call('rrhh:empleados-list') as any[]
    expect(list).toHaveLength(0)
  })

  it('rechaza crear empleado sin nombre', async () => {
    const res = await call('rrhh:empleado-create', { nombre: '   ' })
    expect(res.success).toBe(false)
  })

  it('desactiva en lugar de borrar si tiene nóminas', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Luis Gómez', salario_mensual: 200 })
    await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' })
    await call('rrhh:empleado-delete', { id: emp.id })

    const all = await call('rrhh:empleados-list', { incluirInactivos: true }) as any[]
    expect(all).toHaveLength(1)
    expect(all[0].activo).toBe(0)
    const activos = await call('rrhh:empleados-list') as any[]
    expect(activos).toHaveLength(0)
  })
})

describe('RRHH: asistencia', () => {
  it('lista empleados activos con su estado del día (null si no marcado)', async () => {
    await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 100 })
    await call('rrhh:empleado-create', { nombre: 'Bo', salario_mensual: 100 })

    const res = await call('rrhh:asistencia-list', { fecha: '2026-09-05' })
    expect(res.fecha).toBe('2026-09-05')
    expect(res.registros).toHaveLength(2)
    expect(res.registros[0].estado).toBeNull()
  })

  it('registra y sobreescribe la asistencia del día (upsert)', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 100 })
    await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: '2026-09-05', estado: 'presente' })
    await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: '2026-09-05', estado: 'tarde' })

    const res = await call('rrhh:asistencia-list', { fecha: '2026-09-05' })
    expect(res.registros[0].estado).toBe('tarde')
    const count = db.prepare('SELECT COUNT(*) as n FROM asistencia').get() as any
    expect(count.n).toBe(1)
  })

  it('rechaza estados de asistencia inválidos', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 100 })
    const res = await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: '2026-09-05', estado: 'volando' })
    expect(res.success).toBe(false)
  })
})

describe('RRHH: nómina', () => {
  it('calcula el pago proporcional a los días presentes/tarde', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 300 })
    for (let d = 1; d <= 20; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }
    await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: '2026-08-21', estado: 'tarde' })
    await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: '2026-08-22', estado: 'ausente' })

    const res = await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' })
    expect(res.success).toBe(true)
    expect(res.nominas).toHaveLength(1)
    expect(res.nominas[0].dias_trabajados).toBe(21)
    expect(res.nominas[0].total_pagar).toBeCloseTo(210, 5)
  })

  it('aplica bonos y deducciones al total', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Bo', salario_mensual: 300 })
    for (let d = 1; d <= 30; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }
    const res = await call('rrhh:nomina-generar', {
      periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31',
      bonos: { [emp.id]: 50 }, deducciones: { [emp.id]: 20 },
    })
    expect(res.nominas[0].total_pagar).toBeCloseTo(330, 5)
  })

  it('paga las nóminas pendientes y permite regenerar sin duplicar', async () => {
    await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 300 })
    await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' })
    let list = await call('rrhh:nomina-list', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' }) as any[]
    expect(list[0].estado).toBe('pendiente')

    await call('rrhh:nomina-pagar', { ids: [list[0].id] })
    list = await call('rrhh:nomina-list', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' }) as any[]
    expect(list[0].estado).toBe('pagada')
    expect(list[0].pagado_en).toBeTruthy()

    await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' })
    list = await call('rrhh:nomina-list', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' }) as any[]
    expect(list).toHaveLength(1)
  })

  it('rechaza períodos inválidos y nóminas sin empleados', async () => {
    const sinEmpleados = await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' })
    expect(sinEmpleados.success).toBe(false)

    await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 100 })
    const invertido = await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-31', periodo_fin: '2026-08-01' })
    expect(invertido.success).toBe(false)
  })
})

describe('RRHH: gating y permisos', () => {
  it('bloquea los handlers si el módulo no está en la licencia', async () => {
    state.active = ['comercializador']
    const res = await call('rrhh:empleados-list')
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'rrhh']
  })

  it('bloquea sin permisos (sin usuario_id)', async () => {
    const res = await handles['rrhh:empleados-list'](null, {})
    expect(res.success).toBe(false)
  })
})
