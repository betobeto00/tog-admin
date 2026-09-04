import { app } from 'electron'
import { handleIpc } from '../../core/auth/ipc-guard'
import fs from 'fs'
import path from 'path'
import { getDatabase, getDbPath } from '../../db/database'
import { t } from '../../i18n'
import { checkPermissionOrFail } from '../../core/auth'

export function registerCajaExtraHandlers(): void {
  handleIpc('caja:reporte-x', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'caja:reporte-x', 'caja_report_x')
    if (fail) return fail
    try {
      const db = getDatabase()
      const caja = db.prepare("SELECT * FROM caja WHERE estado = 'abierta' LIMIT 1").get() as any
      if (!caja) return { success: false, error: t('errors.cashNotOpen') }

      const totalEsperado = caja.fondo_inicial + caja.total_entradas - caja.total_salidas + caja.total_ventas

      const ventasPorMetodo = db.prepare(`
        SELECT metodo_pago, COUNT(*) as cantidad, SUM(total) as total
        FROM ventas WHERE DATE(fecha) = DATE(?) AND estado = 'completada'
        GROUP BY metodo_pago
      `).all(caja.fecha_apertura) as any[]

      const ultimasVentas = db.prepare(`
        SELECT v.numero_venta, v.total, v.metodo_pago, v.fecha, u.nombre as usuario_nombre
        FROM ventas v LEFT JOIN usuarios u ON v.usuario_id = u.id
        WHERE DATE(v.fecha) = DATE(?) AND v.estado = 'completada'
        ORDER BY v.fecha DESC LIMIT 20
      `).all(caja.fecha_apertura) as any[]

      const movimientos = db.prepare(`
        SELECT tipo, monto, descripcion, fecha
        FROM movimientos_caja WHERE caja_id = ?
        ORDER BY fecha DESC
      `).all(caja.id) as any[]

      return {
        success: true,
        caja,
        totalEsperado,
        ventasPorMetodo,
        ultimasVentas,
        movimientos,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  handleIpc('caja:backup-auto', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'caja:backup-auto', 'config_backup')
    if (fail) return fail
    try {
      const dbPath = getDbPath()
      if (!fs.existsSync(dbPath)) return { success: false, error: 'DB no encontrada' }

      const backupDir = app.isPackaged
        ? path.join(app.getPath('userData'), 'backups')
        : path.join(process.cwd(), 'data', 'backups')
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

      const filename = `tog-admin-backup-${new Date().toISOString().split('T')[0]}-${Date.now()}.db`
      const backupPath = path.join(backupDir, filename)
      fs.copyFileSync(dbPath, backupPath)
      return { success: true, path: backupPath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}