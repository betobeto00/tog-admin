import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export const ESTADOS_CARRERA = ['programada', 'en_curso', 'finalizada', 'cancelada'] as const

export function registerCarrerasHandlers(): void {
  handleIpc('hipico:carreras-list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:carreras-list', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const desde = typeof data?.desde === 'string' ? data.desde : null
    const hasta = typeof data?.hasta === 'string' ? data.hasta : null
    const estado = typeof data?.estado === 'string' && data.estado ? data.estado : null
    return db
      .prepare(
        `SELECT c.*,
                (SELECT COUNT(*) FROM hipico_inscripciones i WHERE i.carrera_id = c.id AND i.retirado = 0) as inscriptos,
                (SELECT COUNT(*) FROM hipico_resultados r WHERE r.carrera_id = c.id) as resultados
           FROM hipico_carreras c
          WHERE (? IS NULL OR date(c.fecha) >= date(?))
            AND (? IS NULL OR date(c.fecha) <= date(?))
            AND (? IS NULL OR c.estado = ?)
          ORDER BY c.fecha DESC, c.numero_carrera`,
      )
      .all(desde, desde, hasta, hasta, estado, estado)
  })

  handleIpc('hipico:carreras-create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:carreras-create', 'hipico_edit')
    if (fail) return fail
    const hipodromo = typeof data?.hipodromo === 'string' ? data.hipodromo.trim() : ''
    const fecha = typeof data?.fecha === 'string' ? data.fecha.trim() : ''
    const numeroCarrera = Number(data?.numero_carrera)
    if (!hipodromo) return { success: false, error: 'El hipódromo es obligatorio' }
    if (!/^\d{4}-\d{2}-\d{2}/.test(fecha)) return { success: false, error: 'La fecha debe ser YYYY-MM-DD' }
    if (!Number.isInteger(numeroCarrera) || numeroCarrera <= 0) {
      return { success: false, error: 'El número de carrera debe ser un entero positivo' }
    }

    const db = getDatabase()
    const existente = db
      .prepare('SELECT id FROM hipico_carreras WHERE hipodromo = ? AND date(fecha) = date(?) AND numero_carrera = ?')
      .get(hipodromo, fecha, numeroCarrera)
    if (existente) return { success: false, error: 'Ya existe esa carrera (mismo hipódromo, fecha y número)' }

    const result = db
      .prepare(
        `INSERT INTO hipico_carreras (hipodromo, fecha, numero_carrera, distancia_m, categoria, premio, estado, notas, fuente)
         VALUES (?, ?, ?, ?, ?, ?, 'programada', ?, ?)`,
      )
      .run(
        hipodromo,
        fecha,
        numeroCarrera,
        Number(data.distancia_m) || null,
        data.categoria || null,
        Number(data.premio) || null,
        data.notas || null,
        'manual',
      )
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('hipico:carreras-update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:carreras-update', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const actual = db.prepare('SELECT * FROM hipico_carreras WHERE id = ?').get(data.id) as any
    if (!actual) return { success: false, error: 'Carrera no encontrada' }

    const nuevoEstado = data.data?.estado
    if (nuevoEstado && !ESTADOS_CARRERA.includes(nuevoEstado)) {
      return { success: false, error: `Estado inválido. Permitidos: ${ESTADOS_CARRERA.join(', ')}` }
    }
    if (nuevoEstado && nuevoEstado !== actual.estado && actual.estado === 'finalizada' && nuevoEstado !== 'cancelada') {
      return { success: false, error: 'Una carrera finalizada sólo puede pasar a cancelada' }
    }

    db.prepare(
      `UPDATE hipico_carreras
         SET hipodromo = COALESCE(?, hipodromo), fecha = COALESCE(?, fecha), distancia_m = COALESCE(?, distancia_m),
             categoria = COALESCE(?, categoria), premio = COALESCE(?, premio), estado = COALESCE(?, estado),
             notas = COALESCE(?, notas)
       WHERE id = ?`,
    ).run(
      data.data?.hipodromo || null,
      data.data?.fecha || null,
      Number(data.data?.distancia_m) || null,
      data.data?.categoria ?? null,
      Number(data.data?.premio) || null,
      nuevoEstado || null,
      data.data?.notas ?? null,
      data.id,
    )
    return { success: true }
  })

  handleIpc('hipico:inscripciones-list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:inscripciones-list', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const carreraId = Number(data?.carrera_id)
    if (!carreraId) return { success: false, error: 'Falta la carrera' }
    return db
      .prepare(
        `SELECT i.*, c.nombre as caballo_nombre, c.raza, p.nombre as propietario_nombre,
                r.posicion, r.tiempo, r.dividendo
           FROM hipico_inscripciones i
           JOIN hipico_caballos c ON i.caballo_id = c.id
           LEFT JOIN hipico_propietarios p ON c.propietario_id = p.id
           LEFT JOIN hipico_resultados r ON r.inscripcion_id = i.id
          WHERE i.carrera_id = ?
          ORDER BY i.numero_partida, c.nombre`,
      )
      .all(carreraId)
  })

  handleIpc('hipico:inscripciones-create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:inscripciones-create', 'hipico_edit')
    if (fail) return fail
    const carreraId = Number(data?.carrera_id)
    const caballoId = Number(data?.caballo_id)
    if (!carreraId || !caballoId) return { success: false, error: 'Faltan la carrera y el caballo' }

    const db = getDatabase()
    const carrera = db.prepare('SELECT id, estado, numero_carrera FROM hipico_carreras WHERE id = ?').get(carreraId) as any
    if (!carrera) return { success: false, error: 'Carrera no encontrada' }
    if (carrera.estado === 'finalizada' || carrera.estado === 'cancelada') {
      return { success: false, error: `No se puede inscribir en una carrera ${carrera.estado}` }
    }
    const caballo = db.prepare('SELECT id, activo FROM hipico_caballos WHERE id = ?').get(caballoId) as any
    if (!caballo || !caballo.activo) return { success: false, error: 'Caballo no encontrado o dado de baja' }

    const yaEsta = db.prepare('SELECT id FROM hipico_inscripciones WHERE carrera_id = ? AND caballo_id = ?').get(carreraId, caballoId)
    if (yaEsta) return { success: false, error: 'El caballo ya está inscripto en esta carrera' }

    const siguiente = db
      .prepare('SELECT COALESCE(MAX(numero_partida), 0) + 1 as numero FROM hipico_inscripciones WHERE carrera_id = ?')
      .get(carreraId) as any

    const result = db
      .prepare(
        `INSERT INTO hipico_inscripciones (carrera_id, caballo_id, jinete, peso, numero_partida, retirado, notas)
         VALUES (?, ?, ?, ?, ?, 0, ?)`,
      )
      .run(carreraId, caballoId, data.jinete || null, Number(data.peso) || null, Number(data.numero_partida) || siguiente.numero, data.notas || null)
    return { success: true, id: result.lastInsertRowid, numero_partida: Number(data.numero_partida) || siguiente.numero }
  })

  handleIpc('hipico:inscripciones-retirar', async (_event, data: { id: number; retirado?: boolean; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:inscripciones-retirar', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const insc = db
      .prepare(
        `SELECT i.id, c.estado FROM hipico_inscripciones i
          JOIN hipico_carreras c ON i.carrera_id = c.id WHERE i.id = ?`,
      )
      .get(data.id) as any
    if (!insc) return { success: false, error: 'Inscripción no encontrada' }
    if (insc.estado === 'finalizada') return { success: false, error: 'La carrera ya finalizó' }
    db.prepare('UPDATE hipico_inscripciones SET retirado = ? WHERE id = ?').run(data.retirado === false ? 0 : 1, data.id)
    return { success: true }
  })

  handleIpc('hipico:inscripciones-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:inscripciones-delete', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const resultado = db.prepare('SELECT id FROM hipico_resultados WHERE inscripcion_id = ?').get(data.id)
    if (resultado) return { success: false, error: 'La inscripción tiene resultado cargado; retirala en vez de borrarla' }
    db.prepare('DELETE FROM hipico_inscripciones WHERE id = ?').run(data.id)
    return { success: true }
  })
}
