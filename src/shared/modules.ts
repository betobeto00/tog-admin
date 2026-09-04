/**
 * Catálogo de módulos de TOG Platform (modelo LEGO).
 * Cada módulo de la cadena de producción se activa por licencia.
 * Ver docs/MODULOS.md para la visión de producto.
 */

export type ModuleId = 'comercializador' | 'distribuidor' | 'restaurant' | 'productor' | 'procesador' | 'postventa'

export interface ModuleInfo {
  id: ModuleId
  nombre: string
  descripcion: string
  /** Módulos que deben estar activos para que este funcione */
  requiere: ModuleId[]
  /** true = incluido en toda licencia de TOG Admin (no se vende aparte) */
  base: boolean
}

/** El módulo base: es todo lo que TOG Admin incluye hoy (POS, inventario, ventas, compras, caja...) */
export const BASE_MODULE: ModuleInfo = {
  id: 'comercializador',
  nombre: 'Comercializador',
  descripcion: 'POS, inventario, ventas, compras, cotizaciones, caja y reportes. Incluido en toda licencia.',
  requiere: [],
  base: true,
}

/** Módulos adicionales vendibles de la cadena de producción (orden de venta) */
export const ADDON_MODULES: ModuleInfo[] = [
  {
    id: 'distribuidor',
    nombre: 'Distribuidor',
    descripcion: 'Clientes, pedidos, remitos, despachos, rutas y listas de precio para venta a comercios.',
    requiere: ['comercializador'],
    base: false,
  },
  {
    id: 'restaurant',
    nombre: 'Restaurant',
    descripcion: 'Mesas, comandas y cocina para restaurantes y afines. Reusa el catálogo de productos y el cobro del Core.',
    requiere: ['comercializador'],
    base: false,
  },
  {
    id: 'productor',
    nombre: 'Productor',
    descripcion: 'Siembra, costos de campo, estimación de cosecha y logística de acopio.',
    requiere: [],
    base: false,
  },
  {
    id: 'procesador',
    nombre: 'Procesador',
    descripcion: 'Recepción de materia prima, recetas/BOM, transformación, mermas y lotes de salida.',
    requiere: ['productor'],
    base: false,
  },
  {
    id: 'postventa',
    nombre: 'Postventa',
    descripcion: 'Tickets de soporte, devoluciones, garantías y notas de crédito.',
    requiere: ['comercializador'],
    base: false,
  },
]

/** Catálogo completo en orden de la cadena: Productor → Procesador → Comercializador → Distribuidor (+ Postventa) */
export const MODULE_CATALOG: ModuleInfo[] = [
  ADDON_MODULES.find((m) => m.id === 'productor')!,
  ADDON_MODULES.find((m) => m.id === 'procesador')!,
  BASE_MODULE,
  ADDON_MODULES.find((m) => m.id === 'distribuidor')!,
  ADDON_MODULES.find((m) => m.id === 'restaurant')!,
  ADDON_MODULES.find((m) => m.id === 'postventa')!,
]

const VALID_IDS = new Set<string>(MODULE_CATALOG.map((m) => m.id))

/**
 * Normaliza el campo `modules` de una licencia a un array válido de ModuleId.
 * - Ausente/null → [] (licencia v1 sin módulos: solo el módulo base, que es lo que la app incluye hoy).
 * - Descarta ids desconocidos y elimina duplicados.
 */
export function normalizeModules(raw: unknown): ModuleId[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<ModuleId>()
  for (const m of raw) {
    if (typeof m === 'string' && VALID_IDS.has(m)) {
      seen.add(m as ModuleId)
    }
  }
  return Array.from(seen)
}
