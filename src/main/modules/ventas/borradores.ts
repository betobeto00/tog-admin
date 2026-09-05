import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

interface BorradorItem {
  producto_id: number
  nombre: string
  precio_unitario: number
  cantidad: number
  stock: number
  unidad: string
  tipo: 'producto' | 'servicio'
  esVentaRapida?: boolean
  descuento: number
}

interface BorradorPayload {
  items: BorradorItem[]
  descuento_global: number
  cliente_id: number | null
  notas: string | null
}

function parsePayload(itemsJson: string): BorradorPayload {
  try {
    const parsed = JSON.parse(itemsJson || '{}')
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      descuento_global: Number(parsed.descuento_global) || 0,
      cliente_id: parsed.cliente_id ?? null,
      notas: parsed.notas ?? null,
    }
  } catch {
    return { items: [], descuento_global: 0, cliente_id: null, notas: null }
  }
}

export function registerBorradoresHandlers(): void {
  handleIpc('borradores:list', async (_event, data: { usuario_id?: number } = {} as any) => {
    const fail = checkPermissionOrFail(data, 'borradores:list', 'pos_access')
    if (fail) return fail
    const db = getDatabase()
    const rows = db.prepare(`
      SELECT b.id, b.usuario_id, b.cliente_id, b.items_json, b.descuento_global, b.notas, b.creado_en, b.actualizado_en,
        c.nombre as cliente_nombre
      FROM ventas_borrador b
      LEFT JOIN clientes c ON c.id = b.cliente_id
      WHERE b.usuario_id = ?
      ORDER BY b.actualizado_en DESC
    `).all(data.usuario_id)
    return rows.map((r: any) => {
      const payload = parsePayload(r.items_json)
      return {
        id: r.id,
        usuario_id: r.usuario_id,
        cliente_id: r.cliente_id,
        cliente_nombre: r.cliente_nombre,
        descuento_global: r.descuento_global,
        notas: r.notas,
        creado_en: r.creado_en,
        actualizado_en: r.actualizado_en,
        item_count: payload.items.length,
        total: payload.items.reduce((acc, it) => {
          const lineSub = (Number(it.precio_unitario) || 0) * (Number(it.cantidad) || 0) * (1 - (Number(it.descuento) || 0) / 100)
          return acc + lineSub
        }, 0) * (1 - (Number(r.descuento_global) || 0) / 100),
      }
    })
  })

  handleIpc('borradores:save', async (_event, data: { id?: number; items: BorradorItem[]; descuento_global: number; cliente_id: number | null; notas: string | null; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'borradores:save', 'pos_access')
    if (fail) return fail
    if (!data?.usuario_id) return { success: false, error: 'usuario_id es requerido' }
    if (!Array.isArray(data.items) || data.items.length === 0) {
      return { success: false, error: 'El borrador no puede estar vacío' }
    }
    const db = getDatabase()
    const itemsJson = JSON.stringify({
      items: data.items,
      descuento_global: data.descuento_global || 0,
      cliente_id: data.cliente_id,
      notas: data.notas,
    })
    if (data.id) {
      db.prepare(`
        UPDATE ventas_borrador
        SET items_json = ?, descuento_global = ?, cliente_id = ?, notas = ?, actualizado_en = datetime('now')
        WHERE id = ? AND usuario_id = ?
      `).run(itemsJson, data.descuento_global || 0, data.cliente_id, data.notas, data.id, data.usuario_id)
      return { success: true, id: data.id }
    }
    const result = db.prepare(`
      INSERT INTO ventas_borrador (usuario_id, cliente_id, items_json, descuento_global, notas)
      VALUES (?, ?, ?, ?, ?)
    `).run(data.usuario_id, data.cliente_id, itemsJson, data.descuento_global || 0, data.notas)
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('borradores:load', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'borradores:load', 'pos_access')
    if (fail) return fail
    if (!data?.id || !data?.usuario_id) return { success: false, error: 'id y usuario_id son requeridos' }
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM ventas_borrador WHERE id = ? AND usuario_id = ?').get(data.id, data.usuario_id) as any
    if (!row) return { success: false, error: 'Borrador no encontrado' }
    const payload = parsePayload(row.items_json)
    return { success: true, borrador: { ...payload, id: row.id, creado_en: row.creado_en, actualizado_en: row.actualizado_en } }
  })

  handleIpc('borradores:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'borradores:delete', 'pos_access')
    if (fail) return fail
    if (!data?.id || !data?.usuario_id) return { success: false, error: 'id y usuario_id son requeridos' }
    const db = getDatabase()
    db.prepare('DELETE FROM ventas_borrador WHERE id = ? AND usuario_id = ?').run(data.id, data.usuario_id)
    return { success: true }
  })
}
