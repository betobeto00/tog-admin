import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'
import { pedidoCreateSchema } from '../../../shared/validations'

export const ESTADOS_PEDIDO = ['pendiente', 'despachado', 'entregado', 'anulado'] as const
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number]

// Transiciones permitidas: pendiente → despachado/entregado/anulado · despachado → entregado
const TRANSICIONES: Partial<Record<EstadoPedido, EstadoPedido[]>> = {
  pendiente: ['despachado', 'entregado', 'anulado'],
  despachado: ['entregado'],
  entregado: [],
  anulado: [],
}

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('distribuidor')) {
    return { success: false, error: 'El módulo Distribuidor no está activo en la licencia' }
  }
  return null
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function registerPedidosHandlers(): void {
  ipcMain.handle('pedidos:list', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'pedidos:list', 'distribuidor_pedidos_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db
      .prepare(
        `SELECT p.id, p.numero, p.cliente_id, p.fecha, p.estado, p.subtotal, p.impuesto, p.total, p.notas,
                c.nombre AS cliente_nombre,
                (SELECT COUNT(*) FROM pedido_detalles d WHERE d.pedido_id = p.id) AS lineas
         FROM pedidos p
         JOIN clientes c ON c.id = p.cliente_id
         ORDER BY p.fecha DESC, p.id DESC`
      )
      .all()
  })

  // Catálogo de productos del Core para armar pedidos (no requiere permiso de inventario)
  ipcMain.handle('pedidos:catalogo', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'pedidos:catalogo', 'distribuidor_pedidos_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db
      .prepare('SELECT id, nombre, precio_venta, stock, unidad FROM productos WHERE activo = 1 ORDER BY nombre')
      .all()
  })

  ipcMain.handle('pedidos:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'pedidos:create', 'distribuidor_pedidos_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const parsed = pedidoCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const { cliente_id, notas, items } = parsed.data

    const numeroRow = db.prepare("SELECT valor FROM configuracion WHERE clave = 'pedido_numero'").get() as
      | { valor: string }
      | undefined
    const numero = (numeroRow ? Number(numeroRow.valor) || 0 : 0) + 1
    const subtotal = round2(items.reduce((acc, it) => acc + it.cantidad * it.precio, 0))

    const crearPedido = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO pedidos (numero, cliente_id, estado, subtotal, impuesto, total, notas)
           VALUES (?, ?, 'pendiente', ?, 0, ?, ?)`
        )
        .run(String(numero), cliente_id, subtotal, subtotal, notas || null)
      const pedidoId = result.lastInsertRowid

      const insertDetalle = db.prepare(
        'INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio, subtotal) VALUES (?, ?, ?, ?, ?)'
      )
      for (const it of items) {
        insertDetalle.run(pedidoId, it.producto_id, it.cantidad, it.precio, round2(it.cantidad * it.precio))
      }
      db.prepare("INSERT INTO configuracion (clave, valor) VALUES ('pedido_numero', ?) ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor").run(String(numero))
      return pedidoId
    })

    const pedidoId = crearPedido()
    return { success: true, id: pedidoId, numero, total: subtotal }
  })

  ipcMain.handle('pedidos:update', async (_event, data: { id: number; estado?: string; notas?: string | null; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'pedidos:update', 'distribuidor_pedidos_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const pedido = db.prepare('SELECT id, estado, notas FROM pedidos WHERE id = ?').get(data.id) as
      | { id: number; estado: EstadoPedido; notas: string | null }
      | undefined
    if (!pedido) return { success: false, error: 'Pedido no encontrado' }

    const cambios: { col: string; val: string | null }[] = []
    if (typeof data.notas === 'string') cambios.push({ col: 'notas', val: data.notas })
    if (data.estado) {
      if (!ESTADOS_PEDIDO.includes(data.estado as EstadoPedido)) {
        return { success: false, error: `Estado inválido: ${data.estado}` }
      }
      if (data.estado === pedido.estado) {
        // mismo estado: sin cambios de estado
      } else if (!(TRANSICIONES[pedido.estado] || []).includes(data.estado as EstadoPedido)) {
        return { success: false, error: `No se puede pasar de "${pedido.estado}" a "${data.estado}"` }
      } else {
        cambios.push({ col: 'estado', val: data.estado })
      }
    }
    if (!cambios.length) return { success: true }

    const setSql = cambios.map((c) => `${c.col} = ?`).join(', ')
    db.prepare(`UPDATE pedidos SET ${setSql} WHERE id = ?`).run(...cambios.map((c) => c.val), data.id)
    return { success: true }
  })
}
