import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('productor')) {
    return { success: false, error: 'El módulo Productor no está activo en la licencia' }
  }
  return null
}

/** Calcula el costo total de una cadena a partir de sus pasos y configuración. */
function calcularCostosCadena(db: any, cadenaId: number) {
  const cadena = db.prepare(`
    SELECT c.*, p.nombre as producto_nombre, p.precio_compra as producto_precio_compra
    FROM cadena_produccion c
    JOIN productos p ON p.id = c.producto_final_id
    WHERE c.id = ?
  `).get(cadenaId) as any

  if (!cadena) return null

  const pasos = db.prepare(`
    SELECT cp.*, pb.nombre as base_nombre, pb.precio_compra as base_precio_compra,
           pb.unidad as base_unidad
    FROM cadena_paso cp
    JOIN productos pb ON pb.id = cp.producto_base_id
    WHERE cp.cadena_id = ?
    ORDER BY cp.orden
  `).all(cadenaId) as any[]

  let costoMateriales = 0
  const pasosConCosto = pasos.map((p: any) => {
    const costoUnitario = p.costo_unitario_override ?? p.base_precio_compra ?? 0
    const costoTotal = costoUnitario * p.cantidad
    costoMateriales += costoTotal
    return {
      ...p,
      costo_unitario_calculado: Math.round(costoUnitario * 10000) / 10000,
      costo_total_linea: Math.round(costoTotal * 10000) / 10000,
    }
  })

  const tiempoHoras = (cadena.tiempo_estimado_minutos || 0) / 60
  const costoManoObra = tiempoHoras * (cadena.costo_mano_obra_hora || 0)
  const costoOverhead = costoMateriales * ((cadena.overhead_porcentaje || 0) / 100)
  const costoTotal = costoMateriales + costoManoObra + costoOverhead

  return {
    cadena,
    pasos: pasosConCosto,
    resumen: {
      costo_materiales: Math.round(costoMateriales * 100) / 100,
      costo_mano_obra: Math.round(costoManoObra * 100) / 100,
      costo_overhead: Math.round(costoOverhead * 100) / 100,
      costo_total: Math.round(costoTotal * 100) / 100,
    },
  }
}

export function registerCadenaHandlers(): void {
  // ===== Listar cadenas de producción =====
  handleIpc('productor:cadena-list', async (_event, data?: { producto_final_id?: number; incluirInactivos?: boolean; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-list', 'productor_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const condiciones: string[] = []
    const params: any[] = []
    if (!data?.incluirInactivos) condiciones.push('c.activo = 1')
    if (data?.producto_final_id) { condiciones.push('c.producto_final_id = ?'); params.push(data.producto_final_id) }
    const where = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : ''

    const cadenas = db.prepare(`
      SELECT c.*, p.nombre as producto_nombre, p.tipo_produccion,
        (SELECT COUNT(*) FROM cadena_paso cp WHERE cp.cadena_id = c.id) as pasos_count
      FROM cadena_produccion c
      JOIN productos p ON p.id = c.producto_final_id
      ${where}
      ORDER BY c.nombre
    `).all(...params) as any[]

    // Calcular costo total para cada cadena
    return cadenas.map((c: any) => {
      const costos = calcularCostosCadena(db, c.id)
      return {
        ...c,
        costo_materiales: costos?.resumen.costo_materiales ?? 0,
        costo_mano_obra: costos?.resumen.costo_mano_obra ?? 0,
        costo_overhead: costos?.resumen.costo_overhead ?? 0,
        costo_total: costos?.resumen.costo_total ?? 0,
      }
    })
  })

  // ===== Detalle de cadena =====
  handleIpc('productor:cadena-detail', async (_event, data: { id: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-detail', 'productor_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const result = calcularCostosCadena(db, data.id)
    if (!result) return { success: false, error: 'Cadena no encontrada' }
    return result
  })

  // ===== Crear cadena =====
  handleIpc('productor:cadena-create', async (_event, data: {
    producto_final_id: number; nombre: string; descripcion?: string
    tiempo_estimado_minutos?: number; costo_mano_obra_hora?: number
    overhead_porcentaje?: number; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-create', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.nombre?.trim()) return { success: false, error: 'El nombre de la cadena es obligatorio' }
    const db = getDatabase()

    // Verificar que el producto final exista
    const producto = db.prepare('SELECT id, tipo_produccion FROM productos WHERE id = ?').get(data.producto_final_id) as any
    if (!producto) return { success: false, error: 'Producto final no encontrado' }

    // Si el producto no tiene tipo_produccion, marcarlo como 'final'
    if (!producto.tipo_produccion) {
      db.prepare("UPDATE productos SET tipo_produccion = 'final' WHERE id = ? AND tipo_produccion IS NULL").run(data.producto_final_id)
    }

    const result = db.prepare(`
      INSERT INTO cadena_produccion (producto_final_id, nombre, descripcion, tiempo_estimado_minutos, costo_mano_obra_hora, overhead_porcentaje)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.producto_final_id,
      data.nombre.trim(),
      data.descripcion?.trim() || null,
      data.tiempo_estimado_minutos || 0,
      data.costo_mano_obra_hora || 0,
      data.overhead_porcentaje || 0,
    )
    return { id: result.lastInsertRowid }
  })

  // ===== Actualizar cadena =====
  handleIpc('productor:cadena-update', async (_event, data: {
    id: number; data: {
      nombre?: string; descripcion?: string; tiempo_estimado_minutos?: number
      costo_mano_obra_hora?: number; overhead_porcentaje?: number; activo?: number
    }; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-update', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(data.data || {})) {
      if (['nombre', 'descripcion', 'tiempo_estimado_minutos', 'costo_mano_obra_hora', 'overhead_porcentaje', 'activo'].includes(k)) {
        campos.push(`${k} = ?`)
        valores.push(v)
      }
    }
    if (!campos.length) return { success: false, error: 'Nada que actualizar' }
    campos.push("actualizado_en = datetime('now')")
    valores.push(data.id)
    db.prepare(`UPDATE cadena_produccion SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    return { success: true }
  })

  // ===== Eliminar cadena =====
  handleIpc('productor:cadena-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-delete', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    // No se puede eliminar si tiene lotes asociados
    const lotes = db.prepare('SELECT COUNT(*) as cnt FROM produccion_lote WHERE cadena_id = ?').get(data.id) as any
    if (lotes?.cnt > 0) return { success: false, error: 'No se puede eliminar: tiene lotes de producción asociados. Desactívela en su lugar.' }
    db.prepare('DELETE FROM cadena_paso WHERE cadena_id = ?').run(data.id)
    db.prepare('DELETE FROM cadena_produccion WHERE id = ?').run(data.id)
    return { success: true }
  })

  // ===== Pasos de cadena =====
  handleIpc('productor:cadena-paso-add', async (_event, data: {
    cadena_id: number; producto_base_id: number; cantidad: number
    unidad?: string; costo_unitario_override?: number; notas?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-paso-add', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!(data.cantidad > 0)) return { success: false, error: 'La cantidad debe ser mayor a cero' }
    const db = getDatabase()

    const cadena = db.prepare('SELECT id FROM cadena_produccion WHERE id = ?').get(data.cadena_id) as any
    if (!cadena) return { success: false, error: 'Cadena no encontrada' }

    const producto = db.prepare('SELECT id, nombre FROM productos WHERE id = ?').get(data.producto_base_id) as any
    if (!producto) return { success: false, error: 'Producto base no encontrado' }

    // Obtener el siguiente orden
    const maxOrden = db.prepare('SELECT MAX(orden) as max_orden FROM cadena_paso WHERE cadena_id = ?').get(data.cadena_id) as any
    const siguienteOrden = (maxOrden?.max_orden ?? 0) + 1

    const result = db.prepare(`
      INSERT INTO cadena_paso (cadena_id, orden, producto_base_id, cantidad, unidad, costo_unitario_override, notas)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.cadena_id,
      siguienteOrden,
      data.producto_base_id,
      data.cantidad,
      data.unidad?.trim() || 'unidad',
      data.costo_unitario_override ?? null,
      data.notas?.trim() || null,
    )
    return { id: result.lastInsertRowid, orden: siguienteOrden }
  })

  handleIpc('productor:cadena-paso-update', async (_event, data: {
    id: number; data: { cantidad?: number; unidad?: string; costo_unitario_override?: number; notas?: string; orden?: number }; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-paso-update', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const campos: string[] = []
    const valores: any[] = []
    for (const [k, v] of Object.entries(data.data || {})) {
      if (['cantidad', 'unidad', 'costo_unitario_override', 'notas', 'orden'].includes(k)) {
        campos.push(`${k} = ?`)
        valores.push(v)
      }
    }
    if (!campos.length) return { success: false, error: 'Nada que actualizar' }
    valores.push(data.id)
    db.prepare(`UPDATE cadena_paso SET ${campos.join(', ')} WHERE id = ?`).run(...valores)
    return { success: true }
  })

  handleIpc('productor:cadena-paso-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:cadena-paso-delete', 'productor_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    db.prepare('DELETE FROM cadena_paso WHERE id = ?').run(data.id)
    return { success: true }
  })

  // ===== Precio recomendado =====
  handleIpc('productor:precio-recomendado', async (_event, data: { producto_id: number; margen_porcentaje?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productor:precio-recomendado', 'productor_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()

    // Buscar la cadena activa de este producto
    const cadena = db.prepare(`
      SELECT id FROM cadena_produccion WHERE producto_final_id = ? AND activo = 1 LIMIT 1
    `).get(data.producto_id) as any
    if (!cadena) return { success: false, error: 'No hay cadena de producción para este producto' }

    const costos = calcularCostosCadena(db, cadena.id)
    if (!costos) return { success: false, error: 'Error calculando costos' }

    const margen = data.margen_porcentaje ?? 50
    const precioRecomendado = costos.resumen.costo_total * (1 + margen / 100)

    return {
      costo_total: costos.resumen.costo_total,
      margen_porcentaje: margen,
      precio_recomendado: Math.round(precioRecomendado * 100) / 100,
      desglose: costos.resumen,
    }
  })
}
