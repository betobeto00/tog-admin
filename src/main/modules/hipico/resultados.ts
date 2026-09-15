import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerResultadosHandlers(): void {
  handleIpc('hipico:resultados-list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:resultados-list', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const carreraId = Number(data?.carrera_id) || null
    return db
      .prepare(
        `SELECT r.*, i.jinete, i.numero_partida, c.nombre as caballo_nombre,
                ca.hipodromo, ca.fecha, ca.numero_carrera
           FROM hipico_resultados r
           JOIN hipico_inscripciones i ON r.inscripcion_id = i.id
           JOIN hipico_caballos c ON r.caballo_id = c.id
           JOIN hipico_carreras ca ON r.carrera_id = ca.id
          WHERE (? IS NULL OR r.carrera_id = ?)
          ORDER BY ca.fecha DESC, ca.numero_carrera, r.posicion`,
      )
      .all(carreraId, carreraId)
  })

  /**
   * Carga (o corrige) el resultado de una inscripción.
   * Cuando todas las inscripciones activas tienen resultado, la carrera queda
   * `finalizada` automáticamente.
   */
  handleIpc('hipico:resultado-set', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:resultado-set', 'hipico_edit')
    if (fail) return fail
    const inscripcionId = Number(data?.inscripcion_id)
    if (!inscripcionId) return { success: false, error: 'Falta la inscripción' }

    const db = getDatabase()
    const insc = db
      .prepare(
        `SELECT i.id, i.carrera_id, i.caballo_id, i.retirado, c.estado
           FROM hipico_inscripciones i
           JOIN hipico_carreras c ON i.carrera_id = c.id
          WHERE i.id = ?`,
      )
      .get(inscripcionId) as any
    if (!insc) return { success: false, error: 'Inscripción no encontrada' }
    if (insc.retirado) return { success: false, error: 'El caballo está retirado de la carrera' }

    const posicion = Number(data?.posicion)
    if (!Number.isInteger(posicion) || posicion < 1) {
      return { success: false, error: 'La posición debe ser un entero mayor o igual a 1' }
    }
    const yaUsada = db
      .prepare('SELECT id FROM hipico_resultados WHERE carrera_id = ? AND posicion = ? AND inscripcion_id != ?')
      .get(insc.carrera_id, posicion, inscripcionId)
    if (yaUsada) return { success: false, error: `La posición ${posicion} ya está asignada a otro caballo` }

    const tiempo = data?.tiempo || null
    const dividendo = Number(data?.dividendo) || null

    const existente = db.prepare('SELECT id FROM hipico_resultados WHERE inscripcion_id = ?').get(inscripcionId) as any
    if (existente) {
      db.prepare('UPDATE hipico_resultados SET posicion = ?, tiempo = ?, dividendo = ? WHERE id = ?').run(
        posicion,
        tiempo,
        dividendo,
        existente.id,
      )
    } else {
      db.prepare(
        `INSERT INTO hipico_resultados (carrera_id, inscripcion_id, caballo_id, posicion, tiempo, dividendo, fuente)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(insc.carrera_id, inscripcionId, insc.caballo_id, posicion, tiempo, dividendo, data?.fuente === 'api' ? 'api' : 'manual')
    }

    // ¿Quedó completa? Todas las activas con resultado → finalizada
    const pendientes = db
      .prepare(
        `SELECT COUNT(*) as total FROM hipico_inscripciones i
          WHERE i.carrera_id = ? AND i.retirado = 0
            AND NOT EXISTS (SELECT 1 FROM hipico_resultados r WHERE r.inscripcion_id = i.id)`,
      )
      .get(insc.carrera_id) as any
    if ((pendientes?.total || 0) === 0 && insc.estado !== 'finalizada') {
      db.prepare("UPDATE hipico_carreras SET estado = 'finalizada' WHERE id = ?").run(insc.carrera_id)
    }

    return { success: true, carrera_finalizada: (pendientes?.total || 0) === 0 }
  })

  handleIpc('hipico:resultado-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'hipico:resultado-delete', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const resultado = db.prepare('SELECT carrera_id FROM hipico_resultados WHERE id = ?').get(data.id) as any
    if (!resultado) return { success: false, error: 'Resultado no encontrado' }
    db.prepare('DELETE FROM hipico_resultados WHERE id = ?').run(data.id)
    // Reabrir la carrera: faltan resultados otra vez
    db.prepare("UPDATE hipico_carreras SET estado = 'en_curso' WHERE id = ? AND estado = 'finalizada'").run(resultado.carrera_id)
    return { success: true }
  })

  /** Tarjetas del dashboard del módulo. */
  handleIpc('hipico:stats', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:stats', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const hoy = new Date().toISOString().split('T')[0]
    const caballos = db.prepare('SELECT COUNT(*) as total FROM hipico_caballos WHERE activo = 1').get() as any
    const propietarios = db.prepare('SELECT COUNT(*) as total FROM hipico_propietarios WHERE activo = 1').get() as any
    const programadas = db.prepare("SELECT COUNT(*) as total FROM hipico_carreras WHERE estado = 'programada'").get() as any
    const hoyCount = db.prepare('SELECT COUNT(*) as total FROM hipico_carreras WHERE date(fecha) = date(?)').get(hoy) as any
    const inscriptos = db
      .prepare(
        `SELECT COUNT(*) as total FROM hipico_inscripciones i
          JOIN hipico_carreras c ON i.carrera_id = c.id
         WHERE c.estado IN ('programada', 'en_curso') AND i.retirado = 0`,
      )
      .get() as any
    const top = db
      .prepare(
        `SELECT c.id, c.nombre, COUNT(r.id) as victorias
           FROM hipico_resultados r
           JOIN hipico_caballos c ON r.caballo_id = c.id
          WHERE r.posicion = 1
          GROUP BY c.id
          ORDER BY victorias DESC, c.nombre
          LIMIT 5`,
      )
      .all()
    return {
      caballos: caballos?.total || 0,
      propietarios: propietarios?.total || 0,
      carreras_programadas: programadas?.total || 0,
      carreras_hoy: hoyCount?.total || 0,
      inscriptos: inscriptos?.total || 0,
      top_ganadores: top,
    }
  })
}
