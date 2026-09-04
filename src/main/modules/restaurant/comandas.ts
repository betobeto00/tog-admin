import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'
import { createVenta } from '../ventas/ventas'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('restaurant')) {
    return { success: false, error: 'El módulo Restaurant no está activo en la licencia' }
  }
  return null
}

export function registerComandasHandlers(): void {
  handleIpc('comandas:list', async (_event, data?: { activas?: boolean; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'comandas:list', 'restaurant_comandas_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const activas = data?.activas !== false
    const estadoFilter = activas ? "c.estado IN ('abierta','en_cocina','servida')" : '1=1'
    const comandas = db.prepare(`
      SELECT c.*, m.nombre as mesa_nombre,
        (SELECT COALESCE(SUM(cd.subtotal), 0) FROM comanda_detalles cd
          WHERE cd.comanda_id = c.id AND cd.estado NOT IN ('cancelado')) as total
      FROM comandas c
      JOIN mesas m ON m.id = c.mesa_id
      WHERE ${estadoFilter}
      ORDER BY c.id DESC
    `).all() as any[]
    const detallesStmt = db.prepare(`
      SELECT cd.*, p.nombre as producto_nombre
      FROM comanda_detalles cd
      LEFT JOIN productos p ON p.id = cd.producto_id
      WHERE cd.comanda_id = ?
      ORDER BY cd.id
    `)
    for (const c of comandas) {
      c.detalles = detallesStmt.all(c.id)
    }
    return comandas
  })

  handleIpc('comandas:open', async (_event, data: { mesa_id: number; notas?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'comandas:open', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const mesa = db.prepare('SELECT id, nombre, estado FROM mesas WHERE id = ? AND activo = 1').get(data.mesa_id) as any
    if (!mesa) return { success: false, error: 'Mesa no encontrada' }
    if (mesa.estado !== 'libre') {
      return { success: false, error: `La mesa "${mesa.nombre}" ya está ocupada` }
    }
    const openComanda = db.transaction(() => {
      const result = db!.prepare('INSERT INTO comandas (mesa_id, usuario_id, notas) VALUES (?, ?, ?)')
        .run(data.mesa_id, data.usuario_id, data.notas || null)
      db!.prepare("UPDATE mesas SET estado = 'ocupada' WHERE id = ?").run(data.mesa_id)
      return { comanda_id: result.lastInsertRowid }
    })
    return openComanda()
  })

  handleIpc('comandas:add-item', async (_event, data: {
    comanda_id: number
    producto_id?: number | null
    descripcion?: string
    cantidad: number
    precio_unitario?: number
    notas?: string
    usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'comandas:add-item', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const comanda = db.prepare("SELECT id FROM comandas WHERE id = ? AND estado NOT IN ('cobrada','anulada')").get(data.comanda_id) as any
    if (!comanda) return { success: false, error: 'Comanda no encontrada o ya cobrada' }
    if (!data.cantidad || data.cantidad <= 0) return { success: false, error: 'La cantidad debe ser mayor a 0' }
    let descripcion = data.descripcion
    let precio = data.precio_unitario ?? 0
    if (data.producto_id) {
      const producto = db.prepare('SELECT id, nombre, precio_venta FROM productos WHERE id = ? AND activo = 1').get(data.producto_id) as any
      if (!producto) return { success: false, error: 'Producto no encontrado' }
      descripcion = descripcion || producto.nombre
      if (!(precio > 0)) precio = producto.precio_venta
    }
    if (!descripcion?.trim()) return { success: false, error: 'Indica el producto o una descripción' }
    const result = db.prepare(`
      INSERT INTO comanda_detalles (comanda_id, producto_id, descripcion, cantidad, precio_unitario, subtotal, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(data.comanda_id, data.producto_id || null, descripcion.trim(), data.cantidad, precio, precio * data.cantidad, data.notas || null)
    return { id: result.lastInsertRowid }
  })

  handleIpc('comandas:update-item', async (_event, data: {
    comanda_id: number
    detalle_id: number
    data: { cantidad?: number; notas?: string; estado?: string }
    usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'comandas:update-item', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const d = data.data
    if (d.cantidad !== undefined) {
      if (d.cantidad <= 0) return { success: false, error: 'La cantidad debe ser mayor a 0' }
      const detalle = db.prepare('SELECT precio_unitario FROM comanda_detalles WHERE id = ?').get(data.detalle_id) as any
      if (!detalle) return { success: false, error: 'Ítem no encontrado' }
      db.prepare('UPDATE comanda_detalles SET cantidad = ?, subtotal = ? WHERE id = ?')
        .run(d.cantidad, detalle.precio_unitario * d.cantidad, data.detalle_id)
    }
    if (d.notas !== undefined) {
      db.prepare('UPDATE comanda_detalles SET notas = ? WHERE id = ?').run(d.notas || null, data.detalle_id)
    }
    if (d.estado !== undefined) {
      const allowed = ['pendiente', 'en_preparacion', 'listo', 'servido', 'cancelado']
      if (!allowed.includes(d.estado)) return { success: false, error: 'Estado inválido del ítem' }
      db.prepare('UPDATE comanda_detalles SET estado = ? WHERE id = ?').run(d.estado, data.detalle_id)
      actualizarEstadoComanda(db, data.comanda_id)
    }
    return { success: true }
  })

  handleIpc('comandas:remove-item', async (_event, data: { comanda_id: number; detalle_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'comandas:remove-item', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const detalle = db.prepare('SELECT id, estado FROM comanda_detalles WHERE id = ?').get(data.detalle_id) as any
    if (!detalle) return { success: false, error: 'Ítem no encontrado' }
    if (detalle.estado === 'pendiente') {
      db.prepare('DELETE FROM comanda_detalles WHERE id = ?').run(data.detalle_id)
    } else {
      db.prepare("UPDATE comanda_detalles SET estado = 'cancelado' WHERE id = ?").run(data.detalle_id)
    }
    return { success: true }
  })

  handleIpc('comandas:send-kitchen', async (_event, data: { comanda_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'comandas:send-kitchen', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const comanda = db.prepare("SELECT id FROM comandas WHERE id = ? AND estado NOT IN ('cobrada','anulada')").get(data.comanda_id) as any
    if (!comanda) return { success: false, error: 'Comanda no encontrada o ya cobrada' }
    db.prepare("UPDATE comandas SET estado = 'en_cocina' WHERE id = ?").run(data.comanda_id)
    return { success: true }
  })

  handleIpc('comandas:mark-item', async (_event, data: { comanda_id: number; detalle_id: number; estado: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'comandas:mark-item', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const allowed = ['pendiente', 'en_preparacion', 'listo', 'servido', 'cancelado']
    if (!allowed.includes(data.estado)) return { success: false, error: 'Estado inválido del ítem' }
    const detalle = db.prepare('SELECT id FROM comanda_detalles WHERE id = ?').get(data.detalle_id) as any
    if (!detalle) return { success: false, error: 'Ítem no encontrado' }
    db.prepare('UPDATE comanda_detalles SET estado = ? WHERE id = ?').run(data.estado, data.detalle_id)
    actualizarEstadoComanda(db, data.comanda_id)
    return { success: true }
  })

  handleIpc('comandas:move', async (_event, data: { comanda_id: number; mesa_destino_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'comandas:move', 'restaurant_comandas_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const comanda = db.prepare('SELECT id, mesa_id FROM comandas WHERE id = ? AND estado NOT IN (?, ?)').get(data.comanda_id, 'cobrada', 'anulada') as any
    if (!comanda) return { success: false, error: 'Comanda no encontrada o ya cobrada' }
    if (comanda.mesa_id === data.mesa_destino_id) return { success: false, error: 'La mesa destino es la misma' }
    const destino = db.prepare('SELECT id, nombre, estado FROM mesas WHERE id = ? AND activo = 1').get(data.mesa_destino_id) as any
    if (!destino) return { success: false, error: 'Mesa destino no encontrada' }
    if (destino.estado !== 'libre') return { success: false, error: `La mesa "${destino.nombre}" no está libre` }
    const moveComanda = db.transaction(() => {
      db!.prepare('UPDATE comandas SET mesa_id = ? WHERE id = ?').run(data.mesa_destino_id, data.comanda_id)
      db!.prepare("UPDATE mesas SET estado = 'libre' WHERE id = ? AND NOT EXISTS (SELECT 1 FROM comandas c WHERE c.mesa_id = mesas.id AND c.estado NOT IN ('cobrada','anulada'))")
        .run(comanda.mesa_id)
      db!.prepare("UPDATE mesas SET estado = 'ocupada' WHERE id = ?").run(data.mesa_destino_id)
      return { success: true }
    })
    return moveComanda()
  })

  handleIpc('comandas:checkout', async (_event, data: {
    comanda_id: number
    metodo_pago: string
    monto_pagado?: number
    notas?: string
    deudor_nombre?: string
    usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'comandas:checkout', 'restaurant_comandas_edit')
    if (fail) return fail
    const failPos = checkPermissionOrFail(data, 'comandas:checkout', 'pos_access')
    if (failPos) return failPos
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const comanda = db.prepare("SELECT * FROM comandas WHERE id = ? AND estado NOT IN ('cobrada','anulada')").get(data.comanda_id) as any
    if (!comanda) return { success: false, error: 'Comanda no encontrada o ya cobrada' }
    const detalles = db.prepare(`
      SELECT id, producto_id, descripcion, cantidad, precio_unitario, subtotal, estado
      FROM comanda_detalles WHERE comanda_id = ? AND estado IN ('listo','servido')
    `).all(data.comanda_id) as any[]
    if (detalles.length === 0) {
      return { success: false, error: 'No hay ítems servidos o listos para cobrar en esta comanda' }
    }

    const subtotal = detalles.reduce((acc, d) => acc + Number(d.subtotal || 0), 0)
    const total = subtotal
    const monto = Number(data.monto_pagado) || total

    const ventaResult = createVenta({
      usuario_id: data.usuario_id,
      subtotal,
      impuesto: 0,
      descuento: 0,
      total,
      metodo_pago: data.metodo_pago,
      monto_pagado: monto,
      cambio: Math.max(0, monto - total),
      notas: data.notas ? `Restaurant (comanda #${data.comanda_id}): ${data.notas}` : undefined,
      deudor_nombre: data.metodo_pago === 'fiado' ? data.deudor_nombre : undefined,
      detalles: detalles.map((d) => ({
        producto_id: d.producto_id,
        descripcion: d.descripcion,
        cantidad: d.cantidad,
        precio_unitario: d.precio_unitario,
        descuento: 0,
        subtotal: d.subtotal,
      })),
    })
    if (!ventaResult.success) return ventaResult

    const cerrarComanda = db.transaction(() => {
      db!.prepare("UPDATE comandas SET estado = 'cobrada', venta_id = ?, cerrado_en = datetime('now') WHERE id = ?")
        .run(ventaResult.id, data.comanda_id)
      // Los ítems no consumidos (pendientes/en preparación) se descartan al cobrar
      db!.prepare("UPDATE comanda_detalles SET estado = 'cancelado' WHERE comanda_id = ? AND estado NOT IN ('servido','listo','cancelado')")
        .run(data.comanda_id)
      db!.prepare("UPDATE mesas SET estado = 'libre' WHERE id = ?").run(comanda.mesa_id)
      return { success: true }
    })
    cerrarComanda()

    return { success: true, venta_id: ventaResult.id, numero_venta: ventaResult.numero_venta }
  })
}

function actualizarEstadoComanda(db: any, comandaId: number): void {
  const restantes = db.prepare(`
    SELECT
      COUNT(*) as total,
      COALESCE(SUM(CASE WHEN estado IN ('pendiente','en_preparacion','listo') THEN 1 ELSE 0 END), 0) as en_proceso
    FROM comanda_detalles WHERE comanda_id = ?
  `).get(comandaId) as { total: number; en_proceso: number }
  if (restantes.total > 0 && restantes.en_proceso === 0) {
    // Todo servido o cancelado: la comanda queda servida y lista para cobrar
    db.prepare("UPDATE comandas SET estado = 'servida' WHERE id = ?").run(comandaId)
  } else if (restantes.total > 0) {
    db.prepare("UPDATE comandas SET estado = 'en_cocina' WHERE id = ?").run(comandaId)
  }
}