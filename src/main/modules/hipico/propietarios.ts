import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerPropietariosHandlers(): void {
  handleIpc('hipico:propietarios-list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:propietarios-list', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const buscar = typeof data?.buscar === 'string' ? data.buscar.trim() : ''
    const sql = `
      SELECT p.*, (SELECT COUNT(*) FROM hipico_caballos c WHERE c.propietario_id = p.id AND c.activo = 1) as caballos
      FROM hipico_propietarios p
      WHERE (? = '' OR p.nombre LIKE ? OR p.documento LIKE ?)
      ORDER BY p.nombre
    `
    const like = `%${buscar}%`
    return db.prepare(sql).all(buscar, like, like)
  })

  handleIpc('hipico:propietarios-create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:propietarios-create', 'hipico_edit')
    if (fail) return fail
    const nombre = typeof data?.nombre === 'string' ? data.nombre.trim() : ''
    if (!nombre) return { success: false, error: 'El nombre del propietario es obligatorio' }

    const db = getDatabase()
    const duplicado = db.prepare('SELECT id FROM hipico_propietarios WHERE nombre = ? AND documento = ?').get(nombre, data.documento || '')
    if (duplicado) return { success: false, error: 'Ya existe un propietario con ese nombre y documento' }

    const result = db
      .prepare(
        `INSERT INTO hipico_propietarios (nombre, documento, telefono, email, pais, notas)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(nombre, data.documento || null, data.telefono || null, data.email || null, data.pais || null, data.notas || null)
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('hipico:propietarios-update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:propietarios-update', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const actual = db.prepare('SELECT * FROM hipico_propietarios WHERE id = ?').get(data.id) as any
    if (!actual) return { success: false, error: 'Propietario no encontrado' }
    db.prepare(
      `UPDATE hipico_propietarios
         SET nombre = COALESCE(?, nombre), documento = COALESCE(?, documento), telefono = COALESCE(?, telefono),
             email = COALESCE(?, email), pais = COALESCE(?, pais), notas = COALESCE(?, notas)
       WHERE id = ?`,
    ).run(
      data.data?.nombre || null,
      data.data?.documento ?? null,
      data.data?.telefono ?? null,
      data.data?.email ?? null,
      data.data?.pais ?? null,
      data.data?.notas ?? null,
      data.id,
    )
    return { success: true }
  })

  handleIpc('hipico:propietarios-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:propietarios-delete', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const caballos = db.prepare('SELECT COUNT(*) as total FROM hipico_caballos WHERE propietario_id = ? AND activo = 1').get(data.id) as any
    if ((caballos?.total || 0) > 0) {
      return { success: false, error: `El propietario tiene ${caballos.total} caballo(s) activo(s). Asígnalos a otro primero.` }
    }
    // Baja lógica: el historial de carreras no debe perder la referencia
    db.prepare('UPDATE hipico_propietarios SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}
