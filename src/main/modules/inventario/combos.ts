import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import type { Database } from 'better-sqlite3'

// ============================================================
// PRODUCTOS COMPUESTOS / COMBOS
// Un producto es "compuesto" cuando tiene filas en
// producto_componentes. Su costo real se calcula desde sus
// componentes (recursivo) y al venderlo se descuenta el stock
// de los componentes (hojas), no el del combo en sí.
// ============================================================

interface ComponenteDirecto {
  componente_id: number
  cantidad: number
}

function getDb(): Database {
  return getDatabase() as unknown as Database
}

export function getComponentesDirectos(db: any, productoId: number): ComponenteDirecto[] {
  return (db.prepare(
    'SELECT componente_id, cantidad FROM producto_componentes WHERE producto_id = ? ORDER BY id',
  ).all(productoId) as ComponenteDirecto[]).map((r) => ({ ...r, cantidad: Number(r.cantidad) }))
}

export function esCombo(db: any, productoId: number): boolean {
  const row = db.prepare('SELECT 1 FROM producto_componentes WHERE producto_id = ? LIMIT 1').get(productoId)
  return !!row
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Costo real de un producto. Si tiene componentes, es la suma de
 * (costo del componente × cantidad), recursivo. Si no, es su precio_compra.
 */
export function costoReal(db: any, productoId: number, seen: Set<number> = new Set()): number {
  if (seen.has(productoId)) return 0 // ciclo defensivo
  seen.add(productoId)
  const comps = getComponentesDirectos(db, productoId)
  if (comps.length === 0) {
    const p = db.prepare('SELECT precio_compra FROM productos WHERE id = ?').get(productoId) as
      | { precio_compra: number }
      | undefined
    return p ? round2(Number(p.precio_compra) || 0) : 0
  }
  let total = 0
  for (const c of comps) {
    total += costoReal(db, c.componente_id, seen) * c.cantidad
  }
  return round2(total)
}

/** Costo + componentes (con nombre y costo unitario) para mostrar en UI. */
export function detalleCombo(db: any, productoId: number): { costo_real: number; componentes: any[] } {
  const costo = costoReal(db, productoId)
  const filas = db.prepare(`
    SELECT pc.componente_id, pc.cantidad, p.nombre, p.tipo, p.precio_compra
    FROM producto_componentes pc
    JOIN productos p ON p.id = pc.componente_id
    WHERE pc.producto_id = ?
    ORDER BY pc.id
  `).all(productoId) as any[]
  const componentes = filas.map((f) => ({
    componente_id: f.componente_id,
    cantidad: Number(f.cantidad),
    nombre: f.nombre,
    tipo: f.tipo,
    costo_unitario: costoReal(db, f.componente_id),
  }))
  return { costo_real: costo, componentes }
}

/**
 * Explota un producto compuesto a sus hojas (productos sin componentes).
 * Devuelve [{ producto_id, nombre, tipo, cantidad }] con la cantidad total
 * consumida por `cantidad` unidades del combo. Si el producto no tiene
 * componentes, devuelve él mismo como hoja.
 */
export function explotar(
  db: any,
  productoId: number,
  cantidad: number,
  seen: Set<number> = new Set(),
): { producto_id: number; nombre: string; tipo: string; cantidad: number }[] {
  if (seen.has(productoId)) return []
  seen.add(productoId)
  const comps = getComponentesDirectos(db, productoId)
  if (comps.length === 0) {
    const p = db.prepare('SELECT nombre, tipo FROM productos WHERE id = ?').get(productoId) as
      | { nombre: string; tipo: string }
      | undefined
    if (!p) return []
    return [{ producto_id: productoId, nombre: p.nombre, tipo: p.tipo, cantidad }]
  }
  const hojas: { producto_id: number; nombre: string; tipo: string; cantidad: number }[] = []
  for (const c of comps) {
    const sub = explotar(db, c.componente_id, cantidad * c.cantidad, seen)
    hojas.push(...sub)
  }
  return hojas
}

/**
 * Disponibilidad: cuántas unidades del combo se pueden vender hoy con el
 * stock actual de sus hojas (min de floor(stock_hoja / cantidad_hoja)).
 */
export function disponibilidad(db: any, productoId: number): number {
  const comps = getComponentesDirectos(db, productoId)
  if (comps.length === 0) {
    const p = db.prepare('SELECT stock, tipo FROM productos WHERE id = ?').get(productoId) as
      | { stock: number; tipo: string }
      | undefined
    if (!p || p.tipo === 'servicio') return 0
    return Math.floor(Number(p.stock) || 0)
  }
  // hojas por UNA unidad del combo
  const hojas = explotar(db, productoId, 1)
  let min = Infinity
  for (const h of hojas) {
    if (h.tipo === 'servicio') continue
    const stock = (db.prepare('SELECT stock FROM productos WHERE id = ?').get(h.producto_id) as any)?.stock ?? 0
    min = Math.min(min, Math.floor(Number(stock) / h.cantidad))
  }
  return min === Infinity ? 0 : Math.max(0, min)
}

/** Agrupa hojas repetidas sumando cantidades (un combo puede usar el mismo componente en varias ramas). */
export function agruparHojas(
  hojas: { producto_id: number; nombre: string; tipo: string; cantidad: number }[],
): { producto_id: number; nombre: string; tipo: string; cantidad: number }[] {
  const map = new Map<number, { producto_id: number; nombre: string; tipo: string; cantidad: number }>()
  for (const h of hojas) {
    const exist = map.get(h.producto_id)
    if (exist) exist.cantidad += h.cantidad
    else map.set(h.producto_id, { ...h })
  }
  return [...map.values()]
}

// ============================================================
// VALIDACIÓN AL GUARDAR
// ============================================================

/** Evita ciclos: componente no puede ser (transitivamente) el mismo producto. */
function creaCiclo(db: any, productoId: number, componenteId: number): boolean {
  if (productoId === componenteId) return true
  const visitados = new Set<number>([productoId])
  const pila = [componenteId]
  while (pila.length) {
    const actual = pila.pop()!
    if (visitados.has(actual)) return true
    visitados.add(actual)
    const hijos = db.prepare('SELECT componente_id FROM producto_componentes WHERE producto_id = ?').all(actual) as any[]
    for (const h of hijos) pila.push(h.componente_id)
  }
  return false
}

export function registerCombosHandlers(): void {
  // Devuelve componentes + costo real de un producto compuesto
  ipcMain.handle('combos:get', async (_event, data: { producto_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'combos:get', 'inventario_edit')
    if (fail) return fail
    const db = getDb()
    const p = db.prepare('SELECT id FROM productos WHERE id = ?').get(data.producto_id)
    if (!p) return { success: false, error: 'Producto no encontrado' }
    return { success: true, ...detalleCombo(db, data.producto_id) }
  })

  // Reemplaza la lista de componentes de un producto (vacía = ya no es combo)
  ipcMain.handle('combos:guardar', async (_event, data: {
    producto_id: number
    componentes: { componente_id: number; cantidad: number }[]
    usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'combos:guardar', 'inventario_edit')
    if (fail) return fail
    const db = getDb()
    const producto = db.prepare('SELECT id, tipo FROM productos WHERE id = ?').get(data.producto_id) as any
    if (!producto) return { success: false, error: 'Producto no encontrado' }
    if (producto.tipo === 'servicio') {
      return { success: false, error: 'Un servicio no puede tener componentes' }
    }

    const lista = (data.componentes || []).slice(0, 200)
    const unicos = new Map<number, number>()
    for (const c of lista) {
      if (!Number.isFinite(c.cantidad) || c.cantidad <= 0) {
        return { success: false, error: 'La cantidad de cada componente debe ser mayor a 0' }
      }
      if (unicos.has(c.componente_id)) {
        return { success: false, error: 'No se puede repetir el mismo componente' }
      }
      unicos.set(c.componente_id, c.cantidad)
    }

    for (const [componenteId] of unicos) {
      const comp = db.prepare('SELECT id, tipo, activo FROM productos WHERE id = ?').get(componenteId) as any
      if (!comp || comp.activo !== 1) {
        return { success: false, error: `Componente con ID ${componenteId} no existe o está inactivo` }
      }
      if (creaCiclo(db, data.producto_id, componenteId)) {
        return { success: false, error: 'El componente no puede contener (directa o indirectamente) al propio producto' }
      }
    }

    const guardar = db.transaction(() => {
      db.prepare('DELETE FROM producto_componentes WHERE producto_id = ?').run(data.producto_id)
      const insert = db.prepare(
        'INSERT INTO producto_componentes (producto_id, componente_id, cantidad) VALUES (?, ?, ?)',
      )
      for (const [componenteId, cantidad] of unicos) {
        insert.run(data.producto_id, componenteId, cantidad)
      }
    })
    guardar()

    const { costo_real } = detalleCombo(db, data.producto_id)
    return { success: true, costo_real, componentes: unicos.size }
  })
}
