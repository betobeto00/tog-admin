import { ipcMain } from 'electron'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerReportesHandlers(): void {
  ipcMain.handle('reportes:ventas-periodo', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'reportes:ventas-periodo', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare(`
      SELECT
        DATE(fecha) as fecha,
        COUNT(*) as total_ventas,
        SUM(total) as monto_total
      FROM ventas
      WHERE DATE(fecha) BETWEEN ? AND ? AND estado = 'completada'
      GROUP BY DATE(fecha)
      ORDER BY fecha ASC
    `).all(data.fecha_inicio, data.fecha_fin)
  })

  ipcMain.handle('reportes:productos-mas-vendidos', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'reportes:productos-mas-vendidos', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    const limite = data.limite || 10
    return db.prepare(`
      SELECT
        p.nombre,
        p.codigo_barras,
        SUM(vd.cantidad) as total_vendido,
        SUM(vd.subtotal) as total_ingreso
      FROM venta_detalles vd
      JOIN productos p ON vd.producto_id = p.id
      JOIN ventas v ON vd.venta_id = v.id
      WHERE DATE(v.fecha) BETWEEN ? AND ? AND v.estado = 'completada'
      GROUP BY p.id
      ORDER BY total_vendido DESC
      LIMIT ?
    `).all(data.fecha_inicio, data.fecha_fin, limite)
  })

  ipcMain.handle('reportes:ultimas-ventas', async (_event, data?: { limite?: number; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'reportes:ultimas-ventas', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    const limite = data?.limite || 10
    return db.prepare(`
      SELECT v.*, u.nombre as usuario_nombre
      FROM ventas v
      LEFT JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.estado = 'completada'
      ORDER BY v.fecha DESC
      LIMIT ?
    `).all(limite)
  })

  ipcMain.handle('reportes:ventas-por-categoria', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'reportes:ventas-por-categoria', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare(`
      SELECT
        COALESCE(c.nombre, 'Sin categoría') as categoria,
        COUNT(DISTINCT v.id) as total_ventas,
        SUM(vd.cantidad) as total_unidades,
        SUM(vd.subtotal) as total_ingreso
      FROM venta_detalles vd
      JOIN productos p ON vd.producto_id = p.id
      LEFT JOIN categorias c ON p.categoria_id = c.id
      JOIN ventas v ON vd.venta_id = v.id
      WHERE DATE(v.fecha) BETWEEN ? AND ? AND v.estado = 'completada'
      GROUP BY c.id
      ORDER BY total_ingreso DESC
    `).all(data.fecha_inicio, data.fecha_fin)
  })
}