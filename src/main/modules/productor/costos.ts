/**
 * Cálculo de costos de cadenas de producción con soporte para cadenas encadenadas.
 *
 * Si un insumo de una cadena es un producto que tiene su propia cadena de producción
 * (tipo_produccion = 'intermedio' o 'final'), se calcula recursivamente el costo
 * unitario de esa cadena y se usa como costo del insumo.
 *
 * Se previene recursión infinita rastreando cadenas ya visitadas en el stack.
 */

interface PasoCosto {
  producto_base_id: number
  base_nombre: string
  base_unidad: string
  cantidad: number
  unidad: string
  costo_unitario_override: number | null
  costo_unitario_calculado: number
  costo_total_linea: number
  notas: string | null
  es_cadena_encadenada?: boolean
  cadena_origen_id?: number
}

interface ResumenCostos {
  costo_materiales: number
  costo_mano_obra: number
  costo_overhead: number
  costo_total: number
}

interface ResultadoCostos {
  cadena: any
  pasos: PasoCosto[]
  resumen: ResumenCostos
}

/**
 * Calcula el costo unitario de un producto buscando su cadena de producción activa.
 * Retorna null si no tiene cadena (es materia prima base).
 */
function costoUnitarioPorCadena(db: any, productoId: number, cadenasVisitadas: Set<number>): number | null {
  // Buscar cadena activa de este producto
  const cadena = db.prepare(`
    SELECT id FROM cadena_produccion WHERE producto_final_id = ? AND activo = 1 LIMIT 1
  `).get(productoId) as any

  if (!cadena) return null

  // Prevenir recursión infinita
  if (cadenasVisitadas.has(cadena.id)) return null
  cadenasVisitadas.add(cadena.id)

  // Calcular el costo unitario de esa cadena recursivamente
  const resultado = calcularCostosCadena(db, cadena.id, cadenasVisitadas)
  if (!resultado) return null

  // El costo unitario es el costo total de la cadena (ya es por 1 unidad del producto final)
  return resultado.resumen.costo_total
}

/**
 * Calcula el costo total de una cadena a partir de sus pasos y configuración.
 * Si un paso usa un producto intermedio con cadena propia, resuelve recursivamente.
 */
export function calcularCostosCadena(
  db: any,
  cadenaId: number,
  cadenasVisitadas?: Set<number>,
): ResultadoCostos | null {
  const visited = cadenasVisitadas || new Set<number>()

  const cadena = db.prepare(`
    SELECT c.*, p.nombre as producto_nombre, p.precio_compra as producto_precio_compra,
           p.tipo_produccion
    FROM cadena_produccion c
    JOIN productos p ON p.id = c.producto_final_id
    WHERE c.id = ?
  `).get(cadenaId) as any

  if (!cadena) return null

  const pasos = db.prepare(`
    SELECT cp.*, pb.nombre as base_nombre, pb.precio_compra as base_precio_compra,
           pb.unidad as base_unidad, pb.tipo_produccion as base_tipo_produccion
    FROM cadena_paso cp
    JOIN productos pb ON pb.id = cp.producto_base_id
    WHERE cp.cadena_id = ?
    ORDER BY cp.orden
  `).all(cadenaId) as any[]

  let costoMateriales = 0
  const pasosConCosto: PasoCosto[] = pasos.map((p: any) => {
    let costoUnitario: number
    let esCadenaEncadenada = false
    let cadenaOrigenId: number | undefined

    // Si hay override explícito, usarlo
    if (p.costo_unitario_override != null) {
      costoUnitario = p.costo_unitario_override
    } else {
      // Intentar resolver por cadena de producción del insumo
      const costoCadena = costoUnitarioPorCadena(db, p.producto_base_id, new Set(visited))
      if (costoCadena != null) {
        costoUnitario = costoCadena
        esCadenaEncadenada = true
        const cadenaInsumo = db.prepare(
          'SELECT id FROM cadena_produccion WHERE producto_final_id = ? AND activo = 1 LIMIT 1'
        ).get(p.producto_base_id) as any
        cadenaOrigenId = cadenaInsumo?.id
      } else {
        // Fallback: usar precio_compra del producto
        costoUnitario = p.base_precio_compra ?? 0
      }
    }

    const costoTotal = costoUnitario * p.cantidad
    costoMateriales += costoTotal

    return {
      producto_base_id: p.producto_base_id,
      base_nombre: p.base_nombre,
      base_unidad: p.base_unidad,
      cantidad: p.cantidad,
      unidad: p.unidad,
      costo_unitario_override: p.costo_unitario_override,
      costo_unitario_calculado: Math.round(costoUnitario * 10000) / 10000,
      costo_total_linea: Math.round(costoTotal * 10000) / 10000,
      notas: p.notas,
      es_cadena_encadenada: esCadenaEncadenada || undefined,
      cadena_origen_id: cadenaOrigenId,
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

/**
 * Versión ligera para lotes: retorna solo pasos + resumen sin el objeto cadena.
 */
export function calcularCostosLote(db: any, cadenaId: number) {
  const resultado = calcularCostosCadena(db, cadenaId)
  if (!resultado) return null

  return {
    pasos: resultado.pasos.map(p => ({
      producto_base_id: p.producto_base_id,
      cantidad_unitaria: p.cantidad,
      costo_unitario: p.costo_unitario_calculado,
      costo_total: p.costo_total_linea,
      es_cadena_encadenada: p.es_cadena_encadenada,
    })),
    costo_materiales: resultado.resumen.costo_materiales,
    costo_mano_obra: resultado.resumen.costo_mano_obra,
    costo_overhead: resultado.resumen.costo_overhead,
    costo_total: resultado.resumen.costo_total,
  }
}
