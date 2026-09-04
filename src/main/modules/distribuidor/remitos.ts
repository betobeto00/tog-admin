import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

export const ESTADOS_REMITO = ['pendiente', 'despachado', 'entregado', 'anulado'] as const
export type EstadoRemito = (typeof ESTADOS_REMITO)[number]

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('distribuidor')) {
    return { success: false, error: 'El módulo Distribuidor no está activo en la licencia' }
  }
  return null
}

export function registerRemitosHandlers(): void {
  ipcMain.handle('remitos:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'remitos:list', 'distribuidor_pedidos_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db
      .prepare(
        `SELECT r.id, r.numero, r.pedido_id, r.cliente_id, r.fecha, r.estado, r.observaciones,
                c.nombre AS cliente_nombre,
                CAST(p.numero AS INTEGER) AS pedido_numero
         FROM remitos r
         JOIN clientes c ON c.id = r.cliente_id
         LEFT JOIN pedidos p ON p.id = r.pedido_id
         ORDER BY r.fecha DESC, r.id DESC`
      )
      .all()
  })

  ipcMain.handle('remitos:create', async (_event, data: { pedido_id: number; observaciones?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'remitos:create', 'distribuidor_pedidos_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const pedido = db.prepare('SELECT id, cliente_id, estado FROM pedidos WHERE id = ?').get(data.pedido_id) as
      | { id: number; cliente_id: number; estado: string }
      | undefined
    if (!pedido) return { success: false, error: 'Pedido no encontrado' }
    if (pedido.estado === 'anulado') return { success: false, error: 'No se puede remitar un pedido anulado' }

    const existe = db.prepare('SELECT id FROM remitos WHERE pedido_id = ? AND estado != ?').get(data.pedido_id, 'anulado')
    if (existe) return { success: false, error: 'El pedido ya tiene un remito generado' }

    const numeroRow = db.prepare("SELECT valor FROM configuracion WHERE clave = 'remito_numero'").get() as
      | { valor: string }
      | undefined
    const numero = (numeroRow ? Number(numeroRow.valor) || 0 : 0) + 1

    const result = db.prepare(
      `INSERT INTO remitos (numero, pedido_id, cliente_id, estado, observaciones)
       VALUES (?, ?, ?, 'pendiente', ?)`
    ).run(String(numero), pedido.id, pedido.cliente_id, data.observaciones || null)
    db.prepare("INSERT INTO configuracion (clave, valor) VALUES ('remito_numero', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(String(numero))
    return { success: true, id: result.lastInsertRowid, numero: Number(numero) }
  })

  ipcMain.handle('remitos:update', async (_event, data: { id: number; estado?: string; observaciones?: string | null; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'remitos:update', 'distribuidor_pedidos_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const remito = db.prepare('SELECT id, estado FROM remitos WHERE id = ?').get(data.id) as
      | { id: number; estado: EstadoRemito }
      | undefined
    if (!remito) return { success: false, error: 'Remito no encontrado' }

    const cambios: { col: string; val: string | null }[] = []
    if (typeof data.observaciones === 'string') cambios.push({ col: 'observaciones', val: data.observaciones })
    if (data.estado) {
      if (!ESTADOS_REMITO.includes(data.estado as EstadoRemito)) {
        return { success: false, error: `Estado inválido: ${data.estado}` }
      }
      if (data.estado !== remito.estado) cambios.push({ col: 'estado', val: data.estado })
    }
    if (!cambios.length) return { success: true }

    const setSql = cambios.map((c) => `${c.col} = ?`).join(', ')
    db.prepare(`UPDATE remitos SET ${setSql} WHERE id = ?`).run(...cambios.map((c) => c.val), data.id)
    return { success: true }
  })
}