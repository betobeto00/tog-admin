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
      experiencia TEXT,
      anos_servicio INTEGER NOT NULL DEFAULT 0,
      nivel_academico TEXT,
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
      tipo_pago TEXT,
      salario_base_activo INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(empleado_id, periodo_inicio, periodo_fin)
    );
    CREATE TABLE nomina_conceptos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nomina_id INTEGER NOT NULL REFERENCES nominas(id) ON DELETE CASCADE,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('asignacion', 'deduccion')),
      monto REAL NOT NULL DEFAULT 0,
      orden INTEGER NOT NULL DEFAULT 0,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_nomina_conceptos_nomina ON nomina_conceptos(nomina_id);
    CREATE TABLE conceptos_catalogo (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL CHECK(tipo IN ('asignacion', 'deduccion')),
      monto_default REAL NOT NULL DEFAULT 0,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now')),
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE empleado_grupos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL UNIQUE,
      descripcion TEXT,
      activo INTEGER NOT NULL DEFAULT 1,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE empleado_grupo_miembros (
      grupo_id INTEGER NOT NULL,
      empleado_id INTEGER NOT NULL,
      PRIMARY KEY (grupo_id, empleado_id)
    );
    CREATE TABLE grupo_conceptos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      grupo_id INTEGER NOT NULL,
      concepto_id INTEGER NOT NULL,
      monto REAL NOT NULL DEFAULT 0,
      UNIQUE(grupo_id, concepto_id)
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

import { registerRrhhHandlers } from './handlers'

registerRrhhHandlers()

const call = (channel: string, data: any = {}) => handles[channel](null, { usuario_id: 1, ...data })

beforeEach(() => {
  db.prepare('DELETE FROM nominas').run()
  db.prepare('DELETE FROM asistencia').run()
  db.prepare('DELETE FROM empleados').run()
  db.prepare('DELETE FROM conceptos_catalogo').run()
  db.prepare('DELETE FROM empleado_grupos').run()
  db.prepare('DELETE FROM empleado_grupo_miembros').run()
  db.prepare('DELETE FROM grupo_conceptos').run()
  db.prepare("DELETE FROM sqlite_sequence WHERE name IN ('empleados','conceptos_catalogo','empleado_grupos','grupo_conceptos')").run()
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

    const res = await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31', salario_base_activo: true })
    expect(res.success).toBe(true)
    expect(res.nominas).toHaveLength(1)
    expect(res.nominas[0].dias_trabajados).toBe(21)
    expect(res.nominas[0].total_pagar).toBeCloseTo(210, 5)
  })

  it('aplica el factor de tipo_pago al salario base prorrateado', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Quincenal', salario_mensual: 300 })
    for (let d = 1; d <= 30; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }
    const res = await call('rrhh:nomina-generar', {
      periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31',
      tipo_pago: 'quincenal', salario_base_activo: true,
    })
    expect(res.nominas[0].salario_base).toBeCloseTo(150, 5)
    expect(res.nominas[0].tipo_pago).toBe('quincenal')
    expect(res.nominas[0].salario_base_activo).toBe(1)
  })

  it('deja el salario base en cero cuando salario_base_activo no está activo', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Sin base', salario_mensual: 300 })
    for (let d = 1; d <= 30; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }
    const res = await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' })
    expect(res.nominas[0].salario_base).toBe(0)
    expect(res.nominas[0].total_pagar).toBe(0)
  })

  it('aplica bonos y deducciones globales a todos los empleados', async () => {
    const empUno = await call('rrhh:empleado-create', { nombre: 'Uno', salario_mensual: 300 })
    const empDos = await call('rrhh:empleado-create', { nombre: 'Dos', salario_mensual: 600 })
    for (const emp of [empUno, empDos]) {
      for (let d = 1; d <= 30; d++) {
        await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
      }
    }
    const res = await call('rrhh:nomina-generar', {
      periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31',
      salario_base_activo: true, bonos_globales: 100, deducciones_globales: 25,
    })
    expect(res.nominas).toHaveLength(2)
    const uno = res.nominas.find((n: any) => n.empleado_nombre === 'Uno')
    const dos = res.nominas.find((n: any) => n.empleado_nombre === 'Dos')
    expect(uno.total_pagar).toBeCloseTo(375, 5)
    expect(dos.total_pagar).toBeCloseTo(675, 5)
  })

  it('aplica bonos y deducciones por empleado al total', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Bo', salario_mensual: 300 })
    for (let d = 1; d <= 30; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }
    const res = await call('rrhh:nomina-generar', {
      periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31',
      salario_base_activo: true,
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

  it('agrega, lista y elimina conceptos de nómina recalculando el total', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Concepto Tester', salario_mensual: 1000 })
    for (let d = 1; d <= 30; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-09-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }
    await call('rrhh:nomina-generar', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30', salario_base_activo: true })
    let list = await call('rrhh:nomina-list', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' }) as any[]
    const nominaId = list[0].id
    expect(list[0].total_pagar).toBeCloseTo(1000, 2)

    await call('rrhh:nomina-concepto-add', { nomina_id: nominaId, nombre: 'Bono alimentación', tipo: 'asignacion', monto: 200 })
    await call('rrhh:nomina-concepto-add', { nomina_id: nominaId, nombre: 'Préstamo', tipo: 'deduccion', monto: 50 })
    list = await call('rrhh:nomina-list', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' }) as any[]
    expect(list[0].conceptos).toHaveLength(2)
    expect(list[0].bonos).toBe(200)
    expect(list[0].deducciones).toBe(50)
    expect(list[0].total_pagar).toBeCloseTo(1150, 2)

    const conceptos = await call('rrhh:nomina-conceptos-list', { nomina_id: nominaId }) as any[]
    const deduccion = conceptos.find((c: any) => c.tipo === 'deduccion')
    await call('rrhh:nomina-concepto-delete', { id: deduccion.id })
    list = await call('rrhh:nomina-list', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' }) as any[]
    expect(list[0].conceptos).toHaveLength(1)
    expect(list[0].total_pagar).toBeCloseTo(1200, 2)
  })

  it('rechaza agregar conceptos a una nómina ya pagada', async () => {
    await call('rrhh:empleado-create', { nombre: 'Pagada', salario_mensual: 100 })
    await call('rrhh:nomina-generar', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' })
    const list = await call('rrhh:nomina-list', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' }) as any[]
    await call('rrhh:nomina-pagar', { ids: [list[0].id] })
    const res = await call('rrhh:nomina-concepto-add', { nomina_id: list[0].id, nombre: 'X', tipo: 'asignacion', monto: 10 })
    expect(res.success).toBe(false)
  })
})

describe('RRHH: gating y permisos', () => {
  it('bloquea los handlers si el módulo no está en la licencia', async () => {
    state.active = ['comercializador']
    const res = await call('rrhh:empleados-list')
    expect(res.success).toBe(false)
    expect(res.error).toContain('no está activo')
    state.active = ['comercializador', 'administracion']
  })

  it('bloquea sin permisos (sin usuario_id)', async () => {
    const res = await handles['rrhh:empleados-list'](null, {})
    expect(res.success).toBe(false)
  })
})

describe('RRHH: histórico de asistencias', () => {
  it('filtra por empleado y rango de fechas', async () => {
    const ana = await call('rrhh:empleado-create', { nombre: 'Ana' })
    const luis = await call('rrhh:empleado-create', { nombre: 'Luis' })
    await call('rrhh:asistencia-registrar', { empleado_id: ana.id, fecha: '2026-09-01', estado: 'presente' })
    await call('rrhh:asistencia-registrar', { empleado_id: ana.id, fecha: '2026-09-15', estado: 'tarde' })
    await call('rrhh:asistencia-registrar', { empleado_id: luis.id, fecha: '2026-09-10', estado: 'ausente' })

    const todas = await call('rrhh:asistencia-historial', {}) as any[]
    expect(todas).toHaveLength(3)

    const soloAna = await call('rrhh:asistencia-historial', { empleado_id: ana.id }) as any[]
    expect(soloAna).toHaveLength(2)

    const rango = await call('rrhh:asistencia-historial', { desde: '2026-09-05', hasta: '2026-09-20' }) as any[]
    expect(rango).toHaveLength(2)
    expect(rango.every((r) => r.fecha >= '2026-09-05' && r.fecha <= '2026-09-20')).toBe(true)
  })
})

describe('RRHH: catálogo de conceptos globales', () => {
  it('crea, actualiza y lista conceptos', async () => {
    const c = await call('rrhh:concepto-save', { nombre: 'Prima de Transporte', tipo: 'asignacion', monto_default: 30 })
    expect(c.id).toBeTruthy()

    await call('rrhh:concepto-save', { id: c.id, nombre: 'Prima Transporte', tipo: 'asignacion', monto_default: 35 })
    const list = await call('rrhh:conceptos-list', {}) as any[]
    expect(list).toHaveLength(1)
    expect(list[0].monto_default).toBe(35)
  })

  it('rechaza montos negativos y tipos inválidos', async () => {
    const malTipo = await call('rrhh:concepto-save', { nombre: 'X', tipo: 'otro' })
    expect(malTipo.success).toBe(false)
    const malMonto = await call('rrhh:concepto-save', { nombre: 'X', tipo: 'deduccion', monto_default: -5 })
    expect(malMonto.success).toBe(false)
  })

  it('desactiva (no borra) un concepto usado por un grupo', async () => {
    const cat = await call('rrhh:concepto-save', { nombre: 'Seguro', tipo: 'deduccion', monto_default: 10 })
    const grupo = await call('rrhh:grupo-save', { nombre: 'Obreros' })
    await call('rrhh:grupo-conceptos-set', { grupo_id: grupo.id, conceptos: [{ concepto_id: cat.id }] })

    const res = await call('rrhh:concepto-delete', { id: cat.id })
    expect(res.desactivado).toBe(true)
    expect((await call('rrhh:conceptos-list', {}) as any[])).toHaveLength(0)
    expect((await call('rrhh:conceptos-list', { incluirInactivos: true }) as any[])).toHaveLength(1)
  })
})

describe('RRHH: grupos y nómina por capas', () => {
  it('guarda miembros y conceptos del grupo', async () => {
    const ana = await call('rrhh:empleado-create', { nombre: 'Ana' })
    const luis = await call('rrhh:empleado-create', { nombre: 'Luis' })
    const cat = await call('rrhh:concepto-save', { nombre: 'Bono Alimentación', tipo: 'asignacion', monto_default: 40 })
    const grupo = await call('rrhh:grupo-save', { nombre: 'Fijos' })

    await call('rrhh:grupo-miembros-set', { grupo_id: grupo.id, empleado_ids: [ana.id, luis.id] })
    await call('rrhh:grupo-conceptos-set', { grupo_id: grupo.id, conceptos: [{ concepto_id: cat.id, monto: 50 }] })

    const grupos = await call('rrhh:grupos-list', {}) as any[]
    expect(grupos).toHaveLength(1)
    expect(grupos[0].miembros).toBe(2)
    expect(grupos[0].empleado_ids.sort()).toEqual([ana.id, luis.id].sort())
    expect(grupos[0].conceptos_detalle).toHaveLength(1)
    expect(grupos[0].conceptos_detalle[0].monto).toBe(50)
  })

  it('genera nómina solo para el grupo y aplica sus conceptos', async () => {
    const ana = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 300 })
    await call('rrhh:empleado-create', { nombre: 'Luis', salario_mensual: 200 })
    const asignacion = await call('rrhh:concepto-save', { nombre: 'Bono Alimentación', tipo: 'asignacion', monto_default: 50 })
    const deduccion = await call('rrhh:concepto-save', { nombre: 'Seguro Social', tipo: 'deduccion', monto_default: 10 })
    const grupo = await call('rrhh:grupo-save', { nombre: 'Fijos' })
    await call('rrhh:grupo-miembros-set', { grupo_id: grupo.id, empleado_ids: [ana.id] })
    await call('rrhh:grupo-conceptos-set', { grupo_id: grupo.id, conceptos: [
      { concepto_id: asignacion.id },
      { concepto_id: deduccion.id },
    ] })

    const res = await call('rrhh:nomina-generar', {
      periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30', grupo_id: grupo.id, salario_base_activo: false,
    })
    expect(res.success).toBe(true)
    expect(res.nominas).toHaveLength(1)
    expect(res.nominas[0].empleado_nombre).toBe('Ana')

    const nominas = await call('rrhh:nomina-list', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' }) as any[]
    expect(nominas).toHaveLength(1)
    expect(nominas[0].bonos).toBe(50)
    expect(nominas[0].deducciones).toBe(10)
    expect(nominas[0].total_pagar).toBe(40)
    expect(nominas[0].conceptos).toHaveLength(2)
  })

  it('rechaza grupo inexistente y nombre duplicado', async () => {
    await call('rrhh:grupo-save', { nombre: 'Fijos' })
    const dup = await call('rrhh:grupo-save', { nombre: 'Fijos' })
    expect(dup.success).toBe(false)

    const sinGrupo = await call('rrhh:grupo-miembros-set', { grupo_id: 999, empleado_ids: [1] })
    expect(sinGrupo.success).toBe(false)
  })

  it('histórico de nómina por empleado acumula totales', async () => {
    const ana = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 300 })
    await call('rrhh:nomina-generar', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31', salario_base_activo: false, bonos: { [ana.id]: 100 } })
    await call('rrhh:nomina-generar', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30', salario_base_activo: false, bonos: { [ana.id]: 50 } })

    const res = await call('rrhh:nomina-por-empleado', { empleado_id: ana.id })
    expect(res.nominas).toHaveLength(2)
    expect(res.totales.asignaciones).toBe(150)
    expect(res.totales.neto).toBe(150)
  })
})

describe('RRHH: vista previa de nómina (dry-run)', () => {
  it('calcula sin escribir y coincide con la nómina que se genera', async () => {
    const emp = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 300 })
    for (let d = 1; d <= 30; d++) {
      await call('rrhh:asistencia-registrar', { empleado_id: emp.id, fecha: `2026-08-${String(d).padStart(2, '0')}`, estado: 'presente' })
    }

    const preview = await call('rrhh:nomina-preview', {
      periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31', salario_base_activo: true, bonos_globales: 25, deducciones_globales: 5,
    })
    expect(preview.success).toBe(true)
    expect(preview.filas).toHaveLength(1)
    expect(preview.filas[0].empleado_nombre).toBe('Ana')
    expect(preview.filas[0].dias_trabajados).toBe(30)
    expect(preview.filas[0].salario_base).toBeCloseTo(300, 5)
    expect(preview.filas[0].total_pagar).toBeCloseTo(320, 5)
    expect(preview.totales.bruto).toBeCloseTo(325, 5)
    expect(preview.totales.deducciones).toBeCloseTo(5, 5)
    expect(preview.totales.neto).toBeCloseTo(320, 5)

    // La vista previa no persiste nada.
    const antes = await call('rrhh:nomina-list', { periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31' }) as any[]
    expect(antes).toHaveLength(0)

    const generada = await call('rrhh:nomina-generar', {
      periodo_inicio: '2026-08-01', periodo_fin: '2026-08-31', salario_base_activo: true, bonos_globales: 25, deducciones_globales: 5,
    })
    expect(generada.nominas[0].total_pagar).toBeCloseTo(preview.filas[0].total_pagar, 5)
    expect(generada.nominas[0].salario_base).toBeCloseTo(preview.filas[0].salario_base, 5)
  })

  it('detalla los conceptos del grupo en la vista previa', async () => {
    const ana = await call('rrhh:empleado-create', { nombre: 'Ana', salario_mensual: 300 })
    await call('rrhh:empleado-create', { nombre: 'Luis', salario_mensual: 200 })
    const asignacion = await call('rrhh:concepto-save', { nombre: 'Bono Alimentación', tipo: 'asignacion', monto_default: 50 })
    const deduccion = await call('rrhh:concepto-save', { nombre: 'Seguro Social', tipo: 'deduccion', monto_default: 10 })
    const grupo = await call('rrhh:grupo-save', { nombre: 'Fijos' })
    await call('rrhh:grupo-miembros-set', { grupo_id: grupo.id, empleado_ids: [ana.id] })
    await call('rrhh:grupo-conceptos-set', { grupo_id: grupo.id, conceptos: [{ concepto_id: asignacion.id }, { concepto_id: deduccion.id }] })

    const preview = await call('rrhh:nomina-preview', {
      periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30', grupo_id: grupo.id, salario_base_activo: false,
    })
    expect(preview.success).toBe(true)
    // Solo los miembros del grupo, con los conceptos del grupo (capa 3).
    expect(preview.filas).toHaveLength(1)
    expect(preview.filas[0].empleado_nombre).toBe('Ana')
    expect(preview.filas[0].bonos).toBe(50)
    expect(preview.filas[0].deducciones).toBe(10)
    expect(preview.filas[0].total_pagar).toBe(40)
    expect(preview.filas[0].conceptos.map((c: any) => c.nombre)).toEqual(['Bono Alimentación', 'Seguro Social'])
    expect(preview.totales.neto).toBe(40)
  })

  it('valida el período y la ausencia de empleados sin escribir', async () => {
    const sinEmpleados = await call('rrhh:nomina-preview', { periodo_inicio: '2026-09-01', periodo_fin: '2026-09-30' })
    expect(sinEmpleados.success).toBe(false)

    await call('rrhh:empleado-create', { nombre: 'Ana' })
    const invertido = await call('rrhh:nomina-preview', { periodo_inicio: '2026-09-30', periodo_fin: '2026-09-01' })
    expect(invertido.success).toBe(false)

    const sinPeriodo = await call('rrhh:nomina-preview', { periodo_inicio: '', periodo_fin: '' })
    expect(sinPeriodo.success).toBe(false)
  })
})

