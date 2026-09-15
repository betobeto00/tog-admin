import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

const SEXOS = ['macho', 'hembra']

export function registerCaballosHandlers(): void {
  handleIpc('hipico:caballos-list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:caballos-list', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const buscar = typeof data?.buscar === 'string' ? data.buscar.trim() : ''
    const propietarioId = Number(data?.propietario_id) || null
    const like = `%${buscar}%`
    return db
      .prepare(
        `SELECT c.*, p.nombre as propietario_nombre,
                (SELECT COUNT(*) FROM hipico_resultados r WHERE r.caballo_id = c.id AND r.posicion = 1) as victorias,
                (SELECT COUNT(*) FROM hipico_resultados r WHERE r.caballo_id = c.id) as carreras_corridas
           FROM hipico_caballos c
           LEFT JOIN hipico_propietarios p ON c.propietario_id = p.id
          WHERE c.activo = 1
            AND (? = '' OR c.nombre LIKE ? OR c.microchip LIKE ?)
            AND (? IS NULL OR c.propietario_id = ?)
          ORDER BY c.nombre`,
      )
      .all(buscar, like, like, propietarioId, propietarioId)
  })

  handleIpc('hipico:caballos-create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:caballos-create', 'hipico_edit')
    if (fail) return fail
    const nombre = typeof data?.nombre === 'string' ? data.nombre.trim() : ''
    if (!nombre) return { success: false, error: 'El nombre del caballo es obligatorio' }
    if (data.sexo && !SEXOS.includes(String(data.sexo).toLowerCase())) {
      return { success: false, error: 'Sexo inválido (macho o hembra)' }
    }

    const db = getDatabase()
    if (data.propietario_id && !db.prepare('SELECT id FROM hipico_propietarios WHERE id = ? AND activo = 1').get(data.propietario_id)) {
      return { success: false, error: 'El propietario indicado no existe' }
    }

    const result = db
      .prepare(
        `INSERT INTO hipico_caballos (nombre, raza, sexo, anio_nacimiento, propietario_id, microchip, entrenador, notas)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        nombre,
        data.raza || null,
        data.sexo ? String(data.sexo).toLowerCase() : null,
        Number(data.anio_nacimiento) || null,
        data.propietario_id || null,
        data.microchip || null,
        data.entrenador || null,
        data.notas || null,
      )
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('hipico:caballos-update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:caballos-update', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const actual = db.prepare('SELECT id FROM hipico_caballos WHERE id = ?').get(data.id)
    if (!actual) return { success: false, error: 'Caballo no encontrado' }
    db.prepare(
      `UPDATE hipico_caballos
         SET nombre = COALESCE(?, nombre), raza = COALESCE(?, raza), sexo = COALESCE(?, sexo),
             anio_nacimiento = COALESCE(?, anio_nacimiento), propietario_id = COALESCE(?, propietario_id),
             microchip = COALESCE(?, microchip), entrenador = COALESCE(?, entrenador), notas = COALESCE(?, notas)
       WHERE id = ?`,
    ).run(
      data.data?.nombre || null,
      data.data?.raza ?? null,
      data.data?.sexo ?? null,
      Number(data.data?.anio_nacimiento) || null,
      data.data?.propietario_id ?? null,
      data.data?.microchip ?? null,
      data.data?.entrenador ?? null,
      data.data?.notas ?? null,
      data.id,
    )
    return { success: true }
  })

  handleIpc('hipico:caballos-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:caballos-delete', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const pendientes = db
      .prepare(
        `SELECT COUNT(*) as total FROM hipico_inscripciones i
          JOIN hipico_carreras c ON i.carrera_id = c.id
         WHERE i.caballo_id = ? AND c.estado IN ('programada', 'en_curso')`,
      )
      .get(data.id) as any
    if ((pendientes?.total || 0) > 0) {
      return { success: false, error: 'El caballo está inscripto en una carrera programada. Retiralo antes de darlo de baja.' }
    }
    db.prepare('UPDATE hipico_caballos SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })
}
