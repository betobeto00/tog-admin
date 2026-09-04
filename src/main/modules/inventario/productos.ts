import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { checkPermissionOrFail } from '../../core/auth'
import { productoCreateSchema, productoUpdateSchema } from '../../../shared/validations'

export function registerProductosHandlers(): void {
  ipcMain.handle('productos:list', async (_event, filters?: any) => {
    const fail = checkPermissionOrFail(filters, 'productos:list', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT p.*, c.nombre as categoria_nombre, s.nombre as subcategoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE p.activo = 1
    `
    const params: any[] = []

    if (filters?.search) {
      sql += ` AND (p.nombre LIKE ? OR p.codigo_barras LIKE ? OR p.sku LIKE ? OR p.marca LIKE ?)`
      const term = `%${filters.search}%`
      params.push(term, term, term, term)
    }

    if (filters?.categoria_id) {
      sql += ` AND p.categoria_id = ?`
      params.push(filters.categoria_id)
    }

    if (filters?.subcategoria_id) {
      sql += ` AND p.subcategoria_id = ?`
      params.push(filters.subcategoria_id)
    }

    sql += ` ORDER BY p.nombre`
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('productos:getById', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productos:getById', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre, s.nombre as subcategoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      LEFT JOIN subcategorias s ON p.subcategoria_id = s.id
      WHERE p.id = ?
    `).get(data.id)
  })

  ipcMain.handle('productos:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'productos:create', 'inventario_create')
    if (fail) return fail
    const parsed = productoCreateSchema.safeParse(data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const esServicio = data.tipo === 'servicio'
    const result = db.prepare(`
      INSERT INTO productos (codigo_barras, sku, nombre, descripcion, categoria_id,
        subcategoria_id, marca, tipo, precio_compra, precio_venta, stock, stock_minimo,
        unidad, imagen)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.codigo_barras || null,
      data.sku || null,
      data.nombre,
      data.descripcion || null,
      data.categoria_id || null,
      data.subcategoria_id || null,
      data.marca || null,
      data.tipo || 'producto',
      esServicio ? 0 : (data.precio_compra || 0),
      data.precio_venta || 0,
      esServicio ? 0 : (data.stock || 0),
      esServicio ? 0 : (data.stock_minimo || 5),
      data.unidad || (esServicio ? 'Servicio' : 'unidad'),
      data.imagen || null,
    )
    return { id: result.lastInsertRowid }
  })

  ipcMain.handle('productos:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productos:update', 'inventario_edit')
    if (fail) return fail
    const parsed = productoUpdateSchema.safeParse(data.data)
    if (!parsed.success) {
      return { success: false, error: parsed.error.errors[0].message }
    }
    const db = getDatabase()
    const d = data.data
    const actual = db.prepare(
      'SELECT tipo, precio_compra, precio_venta, stock, stock_minimo, subcategoria_id, marca, imagen FROM productos WHERE id = ?',
    ).get(data.id) as any
    if (!actual) return { success: false, error: 'Producto no encontrado' }

    const tipoNuevo = d.tipo || actual.tipo
    const esServicio = tipoNuevo === 'servicio'
    const valor = (campo: string, v: any, fallback: any, def: any) =>
      v !== undefined ? v : (campo in actual ? actual[campo] : def)

    db.prepare(`
      UPDATE productos SET
        codigo_barras = COALESCE(?, codigo_barras),
        sku = COALESCE(?, sku),
        nombre = COALESCE(?, nombre),
        descripcion = COALESCE(?, descripcion),
        categoria_id = COALESCE(?, categoria_id),
        subcategoria_id = ?,
        marca = ?,
        tipo = COALESCE(?, tipo),
        precio_compra = ?,
        precio_venta = COALESCE(?, precio_venta),
        stock = ?,
        stock_minimo = ?,
        unidad = COALESCE(?, unidad),
        imagen = ?,
        activo = COALESCE(?, activo),
        actualizado_en = datetime('now')
      WHERE id = ?
    `).run(
      d.codigo_barras, d.sku, d.nombre, d.descripcion, d.categoria_id,
      d.subcategoria_id !== undefined ? (d.subcategoria_id || null) : actual.subcategoria_id,
      d.marca !== undefined ? (d.marca || null) : actual.marca,
      d.tipo,
      esServicio ? 0 : valor('precio_compra', d.precio_compra, actual.precio_compra, 0),
      d.precio_venta,
      esServicio ? 0 : valor('stock', d.stock, actual.stock, 0),
      esServicio ? 0 : valor('stock_minimo', d.stock_minimo, actual.stock_minimo, 5),
      d.unidad,
      d.imagen !== undefined ? (d.imagen || null) : actual.imagen,
      d.activo,
      data.id,
    )
    return { success: true }
  })

  ipcMain.handle('productos:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productos:delete', 'inventario_delete')
    if (fail) return fail
    const db = getDatabase()
    db.prepare(`UPDATE productos SET activo = 0, actualizado_en = datetime('now') WHERE id = ?`).run(data.id)
    return { success: true }
  })

  ipcMain.handle('productos:low-stock', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'productos:low-stock', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1 AND p.tipo != 'servicio' AND p.stock <= p.stock_minimo
      ORDER BY p.stock ASC
    `).all()
  })

  ipcMain.handle('productos:ajustar', async (_event, data: { producto_id: number; stock_nuevo: number; justificacion: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productos:ajustar', 'inventario_adjust')
    if (fail) return fail
    const db = getDatabase()
    const ajustar = db.transaction(() => {
      const producto = db!.prepare('SELECT id, nombre, stock FROM productos WHERE id = ?').get(data.producto_id) as any
      if (!producto) return { success: false, error: t('errors.notFound') }
      if (!data.justificacion.trim()) return { success: false, error: t('errors.justificationRequired') }

      const stockAnterior = producto.stock
      const diferencia = data.stock_nuevo - stockAnterior

      db!.prepare(`UPDATE productos SET stock = ?, actualizado_en = datetime('now') WHERE id = ?`).run(data.stock_nuevo, data.producto_id)

      db!.prepare(`
        INSERT INTO ajustes_inventario (producto_id, usuario_id, stock_anterior, stock_nuevo, diferencia, justificacion)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(data.producto_id, data.usuario_id, stockAnterior, data.stock_nuevo, diferencia, data.justificacion)

      return { success: true, stock_anterior: stockAnterior, stock_nuevo: data.stock_nuevo, diferencia }
    })
    return ajustar()
  })

  ipcMain.handle('productos:ajustes-historial', async (_event, data?: { producto_id?: number; limite?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'productos:ajustes-historial', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    let sql = `
      SELECT a.*, p.nombre as producto_nombre, u.nombre as usuario_nombre
      FROM ajustes_inventario a
      LEFT JOIN productos p ON a.producto_id = p.id
      LEFT JOIN usuarios u ON a.usuario_id = u.id
      WHERE 1=1
    `
    const params: any[] = []
    if (data?.producto_id) { sql += ' AND a.producto_id = ?'; params.push(data.producto_id) }
    sql += ' ORDER BY a.fecha DESC'
    if (data?.limite) { sql += ` LIMIT ?`; params.push(data.limite) }
    return db.prepare(sql).all(...params)
  })

  ipcMain.handle('productos:buscar-por-codigo', async (_event, data: { codigo: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'productos:buscar-por-codigo', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    const codigo = data.codigo.trim()
    if (!codigo) return null

    let producto = db.prepare(`
      SELECT p.*, c.nombre as categoria_nombre
      FROM productos p
      LEFT JOIN categorias c ON p.categoria_id = c.id
      WHERE p.activo = 1 AND p.codigo_barras = ?
    `).get(codigo) as any

    if (!producto) {
      producto = db.prepare(`
        SELECT p.*, c.nombre as categoria_nombre
        FROM productos p
        LEFT JOIN categorias c ON p.categoria_id = c.id
        WHERE p.activo = 1 AND p.sku = ?
      `).get(codigo) as any
    }

    return producto || null
  })
}