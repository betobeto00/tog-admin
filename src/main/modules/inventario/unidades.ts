import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerUnidadesHandlers(): void {
  handleIpc('unidades:list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'unidades:list', 'inventario_access')
    if (fail) return fail
    const db = getDatabase()
    return db.prepare('SELECT * FROM unidades_medida WHERE activo = 1 ORDER BY nombre').all()
  })

  handleIpc('unidades:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'unidades:create', 'inventario_units')
    if (fail) return fail
    const db = getDatabase()
    const result = db.prepare('INSERT INTO unidades_medida (nombre, abreviatura) VALUES (?, ?)').run(
      data.nombre,
      data.abreviatura || null,
    )
    return { id: result.lastInsertRowid }
  })

  handleIpc('unidades:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'unidades:update', 'inventario_units')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE unidades_medida SET nombre = COALESCE(?, nombre), abreviatura = COALESCE(?, abreviatura) WHERE id = ?').run(
      data.data.nombre || null,
      data.data.abreviatura || null,
      data.id,
    )
    return { success: true }
  })

  handleIpc('unidades:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'unidades:delete', 'inventario_units')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE unidades_medida SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}