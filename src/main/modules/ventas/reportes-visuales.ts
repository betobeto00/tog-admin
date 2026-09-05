import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerReportesVisualesHandlers(): void {
  handleIpc('reportes-visuales:list', async (_event, data: { usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'reportes-visuales:list', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare(`
      SELECT id, nombre, fuente, campos, fecha_inicio, fecha_fin
      FROM reportes_guardados WHERE usuario_id = ?
      ORDER BY creado_en DESC
    `).all(data.usuario_id)
  })

  handleIpc('reportes-visuales:save', async (_event, data: {
    nombre: string
    fuente: string
    campos: string[]
    fecha_inicio?: string
    fecha_fin?: string
    usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'reportes-visuales:save', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    if (!data?.nombre?.trim()) return { success: false, error: 'El nombre del reporte es obligatorio' }
    if (!data.fuente) return { success: false, error: 'Falta la fuente del reporte' }
    const result = db.prepare(`
      INSERT INTO reportes_guardados (usuario_id, nombre, fuente, campos, fecha_inicio, fecha_fin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      data.usuario_id,
      data.nombre.trim(),
      data.fuente,
      JSON.stringify(Array.isArray(data.campos) ? data.campos : []),
      data.fecha_inicio || null,
      data.fecha_fin || null,
    )
    return { id: result.lastInsertRowid }
  })

  handleIpc('reportes-visuales:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'reportes-visuales:delete', 'reportes_access')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('DELETE FROM reportes_guardados WHERE id = ? AND usuario_id = ?').run(data.id, data.usuario_id)
    return { success: true }
  })
}