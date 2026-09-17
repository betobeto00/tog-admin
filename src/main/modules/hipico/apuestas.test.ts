import { describe, it, expect, vi, beforeEach } from 'vitest'

// DB en memoria con la API de node:sqlite (mismo patrón que print.test.ts)
const { db, handles } = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite')
  const raw = new DatabaseSync(':memory:')
  const stmts = new Map<string, any>()
  const db = {
    exec(sql: string) {
      return raw.exec(sql)
    },
    prepare(sql: string) {
      if (!stmts.has(sql)) stmts.set(sql, raw.prepare(sql))
      return stmts.get(sql)
    },
    transaction(fn: (...args: any[]) => any) {
      return (...args: any[]) => fn(...args)
    },
  }
  db.exec(`
    CREATE TABLE configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE hipico_caballos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      activo INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE hipico_carreras (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hipodromo TEXT NOT NULL,
      fecha TEXT NOT NULL,
      numero_carrera INTEGER NOT NULL,
      estado TEXT NOT NULL DEFAULT 'programada',
      notas TEXT
    );
    CREATE TABLE hipico_inscripciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrera_id INTEGER NOT NULL,
      caballo_id INTEGER NOT NULL,
      retirado INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE hipico_resultados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrera_id INTEGER NOT NULL,
      inscripcion_id INTEGER NOT NULL,
      caballo_id INTEGER NOT NULL,
      posicion INTEGER NOT NULL
    );
    CREATE TABLE hipico_apuestas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_ticket TEXT NOT NULL,
      carrera_id INTEGER NOT NULL,
      tipo_apuesta TEXT NOT NULL DEFAULT 'win',
      monto REAL NOT NULL,
      odd_total REAL,
      payout_potencial REAL,
      estado TEXT NOT NULL DEFAULT 'pendiente',
      ganancia REAL,
      cerrada_en TEXT,
      cobrada_en TEXT,
      notas TEXT,
      creado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE hipico_apuesta_selections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      apuesta_id INTEGER NOT NULL,
      carrera_id INTEGER NOT NULL,
      caballo_nombre TEXT NOT NULL,
      caballo_numero INTEGER,
      posicion_predicha INTEGER,
      odd_individual REAL,
      resultado_posicion INTEGER,
      ganador INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE hipico_carreras_odds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      carrera_id INTEGER NOT NULL,
      bookmaker_key TEXT NOT NULL,
      bookmaker_nombre TEXT NOT NULL,
      outcomes_json TEXT NOT NULL,
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE (carrera_id, bookmaker_key)
    );
    CREATE TABLE hipico_config_api (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);

    INSERT INTO hipico_caballos (id, nombre) VALUES (1, 'Relámpago'), (2, 'Tormenta'), (3, 'Ceniza');
    INSERT INTO hipico_carreras (id, hipodromo, fecha, numero_carrera, estado)
      VALUES (1, 'La Rinconada', '2026-09-15', 3, 'finalizada'),
             (2, 'La Rinconada', '2026-09-16', 1, 'programada');
    INSERT INTO hipico_inscripciones (id, carrera_id, caballo_id) VALUES (1, 1, 1), (2, 1, 2), (3, 1, 3);
    INSERT INTO hipico_resultados (carrera_id, inscripcion_id, caballo_id, posicion) VALUES
      (1, 1, 1, 1), (1, 2, 2, 2), (1, 3, 3, 3);
  `)
  return { db, handles: {} as Record<string, any> }
})

const PERMISOS_POR_USUARIO: Record<number, string[]> = {
  // 1 = admin de apuestas (vende + administra), 2 = sólo vende, 3 = sin permisos
  1: ['hipico_apuestas', 'hipico_apuestas_admin', 'print_ticket'],
  2: ['hipico_apuestas'],
  3: [],
}

vi.mock('electron', () => ({ ipcMain: { handle: (c: string, fn: any) => { handles[c] = fn } } }))
vi.mock('../../core/auth/ipc-guard', () => ({ handleIpc: (c: string, fn: any) => { handles[c] = fn } }))
vi.mock('../../db/database', () => ({ getDatabase: () => db }))
vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: (data: any, channel: string, permission: string) => {
    const perms = PERMISOS_POR_USUARIO[data?.usuario_id] ?? []
    if (!perms.includes(permission)) {
      return { success: false, error: `Permiso denegado: '${permission}' requerido para '${channel}'.`, channel }
    }
    return null
  },
}))

import { construirLineasTicketApuesta, type DocumentoApuesta } from '../../../shared/print'
import {
  apuestaGanadora,
  calcularOddTotal,
  generarNumeroTicket,
  liquidarApuestasDeCarrera,
  registerApuestasHandlers,
} from './apuestas'

function crearApuesta(opts: {
  id: number
  carreraId: number
  tipo: string
  monto: number
  oddTotal: number
  estado?: string
  selections: Array<{ caballo: string; odd: number; predicha?: number | null }>
}) {
  const payout = opts.monto * opts.oddTotal
  db.prepare(
    `INSERT INTO hipico_apuestas (id, numero_ticket, carrera_id, tipo_apuesta, monto, odd_total, payout_potencial, estado)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(opts.id, `AP-20260915-000${opts.id}`, opts.carreraId, opts.tipo, opts.monto, opts.oddTotal, payout, opts.estado ?? 'pendiente')
  const ins = db.prepare(
    `INSERT INTO hipico_apuesta_selections (apuesta_id, carrera_id, caballo_nombre, posicion_predicha, odd_individual)
     VALUES (?, ?, ?, ?, ?)`,
  )
  for (const s of opts.selections) ins.run(opts.id, opts.carreraId, s.caballo, s.predicha ?? null, s.odd)
}

const estadoDe = (id: number) => db.prepare('SELECT * FROM hipico_apuestas WHERE id = ?').get(id) as any

beforeEach(() => {
  db.exec(`
    DELETE FROM hipico_apuestas;
    DELETE FROM hipico_apuesta_selections;
  `)
  registerApuestasHandlers()
})

describe('reglas de liquidación', () => {
  it('win sólo paga si el caballo ganó', () => {
    expect(apuestaGanadora('win', [{ posicion_predicha: null, posicion_real: 1 }])).toBe(true)
    expect(apuestaGanadora('win', [{ posicion_predicha: null, posicion_real: 2 }])).toBe(false)
  })

  it('place paga hasta el tercer puesto', () => {
    expect(apuestaGanadora('place', [{ posicion_predicha: null, posicion_real: 3 }])).toBe(true)
    expect(apuestaGanadora('place', [{ posicion_predicha: null, posicion_real: 4 }])).toBe(false)
  })

  it('each-way paga si ganó o entró en el puesto', () => {
    expect(apuestaGanadora('each_way', [{ posicion_predicha: null, posicion_real: 1 }])).toBe(true)
    expect(apuestaGanadora('each_way', [{ posicion_predicha: null, posicion_real: 2 }])).toBe(true)
    expect(apuestaGanadora('each_way', [{ posicion_predicha: null, posicion_real: 6 }])).toBe(false)
  })

  it('exacta exige que TODAS las posiciones predichas coincidan', () => {
    expect(
      apuestaGanadora('exacta', [
        { posicion_predicha: 1, posicion_real: 1 },
        { posicion_predicha: 2, posicion_real: 2 },
      ]),
    ).toBe(true)
    // Un solo acierto NO paga
    expect(
      apuestaGanadora('exacta', [
        { posicion_predicha: 1, posicion_real: 1 },
        { posicion_predicha: 2, posicion_real: 3 },
      ]),
    ).toBe(false)
    // Orden invertido tampoco
    expect(
      apuestaGanadora('exacta', [
        { posicion_predicha: 2, posicion_real: 1 },
        { posicion_predicha: 1, posicion_real: 2 },
      ]),
    ).toBe(false)
  })

  it('trifecta exige los tres puestos en orden y sin predicción no paga', () => {
    expect(
      apuestaGanadora('trifecta', [
        { posicion_predicha: 1, posicion_real: 1 },
        { posicion_predicha: 2, posicion_real: 2 },
        { posicion_predicha: 3, posicion_real: 3 },
      ]),
    ).toBe(true)
    expect(
      apuestaGanadora('trifecta', [
        { posicion_predicha: 1, posicion_real: 1 },
        { posicion_predicha: 2, posicion_real: 2 },
        { posicion_predicha: 3, posicion_real: 4 },
      ]),
    ).toBe(false)
    expect(apuestaGanadora('exacta', [{ posicion_predicha: null, posicion_real: 1 }])).toBe(false)
  })

  it('sin selecciones no paga', () => {
    expect(apuestaGanadora('win', [])).toBe(false)
  })
})

describe('odd total', () => {
  it('es la única odd en apuestas simples', () => {
    expect(calcularOddTotal('win', [{ caballo_nombre: 'A', caballo_numero: null, posicion_predicha: null, odd_individual: 2.5 }])).toBe(2.5)
  })

  it('es el producto de las individuales en las combinadas', () => {
    expect(
      calcularOddTotal('exacta', [
        { caballo_nombre: 'A', caballo_numero: null, posicion_predicha: 1, odd_individual: 2 },
        { caballo_nombre: 'B', caballo_numero: null, posicion_predicha: 2, odd_individual: 3 },
      ]),
    ).toBe(6)
  })
})

describe('liquidarApuestasDeCarrera', () => {
  it('paga las ganadoras, marca las perdedoras y deja pendientes las que no tienen resultado', () => {
    crearApuesta({ id: 1, carreraId: 1, tipo: 'win', monto: 10, oddTotal: 2, selections: [{ caballo: 'Relámpago', odd: 2 }] })
    crearApuesta({ id: 2, carreraId: 1, tipo: 'win', monto: 10, oddTotal: 3, selections: [{ caballo: 'Tormenta', odd: 3 }] })
    crearApuesta({
      id: 3,
      carreraId: 1,
      tipo: 'exacta',
      monto: 5,
      oddTotal: 6,
      selections: [
        { caballo: 'Relámpago', odd: 2, predicha: 1 },
        { caballo: 'Tormenta', odd: 3, predicha: 2 },
      ],
    })
    crearApuesta({
      id: 4,
      carreraId: 1,
      tipo: 'exacta',
      monto: 5,
      oddTotal: 6,
      selections: [
        { caballo: 'Tormenta', odd: 3, predicha: 1 },
        { caballo: 'Relámpago', odd: 2, predicha: 2 },
      ],
    })
    // Caballo que no corrió en esta carrera: la apuesta queda pendiente
    crearApuesta({ id: 5, carreraId: 1, tipo: 'win', monto: 7, oddTotal: 4, selections: [{ caballo: 'Fantasma', odd: 4 }] })

    const res = liquidarApuestasDeCarrera(1)

    expect(res).toEqual({ liquidadas: 4, ganadas: 2, perdidas: 2, sinResolver: 1 })
    expect(estadoDe(1)).toMatchObject({ estado: 'ganada', ganancia: 20 })
    expect(estadoDe(2)).toMatchObject({ estado: 'perdida', ganancia: 0 })
    expect(estadoDe(3)).toMatchObject({ estado: 'ganada', ganancia: 30 })
    expect(estadoDe(4)).toMatchObject({ estado: 'perdida', ganancia: 0 })
    expect(estadoDe(5)).toMatchObject({ estado: 'pendiente', ganancia: null })
  })

  it('es idempotente: no vuelve a liquidar lo ya cerrado', () => {
    crearApuesta({ id: 1, carreraId: 1, tipo: 'win', monto: 10, oddTotal: 2, selections: [{ caballo: 'Relámpago', odd: 2 }] })
    expect(liquidarApuestasDeCarrera(1).liquidadas).toBe(1)
    expect(liquidarApuestasDeCarrera(1).liquidadas).toBe(0)
  })
})

describe('permisos', () => {
  it('vender apuestas requiere hipico_apuestas', async () => {
    const vender = (usuario_id: number) =>
      handles['hipico:apuesta-crear'](null, {
        usuario_id,
        carrera_id: 2,
        tipo_apuesta: 'win',
        monto: 10,
        selections: [{ caballo_nombre: 'Relámpago', odd_individual: 2 }],
      })

    expect((await vender(3)).success).toBe(false)
    expect((await vender(2)).success).toBe(true)
  })

  it('liquidar y anular exigen hipico_apuestas_admin (un vendedor no puede hacerlo)', async () => {
    expect((await handles['hipico:apuestas-liquidar'](null, { usuario_id: 2, carrera_id: 1 })).success).toBe(false)
    expect((await handles['hipico:apuesta-anular'](null, { usuario_id: 2, apuesta_id: 1 })).success).toBe(false)

    crearApuesta({ id: 1, carreraId: 1, tipo: 'win', monto: 10, oddTotal: 2, selections: [{ caballo: 'Relámpago', odd: 2 }] })
    expect((await handles['hipico:apuestas-liquidar'](null, { usuario_id: 1, carrera_id: 1 })).success).toBe(true)
  })

  it('no se puede apostar en una carrera finalizada', async () => {
    const res = await handles['hipico:apuesta-crear'](null, {
      usuario_id: 1,
      carrera_id: 1,
      tipo_apuesta: 'win',
      monto: 10,
      selections: [{ caballo_nombre: 'Relámpago', odd_individual: 2 }],
    })
    expect(res).toMatchObject({ success: false })
  })
})

describe('validación de la apuesta', () => {
  const crear = (payload: any) => handles['hipico:apuesta-crear'](null, { usuario_id: 1, carrera_id: 2, ...payload })

  it('rechaza monto inválido, odd inválida y combinadas mal armadas', async () => {
    expect((await crear({ tipo_apuesta: 'win', monto: 0, selections: [{ caballo_nombre: 'A', odd_individual: 2 }] })).success).toBe(false)
    expect((await crear({ tipo_apuesta: 'win', monto: 10, selections: [{ caballo_nombre: 'A', odd_individual: 0 }] })).success).toBe(false)
    expect(
      (await crear({ tipo_apuesta: 'win', monto: 10, selections: [{ caballo_nombre: 'A', odd_individual: 2 }, { caballo_nombre: 'B', odd_individual: 3 }] }))
        .success,
    ).toBe(false)
    expect((await crear({ tipo_apuesta: 'exacta', monto: 10, selections: [{ caballo_nombre: 'A', odd_individual: 2, posicion_predicha: 1 }] })).success).toBe(false)
    expect(
      (await crear({
        tipo_apuesta: 'exacta',
        monto: 10,
        selections: [
          { caballo_nombre: 'A', odd_individual: 2, posicion_predicha: 1 },
          { caballo_nombre: 'B', odd_individual: 3, posicion_predicha: 1 },
        ],
      })).success,
    ).toBe(false)
  })

  it('crea el ticket con número correlativo y payout calculado', async () => {
    const res = await crear({
      tipo_apuesta: 'exacta',
      monto: 10,
      selections: [
        { caballo_nombre: 'Relámpago', odd_individual: 2, posicion_predicha: 1 },
        { caballo_nombre: 'Tormenta', odd_individual: 3, posicion_predicha: 2 },
      ],
    })
    expect(res.success).toBe(true)
    expect(res.numero_ticket).toMatch(/^AP-\d{8}-\d{4}$/)
    expect(res.odd_total).toBe(6)
    expect(res.payout_potencial).toBe(60)
  })

  it('numera los tickets del día en forma creciente', () => {
    expect(generarNumeroTicket(db as any)).toMatch(/^AP-\d{8}-0001$/)
  })
})

describe('ticket de apuesta', () => {
  const doc: DocumentoApuesta = {
    empresa: { razon_social: 'Agencia Hípica SA', rif: 'J-123' },
    numero_ticket: 'AP-20260915-0001',
    fecha: '2026-09-15 11:30:00',
    hipodromo: 'La Rinconada',
    numero_carrera: 3,
    tipo_apuesta: 'exacta',
    selecciones: [
      { caballo: 'Relámpago', numero: 1, odd: 2, posicion_predicha: 1, resultado_posicion: 1, ganador: true },
      { caballo: 'Tormenta', numero: 4, odd: 3, posicion_predicha: 2, resultado_posicion: 2, ganador: true },
    ],
    monto: 10,
    odd_total: 6,
    payout_potencial: 60,
    estado: 'ganada',
    ganancia: 60,
    moneda: 'USD',
  }

  const texto = (d: DocumentoApuesta, ancho?: 58 | 80) => construirLineasTicketApuesta(d, ancho).map((l) => l.texto)

  it('incluye empresa, ticket, carrera, selecciones y totales', () => {
    const lineas = texto(doc, 80)
    expect(lineas.some((l) => l.includes('TICKET DE APUESTA'))).toBe(true)
    expect(lineas.some((l) => l.includes('AP-20260915-0001'))).toBe(true)
    expect(lineas.some((l) => l.includes('La Rinconada #3'))).toBe(true)
    expect(lineas.some((l) => l.includes('Relámpago'))).toBe(true)
    expect(lineas.some((l) => l.includes('Monto apostado'))).toBe(true)
    expect(lineas.some((l) => l.includes('GANANCIA'))).toBe(true)
  })

  it('ninguna línea supera el ancho del papel', () => {
    for (const ancho of [58, 80] as const) {
      for (const linea of texto(doc, ancho)) {
        expect(linea.length).toBeLessThanOrEqual(ancho === 58 ? 32 : 48)
      }
    }
  })

  it('las apuestas pendientes no muestran ganancia y marcan reimpresión', () => {
    const pendiente = texto({ ...doc, estado: 'pendiente', ganancia: null, reimpresion: true }, 80)
    expect(pendiente.some((l) => l.includes('REIMPRESION'))).toBe(true)
    expect(pendiente.some((l) => l.includes('GANANCIA'))).toBe(false)
    expect(pendiente.some((l) => l.includes('PENDIENTE'))).toBe(true)
  })
})
