import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'
import { calcularCostosLote } from './costos'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('productor')) {
    return { success: false, error: 'El módulo Productor no está activo en la licencia' }
  }
  return null
}

export function registerLoteHandlers(): void {
  // ===== Listar lotes =====
  handleIpc('productor:lote-list', async (_event, data?: { estado?: string; producto_final_id?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:lote-list', 'productor_lotes_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (data?.estado) { condiciones.push('l.estado = ?'); params.push(data.estado) }
    if (data?.producto_final_id) { condiciones.push('l.producto_final_id = ?'); params.push(data.producto_final_id) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

    return db.prepare(`
      SELECT l.*, c.nombre as cadena_nombre, p.nombre as producto_nombre
      FROM produccion_lote l
      JOIN cadena_produccion c ON c.id = l.cadena_id
      JOIN productos p ON p.id = l.producto_final_id
      ${where}
      ORDER BY l.creado_en DESC
    `).all(...params)
  })

  // ===== Crear lote (produce stock) =====
  handleIpc('productor:lote-create', async (_event, data: {
    cadena_id: number; cantidad_producida: number; notas?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'productor:lote-create', 'productor_lotes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!(data.cantidad_producida > 0)) return { success: false, error: 'La cantidad a producir debe ser mayor a cero' }

    const db = getDatabase()
    const crearLote = db.transaction(() => {
      const cadena = db!.prepare(`
        SELECT c.*, p.nombre as producto_nombre
        FROM cadena_produccion c
        JOIN productos p ON p.id = c.producto_final_id
        WHERE c.id = ? AND c.activo = 1
      `).get(data.cadena_id) as any
      if (!cadena) throw new Error('Cadena de producción no encontrada o inactiva')

      const costos = calcularCostosLote(db!, data.cadena_id)
      if (!costos) throw new Error('Error calculando costos de la cadena')

      // Verificar stock de insumos
      for (const paso of costos.pasos) {
        const cantidadNecesaria = paso.cantidad_unitaria * data.cantidad_producida
        const producto = db!.prepare('SELECT stock, nombre FROM productos WHERE id = ?').get(paso.producto_base_id) as any
        if (!producto) throw new Error(`Producto base ID ${paso.producto_base_id} no encontrado`)
        if ((producto.stock ?? 0) < cantidadNecesaria) {
          throw new Error(`Stock insuficiente de "${producto.nombre}": necesita ${cantidadNecesaria}, tiene ${producto.stock}`)
        }
      }

      // Descargar stock de insumos
      for (const paso of costos.pasos) {
        const cantidadNecesaria = paso.cantidad_unitaria * data.cantidad_producida
        const updateResult = db!.prepare(
          'UPDATE productos SET stock = stock - ? WHERE id = ? AND stock >= ?'
        ).run(cantidadNecesaria, paso.producto_base_id, cantidadNecesaria)
        if (updateResult.changes === 0) {
          throw new Error(`No se pudo descontar stock del producto base ID ${paso.producto_base_id}`)
        }
      }

      // Calcular costos proporcionalmente a la cantidad
      const factor = data.cantidad_producida
      const costoMaterialesLote = costos.costo_materiales * factor
      const costoManoObraLote = costos.costo_mano_obra * factor
      const costoOverheadLote = costos.costo_overhead * factor
      const costoTotalLote = costos.costo_total * factor
      const costoUnitario = costoTotalLote / data.cantidad_producida

      // Crear el lote
      const loteResult = db!.prepare(`
        INSERT INTO produccion_lote (cadena_id, producto_final_id, cantidad_producida,
          costo_materiales, costo_mano_obra, costo_overhead, costo_total, costo_unitario,
          notas, usuario_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        data.cadena_id,
        cadena.producto_final_id,
        data.cantidad_producida,
        Math.round(costoMaterialesLote * 100) / 100,
        Math.round(costoManoObraLote * 100) / 100,
        Math.round(costoOverheadLote * 100) / 100,
        Math.round(costoTotalLote * 100) / 100,
        Math.round(costoUnitario * 100) / 100,
        data.notas?.trim() || null,
        data.usuario_id ?? null,
      )

      const loteId = loteResult.lastInsertRowid

      // Guardar detalle de insumos
      for (const paso of costos.pasos) {
        const cantidadConsumida = paso.cantidad_unitaria * data.cantidad_producida
        const costoTotalPaso = paso.costo_unitario * cantidadConsumida
        db!.prepare(`
          INSERT INTO produccion_lote_detalle (lote_id, producto_base_id, cantidad_consumida, costo_unitario, costo_total)
          VALUES (?, ?, ?, ?, ?)
        `).run(loteId, paso.producto_base_id, cantidadConsumida, paso.costo_unitario, Math.round(costoTotalPaso * 100) / 100)
      }

      return {
        id: loteId,
        costo_total: Math.round(costoTotalLote * 100) / 100,
        costo_unitario: Math.round(costoUnitario * 100) / 100,
        producto: cadena.producto_nombre,
      }
    })

    try {
      return crearLote()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al crear lote' }
    }
  })

  // ===== Completar lote (agrega stock del producto final) =====
  handleIpc('productor:lote-completar', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:lote-completar', 'productor_lotes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail

    const db = getDatabase()
    const completarLote = db.transaction(() => {
      const lote = db!.prepare(`
        SELECT l.*, p.nombre as producto_nombre
        FROM produccion_lote l
        JOIN productos p ON p.id = l.producto_final_id
        WHERE l.id = ?
      `).get(data.id) as any
      if (!lote) throw new Error('Lote no encontrado')
      if (lote.estado !== 'en_proceso') throw new Error(`El lote ya está ${lote.estado}`)

      // Agregar stock del producto final
      db!.prepare("UPDATE productos SET stock = stock + ? WHERE id = ?")
        .run(lote.cantidad_producida, lote.producto_final_id)

      // Marcar lote como completado
      db!.prepare("UPDATE produccion_lote SET estado = 'completado', fecha_fin = datetime('now') WHERE id = ?")
        .run(data.id)

      return {
        success: true as const,
        producto: lote.producto_nombre,
        cantidad: lote.cantidad_producida,
        costo_total: lote.costo_total,
      }
    })

    try {
      return completarLote()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al completar lote' }
    }
  })

  // ===== Cancelar lote (devuelve stock de insumos) =====
  handleIpc('productor:lote-cancelar', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:lote-cancelar', 'productor_lotes_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail

    const db = getDatabase()
    const cancelarLote = db.transaction(() => {
      const lote = db!.prepare(`
        SELECT l.*, p.nombre as producto_nombre
        FROM produccion_lote l
        JOIN productos p ON p.id = l.producto_final_id
        WHERE l.id = ?
      `).get(data.id) as any
      if (!lote) throw new Error('Lote no encontrado')
      if (lote.estado !== 'en_proceso') throw new Error(`El lote ya está ${lote.estado}`)

      // Devolver stock de insumos
      const detalles = db!.prepare('SELECT * FROM produccion_lote_detalle WHERE lote_id = ?').all(data.id) as any[]
      for (const det of detalles) {
        db!.prepare('UPDATE productos SET stock = stock + ? WHERE id = ?')
          .run(det.cantidad_consumida, det.producto_base_id)
      }

      // Marcar lote como cancelado
      db!.prepare("UPDATE produccion_lote SET estado = 'cancelado', fecha_fin = datetime('now') WHERE id = ?")
        .run(data.id)

      return { success: true as const, producto: lote.producto_nombre, insumos_devueltos: detalles.length }
    })

    try {
      return cancelarLote()
    } catch (err: any) {
      return { success: false, error: err?.message || 'Error al cancelar lote' }
    }
  })

  // ===== Estructura de costos de un producto =====
  handleIpc('productor:costo-estructura', async (_event, data: { producto_id: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:costo-estructura', 'productor_lotes_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()

    const cadena = db.prepare(`
      SELECT id FROM cadena_produccion WHERE producto_final_id = ? AND activo = 1 LIMIT 1
    `).get(data.producto_id) as any
    if (!cadena) return { success: false, error: 'No hay cadena de producción para este producto' }

    const costos = calcularCostosLote(db, cadena.id)
    if (!costos) return { success: false, error: 'Error calculando costos' }

    // Buscar los últimos 10 lotes para mostrar historial
    const lotesRecientes = db.prepare(`
      SELECT cantidad_producida, costo_total, costo_unitario, fecha_inicio, fecha_fin, estado
      FROM produccion_lote
      WHERE producto_final_id = ? AND estado = 'completado'
      ORDER BY fecha_fin DESC LIMIT 10
    `).all(data.producto_id)

    return {
      ...costos,
      lotes_recientes: lotesRecientes,
    }
  })
}
