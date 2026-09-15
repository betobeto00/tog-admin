/**
 * Handlers IPC del sub-modulo de apuestas hípicas (FASE 7b).
 *
 * Gestiona:
 *   - Configuración de APIs (Racing API + Odds API)
 *   - Sincronización de carreras y odds desde APIs de terceros
 *   - Creación y gestión de tickets de apuesta
 *   - Liquidación de apuestas al finalizar carrera
 */

import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { importarCarrerasDeApi, leerConfigApi, guardarConfigApi } from './racing-api'
import { sincronizarOdds, oddsDeCarrera, leerConfigOdds, guardarConfigOdds } from './odds-api'

const TIPOS_APUESTA = ['win', 'place', 'each_way', 'exacta', 'trifecta'] as const

function generarNumeroTicket(db: ReturnType<typeof getDatabase>): string {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const ultimo = db
    .prepare("SELECT numero_ticket FROM hipico_apuestas WHERE numero_ticket LIKE ? ORDER BY id DESC LIMIT 1")
    .get(`AP-${hoy}-%`) as any
  const secuencial = ultimo ? Number(ultimo.numero_ticket.split('-')[2] ?? 0) + 1 : 1
  return `AP-${hoy}-${String(secuencial).padStart(4, '0')}`
}

export function registerApuestasHandlers(): void {
  // ── Configuración de APIs ──────────────────────────────────────────────
  handleIpc('hipico:api-racing-config', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-racing-config', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    if (typeof data?.api_key === 'string') {
      guardarConfigApi(db, data.api_key, data.api_base || '')
    }
    return leerConfigApi(db)
  })

  handleIpc('hipico:api-odds-config', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-odds-config', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    if (typeof data?.api_key === 'string') {
      guardarConfigOdds(db, data.api_key, data.api_base || '')
    }
    return leerConfigOdds(db)
  })

  // ── Sincronización desde APIs ──────────────────────────────────────────
  handleIpc('hipico:api-importar-carreras', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-importar-carreras', 'hipico_edit')
    if (fail) return fail
    const fecha = typeof data?.fecha === 'string' ? data.fecha : undefined
    const resultado = await importarCarrerasDeApi(fecha, data?.guardar !== false)
    return resultado
  })

  handleIpc('hipico:api-sincronizar-odds', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-sincronizar-odds', 'hipico_edit')
    if (fail) return fail
    const resultado = await sincronizarOdds()
    return resultado
  })

  // ── Odds de una carrera ────────────────────────────────────────────────
  handleIpc('hipico:carrera-odds', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:carrera-odds', 'hipico_view')
    if (fail) return fail
    const carreraId = Number(data?.carrera_id)
    if (!carreraId) return { success: false, error: 'Falta la carrera' }
    return oddsDeCarrera(carreraId)
  })

  // ── Crear apuesta (ticket) ─────────────────────────────────────────────
  handleIpc('hipico:apuesta-crear', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-crear', 'hipico_edit')
    if (fail) return fail

    const carreraId = Number(data?.carrera_id)
    const tipo = String(data?.tipo_apuesta || 'win').toLowerCase()
    const monto = Number(data?.monto)
    const selections = data?.selections as any[] | undefined

    if (!carreraId) return { success: false, error: 'Falta la carrera' }
    if (!TIPOS_APUESTA.includes(tipo as any)) {
      return { success: false, error: `Tipo de apuesta inválido. Permitidos: ${TIPOS_APUESTA.join(', ')}` }
    }
    if (!monto || monto <= 0) return { success: false, error: 'El monto debe ser mayor a 0' }
    if (!selections || !selections.length) return { success: false, error: 'Debe incluir al menos una selección' }

    const db = getDatabase()
    const carrera = db.prepare('SELECT id, estado, hipodromo, fecha, numero_carrera FROM hipico_carreras WHERE id = ?').get(carreraId) as any
    if (!carrera) return { success: false, error: 'Carrera no encontrada' }
    if (carrera.estado === 'finalizada') return { success: false, error: 'La carrera ya finalizó' }

    // Calcular odd total (producto de las individuales)
    let oddTotal = 1
    for (const s of selections) {
      const odd = Number(s?.odd_individual)
      if (!odd || odd <= 0) return { success: false, error: `Odd inválida para "${s?.caballo_nombre}"` }
      if (tipo === 'win' || tipo === 'place' || tipo === 'each_way') {
        // Para win/place, usar la primera odd
        if (selections.length !== 1 && tipo !== 'each_way') {
          return { success: false, error: 'Win y place son apuestas individuales (1 selección)' }
        }
        oddTotal = odd
      } else {
        oddTotal *= odd
      }
    }

    const payoutPotencial = monto * oddTotal
    const numeroTicket = generarNumeroTicket(db)

    let apuestaId: number = 0
    const transaccion = db.transaction(() => {
      const result = db
        .prepare(
          `INSERT INTO hipico_apuestas (numero_ticket, carrera_id, tipo_apuesta, monto, odd_total, payout_potencial, estado, notas)
           VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
        )
        .run(numeroTicket, carreraId, tipo, monto, oddTotal, payoutPotencial, data?.notas || null)
      apuestaId = Number(result.lastInsertRowid)

      for (const s of selections) {
        db.prepare(
          `INSERT INTO hipico_apuesta_selections (apuesta_id, carrera_id, caballo_nombre, caballo_numero, posicion_predicha, odd_individual)
           VALUES (?, ?, ?, ?, ?, ?)`,
        ).run(
          apuestaId,
          carreraId,
          String(s.caballo_nombre || ''),
          Number(s.caballo_numero) || null,
          Number(s.posicion_predicha) || null,
          Number(s.odd_individual) || null,
        )
      }
    })
    transaccion()

    return {
      success: true,
      id: apuestaId,
      numero_ticket: numeroTicket,
      odd_total: oddTotal,
      payout_potencial: payoutPotencial,
    }
  })

  // ── Listar apuestas ────────────────────────────────────────────────────
  handleIpc('hipico:apuestas-list', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuestas-list', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const carreraId = Number(data?.carrera_id) || null
    const estado = typeof data?.estado === 'string' && data.estado ? data.estado : null
    const desde = typeof data?.desde === 'string' ? data.desde : null
    const hasta = typeof data?.hasta === 'string' ? data.hasta : null

    return db
      .prepare(
        `SELECT a.*, c.hipodromo, c.fecha, c.numero_carrera,
                (SELECT COUNT(*) FROM hipico_apuesta_selections s WHERE s.apuesta_id = a.id) as selecciones
           FROM hipico_apuestas a
           JOIN hipico_carreras c ON a.carrera_id = c.id
          WHERE (? IS NULL OR a.carrera_id = ?)
            AND (? IS NULL OR a.estado = ?)
            AND (? IS NULL OR date(a.creado_en) >= date(?))
            AND (? IS NULL OR date(a.creado_en) <= date(?))
          ORDER BY a.creado_en DESC`,
      )
      .all(carreraId, carreraId, estado, estado, desde, desde, hasta, hasta)
  })

  // ── Detalle de apuesta ─────────────────────────────────────────────────
  handleIpc('hipico:apuesta-detail', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-detail', 'hipico_view')
    if (fail) return fail
    const apuestaId = Number(data?.apuesta_id)
    if (!apuestaId) return { success: false, error: 'Falta la apuesta' }
    const db = getDatabase()
    const apuesta = db
      .prepare(
        `SELECT a.*, c.hipodromo, c.fecha, c.numero_carrera, c.estado as carrera_estado
           FROM hipico_apuestas a
           JOIN hipico_carreras c ON a.carrera_id = c.id
          WHERE a.id = ?`,
      )
      .get(apuestaId)
    const selections = db
      .prepare('SELECT * FROM hipico_apuesta_selections WHERE apuesta_id = ? ORDER BY id')
      .all(apuestaId)
    return { apuesta, selections }
  })

  // ── Liquidar apuestas de una carrera ───────────────────────────────────
  handleIpc('hipico:apuestas-liquidar', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuestas-liquidar', 'hipico_edit')
    if (fail) return fail
    const carreraId = Number(data?.carrera_id)
    if (!carreraId) return { success: false, error: 'Falta la carrera' }

    const db = getDatabase()
    const carrera = db.prepare('SELECT id, estado FROM hipico_carreras WHERE id = ?').get(carreraId) as any
    if (!carrera) return { success: false, error: 'Carrera no encontrada' }
    if (carrera.estado !== 'finalizada') return { success: false, error: 'La carrera debe estar finalizada para liquidar' }

    // Obtener resultados de la carrera
    const resultados = db
      .prepare('SELECT inscripcion_id, caballo_id, posicion FROM hipico_resultados WHERE carrera_id = ?')
      .all(carreraId) as any[]
    const mapaResultados = new Map(resultados.map((r: any) => [r.inscripcion_id, r.posicion]))

    // Obtener apuestas pendientes de esta carrera
    const apuestas = db
      .prepare("SELECT * FROM hipico_apuestas WHERE carrera_id = ? AND estado = 'pendiente'")
      .all(carreraId) as any[]

    let liquidadas = 0
    let ganadas = 0

    const transaccion = db.transaction(() => {
      for (const apuesta of apuestas) {
        const selections = db
          .prepare('SELECT * FROM hipico_apuesta_selections WHERE apuesta_id = ?')
          .all(apuesta.id) as any[]

        let todasConResultado = true
        let algunaGano = false

        for (const sel of selections) {
          // Buscar resultado por nombre de caballo en la carrera
          const inscripcion = db
            .prepare(
              `SELECT i.id, r.posicion FROM hipico_inscripciones i
                LEFT JOIN hipico_resultados r ON r.inscripcion_id = i.id
               WHERE i.carrera_id = ? AND LOWER(c.nombre) = LOWER(?)`,
            )
            .get(carreraId, sel.caballo_nombre) as any

          if (inscripcion?.posicion != null) {
            db.prepare('UPDATE hipico_apuesta_selections SET resultado_posicion = ?, ganador = ? WHERE id = ?')
              .run(inscripcion.posicion, inscripcion.posicion === 1 ? 1 : 0, sel.id)

            const gana = verificarSiGana(sel, apuesta.tipo_apuesta, inscripcion.posicion, selections.length)
            if (gana) algunaGano = true
          } else {
            todasConResultado = false
          }
        }

        if (!todasConResultado) continue

        const ganancia = algunaGano ? apuesta.payout_potencial : 0
        const nuevoEstado = algunaGano ? 'ganada' : 'perdida'

        db.prepare('UPDATE hipico_apuestas SET estado = ?, ganancia = ?, cerrada_en = datetime(\'now\') WHERE id = ?')
          .run(nuevoEstado, ganancia, apuesta.id)
        liquidadas++
        if (algunaGano) ganadas++
      }
    })
    transaccion()

    return { success: true, liquidadas, ganadas, perdidas: liquidadas - ganadas }
  })

  // ── Anular apuesta ─────────────────────────────────────────────────────
  handleIpc('hipico:apuesta-anular', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-anular', 'hipico_edit')
    if (fail) return fail
    const apuestaId = Number(data?.apuesta_id)
    if (!apuestaId) return { success: false, error: 'Falta la apuesta' }

    const db = getDatabase()
    const apuesta = db.prepare("SELECT * FROM hipico_apuestas WHERE id = ? AND estado = 'pendiente'").get(apuestaId) as any
    if (!apuesta) return { success: false, error: 'Apuesta no encontrada o ya cerrada' }

    db.prepare("UPDATE hipico_apuestas SET estado = 'anulada', cerrada_en = datetime('now') WHERE id = ?").run(apuestaId)
    return { success: true }
  })

  // ── Stats de apuestas ──────────────────────────────────────────────────
  handleIpc('hipico:apuestas-stats', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuestas-stats', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    const hoy = new Date().toISOString().split('T')[0]

    const pendientes = db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(monto), 0) as monto FROM hipico_apuestas WHERE estado = 'pendiente'").get() as any
    const hoyStats = db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(monto), 0) as monto FROM hipico_apuestas WHERE date(creado_en) = date(?)").get(hoy) as any
    const ganadas = db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(ganancia), 0) as total_ganado FROM hipico_apuestas WHERE estado = 'ganada'").get() as any
    const total = db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(monto), 0) as monto_total FROM hipico_apuestas').get() as any

    return {
      pendientes: pendientes?.total || 0,
      pendientes_monto: pendientes?.monto || 0,
      hoy: hoyStats?.total || 0,
      hoy_monto: hoyStats?.monto || 0,
      ganadas: ganadas?.total || 0,
      total_ganado: ganadas?.total_ganado || 0,
      total_apuestas: total?.total || 0,
      total_monto: total?.monto_total || 0,
    }
  })
}

function verificarSiGana(
  sel: any,
  tipoApuesta: string,
  posicionReal: number,
  totalSelecciones: number,
): boolean {
  switch (tipoApuesta) {
    case 'win':
      return posicionReal === 1
    case 'place':
      return posicionReal <= 3
    case 'each_way':
      return posicionReal === 1 || posicionReal <= 3
    case 'exacta':
      return sel.posicion_predicha === posicionReal
    case 'trifecta':
      return sel.posicion_predicha === posicionReal
    default:
      return posicionReal === 1
  }
}
