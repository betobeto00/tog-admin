import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('postventa')) {
    return { success: false, error: 'El módulo Postventa no está activo en la licencia' }
  }
  return null
}

const ESTADOS_TICKET = new Set(['abierto', 'en_proceso', 'resuelto', 'cerrado'])
const PRIORIDADES = new Set(['baja', 'media', 'alta'])

export function registerPostventaHandlers(): void {
  // ===== Tickets =====
  handleIpc('postventa:tickets-list', async (_event, data?: { estado?: string; venta_id?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'postventa:tickets-list', 'postventa_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (data?.estado) { condiciones.push('t.estado = ?'); params.push(data.estado) }
    if (data?.venta_id) { condiciones.push('t.venta_id = ?'); params.push(data.venta_id) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(`
      SELECT t.*,
        (SELECT COUNT(*) FROM ticket_mensajes m WHERE m.ticket_id = t.id) as mensajes,
        (SELECT COUNT(*) FROM devoluciones d WHERE d.ticket_id = t.id) as devoluciones,
        (SELECT COUNT(*) FROM garantias g WHERE g.ticket_id = t.id) as garantias
      FROM tickets_postventa t
      ${where}
      ORDER BY CASE t.estado WHEN 'abierto' THEN 0 WHEN 'en_proceso' THEN 1 ELSE 2 END, t.creado_en DESC
    `).all(...params)
  })

  handleIpc('postventa:ticket-create', async (_event, data: {
    cliente_nombre: string; cliente_telefono?: string; asunto: string; descripcion?: string
    venta_id?: number; prioridad?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'postventa:ticket-create', 'postventa_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.cliente_nombre?.trim()) return { success: false, error: 'El nombre del cliente es obligatorio' }
    if (!data?.asunto?.trim()) return { success: false, error: 'El asunto es obligatorio' }
    if (data.prioridad && !PRIORIDADES.has(data.prioridad)) {
      return { success: false, error: `Prioridad inválida: ${data.prioridad}` }
    }
    const db = getDatabase()

    const crear = db.transaction(() => {
      const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '')
      const row = db!.prepare('SELECT MAX(numero) as max_num FROM tickets_postventa').get() as any
      // numero global secuencial PV-000001
      const secuencia = (row?.max_num ? parseInt(String(row.max_num).split('-')[1], 10) : 0) + 1
      const numero = `PV-${String(secuencia).padStart(6, '0')}`
      const result = db!.prepare(`
        INSERT INTO tickets_postventa (numero, venta_id, cliente_nombre, cliente_telefono, asunto, descripcion, prioridad, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        numero, data.venta_id || null, data.cliente_nombre.trim(), data.cliente_telefono?.trim() || null,
        data.asunto.trim(), data.descripcion?.trim() || null, data.prioridad || 'media', data.usuario_id ?? null,
      )
      const ticketId = result.lastInsertRowid as number
      if (data.descripcion?.trim()) {
        db!.prepare('INSERT INTO ticket_mensajes (ticket_id, autor, mensaje) VALUES (?, ?, ?)')
          .run(ticketId, 'sistema', data.descripcion.trim())
      }
      return { id: ticketId, numero }
    })

    try {
      return crear()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al crear el ticket' }
    }
  })

  handleIpc('postventa:ticket-update', async (_event, data: { id: number; data: { estado?: string; prioridad?: string; asunto?: string; descripcion?: string }; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'postventa:ticket-update', 'postventa_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const cambios = data.data || {}
    if (cambios.estado && !ESTADOS_TICKET.has(cambios.estado)) {
      return { success: false, error: `Estado inválido: ${cambios.estado}` }
    }
    if (cambios.prioridad && !PRIORIDADES.has(cambios.prioridad)) {
      return { success: false, error: `Prioridad inválida: ${cambios.prioridad}` }
    }
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(cambios)) {
      if (['estado', 'prioridad', 'asunto', 'descripcion'].includes(k)) {
        campos.push(`${k} = ?`)
        valores.push(v)
      }
    }
    if (!campos.length) return { success: false, error: 'Nada que actualizar' }
    if (cambios.estado === 'resuelto' || cambios.estado === 'cerrado') {
      campos.push('cerrado_en = datetime(\'now\')')
    }
    valores.push(data.id)
    db.prepare(`UPDATE tickets_postventa SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    return { success: true }
  })

  handleIpc('postventa:ticket-mensaje', async (_event, data: { id: number; mensaje: string; autor?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'postventa:ticket-mensaje', 'postventa_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.mensaje?.trim()) return { success: false, error: 'El mensaje no puede estar vacío' }
    const db = getDatabase()
    const ticket = db.prepare('SELECT id FROM tickets_postventa WHERE id = ?').get(data.id) as any
    if (!ticket) return { success: false, error: 'Ticket no encontrado' }
    const result = db.prepare('INSERT INTO ticket_mensajes (ticket_id, autor, mensaje) VALUES (?, ?, ?)')
      .run(data.id, data.autor?.trim() || 'usuario', data.mensaje.trim())
    // Un mensaje de seguimiento mueve el ticket a en_proceso si estaba abierto
    db.prepare("UPDATE tickets_postventa SET estado = 'en_proceso' WHERE id = ? AND estado = 'abierto'").run(data.id)
    return { id: result.lastInsertRowid }
  })

  // ===== Devoluciones =====
  handleIpc('postventa:devoluciones-list', async (_event, data?: { venta_id?: number; ticket_id?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'postventa:devoluciones-list', 'postventa_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (data?.venta_id) { condiciones.push('d.venta_id = ?'); params.push(data.venta_id) }
    if (data?.ticket_id) { condiciones.push('d.ticket_id = ?'); params.push(data.ticket_id) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(`
      SELECT d.*, p.nombre as producto_nombre, v.numero_venta
      FROM devoluciones d
      LEFT JOIN productos p ON p.id = d.producto_id
      LEFT JOIN ventas v ON v.id = d.venta_id
      ${where}
      ORDER BY d.creado_en DESC, d.id DESC
    `).all(...params)
  })

  /**
   * Devolución / nota de crédito: registra la salida y repone stock del producto
   * devuelto (best-effort: si el producto ya no existe, igual registra la devolución).
   */
  handleIpc('postventa:devolucion-create', async (_event, data: {
    venta_id?: number; ticket_id?: number; producto_id?: number; cantidad: number
    monto: number; motivo: string; tipo?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'postventa:devolucion-create', 'postventa_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.motivo?.trim()) return { success: false, error: 'El motivo es obligatorio' }
    if (!(data.monto > 0)) return { success: false, error: 'El monto debe ser mayor a cero' }
    const tipo = data.tipo === 'nota_credito' ? 'nota_credito' : 'devolucion'
    const db = getDatabase()

    const registrar = db.transaction(() => {
      const result = db!.prepare(`
        INSERT INTO devoluciones (venta_id, ticket_id, producto_id, cantidad, monto, motivo, tipo, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.venta_id || null, data.ticket_id || null, data.producto_id || null,
        data.cantidad || 1, data.monto, data.motivo.trim(), tipo, data.usuario_id ?? null,
      )
      // Reposición de inventario si hay producto asociado
      if (data.producto_id) {
        db!.prepare("UPDATE productos SET stock = stock + ? WHERE id = ? AND tipo != 'servicio'")
          .run(data.cantidad || 1, data.producto_id)
      }
      return { id: result.lastInsertRowid }
    })

    try {
      return registrar()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al registrar la devolución' }
    }
  })

  // ===== Garantías =====
  handleIpc('postventa:garantias-list', async (_event, data?: { estado?: string; venta_id?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'postventa:garantias-list', 'postventa_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (data?.estado) { condiciones.push('g.estado = ?'); params.push(data.estado) }
    if (data?.venta_id) { condiciones.push('g.venta_id = ?'); params.push(data.venta_id) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''
    return db.prepare(`
      SELECT g.*, p.nombre as producto_nombre, v.numero_venta
      FROM garantias g
      LEFT JOIN productos p ON p.id = g.producto_id
      LEFT JOIN ventas v ON v.id = g.venta_id
      ${where}
      ORDER BY CASE g.estado WHEN 'vigente' THEN 0 ELSE 1 END, g.creado_en DESC
    `).all(...params)
  })

  /** Resolver garantía: repone, reembolsa o rechaza (deja resolución registrada). */
  handleIpc('postventa:garantia-resolver', async (_event, data: {
    id: number; resolucion: 'repuesto' | 'reembolsado' | 'rechazado'; notas?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'postventa:garantia-resolver', 'postventa_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const garantia = db.prepare('SELECT id, estado, producto_id FROM garantias WHERE id = ?').get(data.id) as any
    if (!garantia) return { success: false, error: 'Garantía no encontrada' }
    if (garantia.estado !== 'vigente') return { success: false, error: 'La garantía ya fue resuelta' }

    const resolver = db.transaction(() => {
      const estado = data.resolucion === 'rechazado' ? 'rechazada' : 'resuelta'
      db!.prepare("UPDATE garantias SET estado = ?, resolucion = ?, resuelto_en = datetime('now') WHERE id = ?")
        .run(estado, data.notas?.trim() || data.resolucion, data.id)
      // Si es reposición y hay producto, reponer stock
      if (data.resolucion === 'repuesto' && garantia.producto_id) {
        db!.prepare("UPDATE productos SET stock = stock + 1 WHERE id = ? AND tipo != 'servicio'")
          .run(garantia.producto_id)
      }
      return { success: true as const, estado }
    })

    try {
      return resolver()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al resolver la garantía' }
    }
  })
}
