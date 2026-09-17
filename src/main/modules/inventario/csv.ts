import { dialog } from 'electron'
import { handleIpc } from '../../core/auth/ipc-guard'
import fs from 'fs'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { checkPermissionOrFail } from '../../core/auth'

// Tope defensivo: un CSV de productos legítimo no se acerca a este tamaño, y
// evita que una ruta apuntada a un archivo enorme congele el proceso main.
const CSV_MAX_BYTES = 20 * 1024 * 1024

export function registerProductosCsvHandlers(): void {
  handleIpc('productos:export-csv', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'productos:export-csv', 'reportes_export')
    if (fail) return fail
    try {
      const result = await dialog.showSaveDialog({
        title: 'Exportar Productos',
        defaultPath: `productos-${new Date().toISOString().split('T')[0]}.csv`,
        filters: [{ name: 'CSV', extensions: ['csv'] }],
      })
      if (result.canceled || !result.filePath) return { success: false, error: t('errors.operationCancelled') }

      const db = getDatabase()
      const productos = db.prepare(`
        SELECT p.codigo_barras, p.sku, p.nombre, p.descripcion,
               c.nombre as categoria, p.precio_compra, p.precio_venta,
               p.stock, p.stock_minimo, p.unidad
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1
        ORDER BY p.nombre
      `).all() as any[]

      const header = 'codigo_barras,sku,nombre,descripcion,categoria,precio_compra,precio_venta,stock,stock_minimo,unidad'
      const rows = productos.map((p) => [
        p.codigo_barras || '', p.sku || '', p.nombre, p.descripcion || '',
        p.categoria || '', p.precio_compra, p.precio_venta,
        p.stock, p.stock_minimo, p.unidad,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))

      fs.writeFileSync(result.filePath, [header, ...rows].join('\n'), 'utf8')
      return { success: true, path: result.filePath, count: productos.length }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // `callApi` inyecta `{ usuario_id }` y el renderer agrega la ruta, así que el
  // orden real de los argumentos no es el de la firma obvia. Se normalizan por
  // tipo en vez de asumir una posición: con la firma anterior
  // `(filePath, data)` el canal quedaba inutilizable (la ruta llegaba como
  // `data` y el chequeo de permisos fallaba siempre).
  handleIpc('productos:import-csv', async (_event, ...args: unknown[]) => {
    const filePath = args.find((a): a is string => typeof a === 'string') ?? ''
    const data = args.find((a) => a !== null && typeof a === 'object' && !Array.isArray(a))
    const fail = checkPermissionOrFail(data, 'productos:import-csv', 'inventario_create')
    if (fail) return fail
    try {
      // Solo CSV: la ruta viene del renderer, no puede servir para leer
      // cualquier archivo del sistema (SAM, claves SSH, etc.).
      if (!/\.csv$/i.test(filePath)) {
        return { success: false, error: t('errors.csvInvalidExtension') }
      }
      if (!fs.existsSync(filePath)) {
        return { success: false, error: t('errors.fileNotFound') }
      }
      if (fs.statSync(filePath).size > CSV_MAX_BYTES) {
        return { success: false, error: t('errors.csvTooLarge') }
      }
      const content = fs.readFileSync(filePath, 'utf8')
      const lines = content.split('\n').filter((l) => l.trim())
      if (lines.length < 2) return { success: false, error: t('errors.csvEmpty') }

      const db = getDatabase()
      const header = lines[0].toLowerCase()
      const hasHeaders = header.includes('nombre') || header.includes('name')
      const dataLines = hasHeaders ? lines.slice(1) : lines

      let imported = 0
      let skipped = 0

      const importar = db.transaction(() => {
        for (const line of dataLines) {
          try {
            const cols = line.split(',').map((c) => c.replace(/^"|"$/g, '').replace('""', '"').trim())
            const nombre = cols[2] || cols[0]
            if (!nombre) { skipped++; continue }

            const existing = db!.prepare('SELECT id FROM productos WHERE nombre = ?').get(nombre) as any
            if (existing) { skipped++; continue }

            db!.prepare(`
              INSERT INTO productos (codigo_barras, sku, nombre, descripcion, categoria_id,
                precio_compra, precio_venta, stock, stock_minimo, unidad)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              cols[0] || null, cols[1] || null, nombre, cols[3] || null,
              null,
              parseFloat(cols[5]) || 0, parseFloat(cols[6]) || 0,
              parseInt(cols[7]) || 0, parseInt(cols[8]) || 5, cols[9] || 'Unit',
            )
            imported++
          } catch { skipped++ }
        }
      })

      importar()
      return { success: true, imported, skipped, total: dataLines.length }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}