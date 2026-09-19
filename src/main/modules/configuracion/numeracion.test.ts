// Numeración de comprobantes: el negocio puede fijar el próximo número de
// factura y el próximo N° de control fiscal (SENIAT) cuando viene de otro
// sistema. Una vez fijados, la app los avanza sola y **solo un admin** puede
// cambiarlos (renumerar facturas ya emitidas es irreversible).

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db, handles, estado } = vi.hoisted(() => {
  const { DatabaseSync } = require('node:sqlite')
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE configuracion (
      clave TEXT PRIMARY KEY,
      valor TEXT NOT NULL,
      descripcion TEXT,
      actualizado_en TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE ventas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      numero_venta INTEGER NOT NULL,
      numero_control TEXT
    );
  `)
  const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
  const estado = { admin: true, permisos: true }
  return { db, handles, estado }
})

vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (channel: string, fn: any) => {
    handles[channel] = fn
  },
}))

vi.mock('../../db/database', () => ({ getDatabase: () => db }))

vi.mock('../../services/configCache', () => ({ invalidateConfigCache: () => {} }))

vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: (data: any) => {
    if (!estado.permisos) {
      return { success: false as const, error: 'Permiso denegado', channel: 'test' }
    }
    if (data && typeof data === 'object') data.usuario_id = 1
    return null
  },
  resolveAuthenticatedUserId: () => 1,
  isAdminUser: () => estado.admin,
}))

import { getNumeracion, guardarNumeracion, registerNumeracionHandlers } from './numeracion'

registerNumeracionHandlers()

const send = (ch: string, data: any) => handles[ch](null, data)

function insertarVenta(numero: number, control: string | null = null) {
  db.prepare('INSERT INTO ventas (numero_venta, numero_control) VALUES (?, ?)').run(numero, control)
}

describe('numeración de comprobantes', () => {
  beforeEach(() => {
    estado.admin = true
    estado.permisos = true
    db.exec('DELETE FROM ventas; DELETE FROM configuracion;')
  })

  it('arranca en la factura 1 y el control A-00000001', () => {
    const n = getNumeracion(db)
    expect(n.proxima_factura).toBe(1)
    expect(n.ultima_factura).toBe(0)
    expect(n.proximo_numero_control).toBe(1)
    expect(n.numero_control_formateado).toBe('A-00000001')
  })

  it('deja fijar el próximo número de factura (migración desde otro sistema)', () => {
    const res = guardarNumeracion(db, { proxima_factura: 2324 })
    expect(res.success).toBe(true)
    expect(getNumeracion(db).proxima_factura).toBe(2324)

    // La app lo avanza sola al vender y no vuelve atrás
    insertarVenta(2324)
    expect(getNumeracion(db).proxima_factura).toBe(2325)
  })

  it('rechaza un número menor o igual a la última factura emitida', () => {
    insertarVenta(100)
    const res = guardarNumeracion(db, { proxima_factura: 100 })
    expect(res.success).toBe(false)
    expect(res.error).toContain('#100')
    expect(getNumeracion(db).proxima_factura).toBe(101)
  })

  it('rechaza valores no enteros o menores a 1', () => {
    expect(guardarNumeracion(db, { proxima_factura: 0 }).success).toBe(false)
    expect(guardarNumeracion(db, { proxima_factura: 1.5 }).success).toBe(false)
    expect(guardarNumeracion(db, { proximo_numero_control: 0 }).success).toBe(false)
  })

  it('deja fijar el próximo N° de control fiscal y lo formatea con la serie', () => {
    const res = guardarNumeracion(db, { proximo_numero_control: 5000, serie: 'b' })
    expect(res.success).toBe(true)

    const n = getNumeracion(db)
    expect(n.proximo_numero_control).toBe(5000)
    expect(n.numero_control_formateado).toBe('B-00005000')
  })

  it('normaliza la serie (sin caracteres raros, máximo 4)', () => {
    guardarNumeracion(db, { serie: 'a<script>' })
    expect(getNumeracion(db).serie).toBe('ASCR')
  })

  it('expone el estado por IPC a quien puede imprimir', async () => {
    const res = await send('facturacion:numeracion', { usuario_id: 1 })
    expect(res.success).toBe(true)
    expect(res.numeracion.proxima_factura).toBe(1)
  })

  it('sin permisos de impresión no deja leer la numeración', async () => {
    estado.permisos = false
    const res = await send('facturacion:numeracion', { usuario_id: 1 })
    expect(res.success).toBe(false)
  })

  it('solo un admin puede cambiar la numeración', async () => {
    estado.admin = false
    const res = await send('facturacion:set-numeracion', { usuario_id: 1, proxima_factura: 2324 })
    expect(res.success).toBe(false)
    expect(res.error).toContain('administrador')
    // y no se guardó nada
    expect(getNumeracion(db).proxima_factura).toBe(1)
  })

  it('el admin fija ambos correlativos de una vez', async () => {
    const res = await send('facturacion:set-numeracion', {
      usuario_id: 1,
      proxima_factura: 2325,
      proximo_numero_control: 900,
    })
    expect(res.success).toBe(true)
    expect(res.numeracion.proxima_factura).toBe(2325)
    expect(res.numeracion.numero_control_formateado).toBe('A-00000900')
  })
})
