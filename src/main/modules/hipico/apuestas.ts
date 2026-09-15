/**
 * Handlers IPC del sub-modulo de apuestas hípicas (FASE 7b).
 *
 * Gestiona:
 *   - Configuración de APIs (Racing API + Odds API)
 *   - Sincronización de carreras y odds desde APIs de terceros
 *   - Creación y gestión de tickets de apuesta
 *   - Liquidación de apuestas al finalizar carrera
 *
 * Permisos:
 *   - `hipico_apuestas`      → vender/ver apuestas (cajero de apuestas)
 *   - `hipico_apuestas_admin` → anular, liquidar y configurar APIs
 */

import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { importarCarrerasDeApi, leerConfigApi, guardarConfigApi } from './racing-api'
import { sincronizarOdds, oddsDeCarrera, leerConfigOdds, guardarConfigOdds } from './odds-api'

const TIPOS_APUESTA = ['win', 'place', 'each_way', 'exacta', 'trifecta'] as const
type TipoApuesta = (typeof TIPOS_APUESTA)[number]
const TIPOS_COMBINADOS: TipoApuesta[] = ['exacta', 'trifecta']
/** Puesto máximo que paga una apuesta `place` / `each_way`. */
const PLACE_PUESTOS = 3
const MAX_SELECCIONES = 5
const MAX_MONTO = 1_000_000
const MAX_TEXTO = 120
const MAX_NOTAS = 500

type DbLike = ReturnType<typeof getDatabase>

interface SeleccionEntrada {
  caballo_nombre: string
  caballo_numero: number | null
  posicion_predicha: number | null
  odd_individual: number | null
}

export function generarNumeroTicket(db: DbLike): string {
  const hoy = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const ultimo = db
    .prepare('SELECT numero_ticket FROM hipico_apuestas WHERE numero_ticket LIKE ? ORDER BY id DESC LIMIT 1')
    .get(`AP-${hoy}-%`) as any
  const partes = String(ultimo?.numero_ticket ?? '').split('-')
  const secuencial = ultimo ? Number(partes[2] ?? 0) + 1 : 1
  return `AP-${hoy}-${String(secuencial).padStart(4, '0')}`
}

/** Normaliza y valida las selecciones que llegan del renderer. */
function normalizarSelecciones(tipo: TipoApuesta, raw: unknown): SeleccionEntrada[] {
  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Debe incluir al menos una selección')
  if (raw.length > MAX_SELECCIONES) throw new Error(`Máximo ${MAX_SELECCIONES} selecciones por apuesta`)

  const selecciones: SeleccionEntrada[] = raw.map((s: any) => {
    const nombre = String(s?.caballo_nombre ?? '').trim()
    if (!nombre) throw new Error('Toda selección debe indicar el caballo')
    if (nombre.length > MAX_TEXTO) throw new Error('Nombre de caballo demasiado largo')

    const odd = Number(s?.odd_individual)
    if (!Number.isFinite(odd) || odd <= 0 || odd > 10_000) {
      throw new Error(`Odd inválida para "${nombre}"`)
    }

    const numero = s?.caballo_numero == null || s?.caballo_numero === '' ? null : Number(s.caballo_numero)
    const predicha = s?.posicion_predicha == null || s?.posicion_predicha === '' ? null : Number(s.posicion_predicha)
    return {
      caballo_nombre: nombre,
      caballo_numero: Number.isInteger(numero) && (numero as number) > 0 ? (numero as number) : null,
      posicion_predicha: Number.isInteger(predicha) && (predicha as number) > 0 ? (predicha as number) : null,
      odd_individual: odd,
    }
  })

  if (tipo === 'win' || tipo === 'place' || tipo === 'each_way') {
    if (selecciones.length !== 1) throw new Error('Win, place y each-way se juegan con una sola selección')
  }

  if (TIPOS_COMBINADOS.includes(tipo)) {
    const esperadas = tipo === 'exacta' ? 2 : 3
    if (selecciones.length !== esperadas) {
      throw new Error(`${tipo === 'exacta' ? 'Exacta' : 'Trifecta'} requiere exactamente ${esperadas} selecciones`)
    }
    const posiciones = selecciones.map((s) => s.posicion_predicha)
    if (posiciones.some((p) => p == null)) throw new Error('Cada selección debe indicar la posición predicha')
    if (new Set(posiciones).size !== posiciones.length) throw new Error('Las posiciones predichas no pueden repetirse')
  }

  return selecciones
}

/** El odd total es el producto de las individuales (combinadas) o la única odd. */
export function calcularOddTotal(tipo: TipoApuesta, selecciones: SeleccionEntrada[]): number {
  if (tipo === 'win' || tipo === 'place' || tipo === 'each_way') {
    return selecciones[0]?.odd_individual ?? 0
  }
  return selecciones.reduce((acc, s) => acc * (s.odd_individual ?? 0), 1)
}

/**
 * Regla de liquidación (una sola fuente, testeada):
 *   - `win`      → gana si el caballo ganó
 *   - `place`    → gana si terminó entre los primeros `PLACE_PUESTOS`
 *   - `each_way` → paga si ganó o si entró en el puesto (odd único, sin dividir stake)
 *   - `exacta` / `trifecta` → gana si TODAS las posiciones predichas coinciden
 */
export function apuestaGanadora(
  tipo: TipoApuesta,
  resoluciones: Array<{ posicion_predicha: number | null; posicion_real: number }>,
): boolean {
  if (!resoluciones.length) return false
  switch (tipo) {
    case 'win':
      return resoluciones[0].posicion_real === 1
    case 'place':
    case 'each_way':
      return resoluciones[0].posicion_real <= PLACE_PUESTOS
    case 'exacta':
    case 'trifecta':
      return resoluciones.every(
        (r) => r.posicion_predicha != null && r.posicion_predicha === r.posicion_real,
      )
    default:
      return false
  }
}

/** Posiciones reales de una carrera, indexadas por nombre de caballo (case-insensitive). */
function posicionesDeCarrera(db: DbLike, carreraId: number): Map<string, number> {
  const filas = db
    .prepare(
      `SELECT cb.nombre AS caballo_nombre, r.posicion
         FROM hipico_resultados r
         JOIN hipico_caballos cb ON cb.id = r.caballo_id
        WHERE r.carrera_id = ?`,
    )
    .all(carreraId) as any[]
  return new Map(filas.map((f) => [String(f.caballo_nombre).trim().toLowerCase(), Number(f.posicion)]))
}

/**
 * Liquida todas las apuestas pendientes de una carrera ya finalizada.
 * Idempotente: sólo toca apuestas en estado `pendiente` y sólo cierra las que
 * tienen todos sus caballos resueltos.
 */
export function liquidarApuestasDeCarrera(
  carreraId: number,
  db: DbLike = getDatabase(),
): { liquidadas: number; ganadas: number; perdidas: number; sinResolver: number } {
  const posiciones = posicionesDeCarrera(db, carreraId)
  const apuestas = db
    .prepare("SELECT * FROM hipico_apuestas WHERE carrera_id = ? AND estado = 'pendiente'")
    .all(carreraId) as any[]

  let liquidadas = 0
  let ganadas = 0
  let sinResolver = 0

  const transaccion = db.transaction(() => {
    for (const apuesta of apuestas) {
      const selecciones = db
        .prepare('SELECT * FROM hipico_apuesta_selections WHERE apuesta_id = ? ORDER BY id')
        .all(apuesta.id) as any[]

      const resoluciones: Array<{ posicion_predicha: number | null; posicion_real: number }> = []
      let todasResueltas = selecciones.length > 0

      for (const sel of selecciones) {
        const posicionReal = posiciones.get(String(sel.caballo_nombre).trim().toLowerCase())
        if (posicionReal == null) {
          todasResueltas = false
          break
        }
        resoluciones.push({ posicion_predicha: sel.posicion_predicha ?? null, posicion_real: posicionReal })
      }

      if (!todasResueltas) {
        sinResolver++
        continue
      }

      const gano = apuestaGanadora(apuesta.tipo_apuesta as TipoApuesta, resoluciones)

      const marcar = db.prepare('UPDATE hipico_apuesta_selections SET resultado_posicion = ?, ganador = ? WHERE id = ?')
      for (const sel of selecciones) {
        const posicionReal = posiciones.get(String(sel.caballo_nombre).trim().toLowerCase())
        if (posicionReal == null) continue
        const acierta = TIPOS_COMBINADOS.includes(apuesta.tipo_apuesta as TipoApuesta)
          ? sel.posicion_predicha === posicionReal
          : posicionReal === 1 || posicionReal <= PLACE_PUESTOS
        marcar.run(posicionReal, acierta ? 1 : 0, sel.id)
      }

      db.prepare("UPDATE hipico_apuestas SET estado = ?, ganancia = ?, cerrada_en = datetime('now') WHERE id = ?").run(
        gano ? 'ganada' : 'perdida',
        gano ? Number(apuesta.payout_potencial) || 0 : 0,
        apuesta.id,
      )
      liquidadas++
      if (gano) ganadas++
    }
  })
  transaccion()

  return { liquidadas, ganadas, perdidas: liquidadas - ganadas, sinResolver }
}

export function registerApuestasHandlers(): void {
  // ── Configuración de APIs ──────────────────────────────────────────────
  handleIpc('hipico:api-racing-config', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-racing-config', 'hipico_apuestas_admin')
    if (fail) return fail
    const db = getDatabase()
    if (typeof data?.api_key === 'string') {
      guardarConfigApi(db, data.api_key.trim(), String(data.api_base || '').trim())
    }
    return leerConfigApi(db)
  })

  handleIpc('hipico:api-odds-config', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-odds-config', 'hipico_apuestas_admin')
    if (fail) return fail
    const db = getDatabase()
    if (typeof data?.api_key === 'string') {
      guardarConfigOdds(db, data.api_key.trim(), String(data.api_base || '').trim())
    }
    return leerConfigOdds(db)
  })

  // ── Sincronización desde APIs ──────────────────────────────────────────
  handleIpc('hipico:api-importar-carreras', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-importar-carreras', 'hipico_apuestas_admin')
    if (fail) return fail
    const fecha = typeof data?.fecha === 'string' ? data.fecha : undefined
    if (fecha && !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
      return { ok: false, carreras: [], guardadas: 0, error: 'Fecha inválida' }
    }
    return importarCarrerasDeApi(fecha, data?.guardar !== false)
  })

  handleIpc('hipico:api-sincronizar-odds', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-sincronizar-odds', 'hipico_apuestas_admin')
    if (fail) return fail
    return sincronizarOdds()
  })

  // ── Odds de una carrera ────────────────────────────────────────────────
  handleIpc('hipico:carrera-odds', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:carrera-odds', 'hipico_apuestas')
    if (fail) return fail
    const carreraId = Number(data?.carrera_id)
    if (!Number.isInteger(carreraId) || carreraId <= 0) return { success: false, error: 'Falta la carrera' }
    return oddsDeCarrera(carreraId)
  })

  // ── Crear apuesta (ticket) ─────────────────────────────────────────────
  handleIpc('hipico:apuesta-crear', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-crear', 'hipico_apuestas')
    if (fail) return fail

    const carreraId = Number(data?.carrera_id)
    const tipo = String(data?.tipo_apuesta || 'win').toLowerCase() as TipoApuesta
    const monto = Number(data?.monto)

    if (!Number.isInteger(carreraId) || carreraId <= 0) return { success: false, error: 'Falta la carrera' }
    if (!TIPOS_APUESTA.includes(tipo)) {
      return { success: false, error: `Tipo de apuesta inválido. Permitidos: ${TIPOS_APUESTA.join(', ')}` }
    }
    if (!Number.isFinite(monto) || monto <= 0 || monto > MAX_MONTO) {
      return { success: false, error: `El monto debe ser mayor a 0 y menor a ${MAX_MONTO}` }
    }
    const notas = data?.notas == null ? null : String(data.notas).slice(0, MAX_NOTAS)

    let selecciones: SeleccionEntrada[]
    try {
      selecciones = normalizarSelecciones(tipo, data?.selections)
    } catch (err: any) {
      return { success: false, error: err?.message || 'Selecciones inválidas' }
    }

    const db = getDatabase()
    const carrera = db
      .prepare('SELECT id, estado FROM hipico_carreras WHERE id = ?')
      .get(carreraId) as any
    if (!carrera) return { success: false, error: 'Carrera no encontrada' }
    if (carrera.estado === 'finalizada' || carrera.estado === 'cancelada') {
      return { success: false, error: 'La carrera ya no admite apuestas' }
    }

    const oddTotal = calcularOddTotal(tipo, selecciones)
    if (!Number.isFinite(oddTotal) || oddTotal <= 0 || oddTotal > 1_000_000) {
      return { success: false, error: 'Odd total fuera de rango' }
    }
    const payoutPotencial = monto * oddTotal

    let apuestaId = 0
    let numeroTicket = ''
    const transaccion = db.transaction(() => {
      numeroTicket = generarNumeroTicket(db)
      const result = db
        .prepare(
          `INSERT INTO hipico_apuestas (numero_ticket, carrera_id, tipo_apuesta, monto, odd_total, payout_potencial, estado, notas)
           VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?)`,
        )
        .run(numeroTicket, carreraId, tipo, monto, oddTotal, payoutPotencial, notas)
      apuestaId = Number(result.lastInsertRowid)

      const insertSel = db.prepare(
        `INSERT INTO hipico_apuesta_selections (apuesta_id, carrera_id, caballo_nombre, caballo_numero, posicion_predicha, odd_individual)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      for (const s of selecciones) {
        insertSel.run(apuestaId, carreraId, s.caballo_nombre, s.caballo_numero, s.posicion_predicha, s.odd_individual)
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
    const fail = checkPermissionOrFail(data, 'hipico:apuestas-list', 'hipico_apuestas')
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
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-detail', 'hipico_apuestas')
    if (fail) return fail
    const apuestaId = Number(data?.apuesta_id)
    if (!Number.isInteger(apuestaId) || apuestaId <= 0) return { success: false, error: 'Falta la apuesta' }
    const db = getDatabase()
    const apuesta = db
      .prepare(
        `SELECT a.*, c.hipodromo, c.fecha, c.numero_carrera, c.estado as carrera_estado
           FROM hipico_apuestas a
           JOIN hipico_carreras c ON a.carrera_id = c.id
          WHERE a.id = ?`,
      )
      .get(apuestaId)
    if (!apuesta) return { success: false, error: 'Apuesta no encontrada' }
    const selections = db
      .prepare('SELECT * FROM hipico_apuesta_selections WHERE apuesta_id = ? ORDER BY id')
      .all(apuestaId)
    return { apuesta, selections }
  })

  // ── Liquidar apuestas de una carrera ───────────────────────────────────
  handleIpc('hipico:apuestas-liquidar', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuestas-liquidar', 'hipico_apuestas_admin')
    if (fail) return fail
    const carreraId = Number(data?.carrera_id)
    if (!Number.isInteger(carreraId) || carreraId <= 0) return { success: false, error: 'Falta la carrera' }

    const db = getDatabase()
    const carrera = db.prepare('SELECT id, estado FROM hipico_carreras WHERE id = ?').get(carreraId) as any
    if (!carrera) return { success: false, error: 'Carrera no encontrada' }
    if (carrera.estado !== 'finalizada') return { success: false, error: 'La carrera debe estar finalizada para liquidar' }

    return { success: true, ...liquidarApuestasDeCarrera(carreraId, db) }
  })

  // ── Anular apuesta ─────────────────────────────────────────────────────
  handleIpc('hipico:apuesta-anular', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-anular', 'hipico_apuestas_admin')
    if (fail) return fail
    const apuestaId = Number(data?.apuesta_id)
    if (!Number.isInteger(apuestaId) || apuestaId <= 0) return { success: false, error: 'Falta la apuesta' }

    const db = getDatabase()
    const apuesta = db
      .prepare("SELECT * FROM hipico_apuestas WHERE id = ? AND estado = 'pendiente'")
      .get(apuestaId) as any
    if (!apuesta) return { success: false, error: 'Apuesta no encontrada o ya cerrada' }
    if (apuesta.cobrada_en) return { success: false, error: 'La apuesta ya fue cobrada' }

    db.prepare("UPDATE hipico_apuestas SET estado = 'anulada', ganancia = 0, cerrada_en = datetime('now') WHERE id = ?").run(apuestaId)
    return { success: true }
  })

  // ── Marcar apuesta ganada como cobrada ─────────────────────────────────
  handleIpc('hipico:apuesta-cobrar', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuesta-cobrar', 'hipico_apuestas_admin')
    if (fail) return fail
    const apuestaId = Number(data?.apuesta_id)
    if (!Number.isInteger(apuestaId) || apuestaId <= 0) return { success: false, error: 'Falta la apuesta' }

    const db = getDatabase()
    const apuesta = db
      .prepare("SELECT * FROM hipico_apuestas WHERE id = ? AND estado = 'ganada'")
      .get(apuestaId) as any
    if (!apuesta) return { success: false, error: 'Apuesta no encontrada o no está ganada' }
    if (apuesta.cobrada_en) return { success: false, error: 'La apuesta ya fue cobrada' }

    db.prepare("UPDATE hipico_apuestas SET cobrada_en = datetime('now') WHERE id = ?").run(apuestaId)
    return { success: true }
  })

  // ── Stats de apuestas ──────────────────────────────────────────────────
  handleIpc('hipico:apuestas-stats', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:apuestas-stats', 'hipico_apuestas')
    if (fail) return fail
    const db = getDatabase()
    const hoy = new Date().toISOString().split('T')[0]

    const pendientes = db
      .prepare("SELECT COUNT(*) as total, COALESCE(SUM(monto), 0) as monto FROM hipico_apuestas WHERE estado = 'pendiente'")
      .get() as any
    const hoyStats = db
      .prepare('SELECT COUNT(*) as total, COALESCE(SUM(monto), 0) as monto FROM hipico_apuestas WHERE date(creado_en) = date(?)')
      .get(hoy) as any
    const ganadas = db
      .prepare("SELECT COUNT(*) as total, COALESCE(SUM(ganancia), 0) as total_ganado FROM hipico_apuestas WHERE estado = 'ganada'")
      .get() as any
    const porCobrar = db
      .prepare("SELECT COUNT(*) as total, COALESCE(SUM(ganancia), 0) as monto FROM hipico_apuestas WHERE estado = 'ganada' AND cobrada_en IS NULL")
      .get() as any
    const total = db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(monto), 0) as monto_total FROM hipico_apuestas').get() as any

    return {
      pendientes: pendientes?.total || 0,
      pendientes_monto: pendientes?.monto || 0,
      hoy: hoyStats?.total || 0,
      hoy_monto: hoyStats?.monto || 0,
      ganadas: ganadas?.total || 0,
      total_ganado: ganadas?.total_ganado || 0,
      por_cobrar: porCobrar?.total || 0,
      por_cobrar_monto: porCobrar?.monto || 0,
      total_apuestas: total?.total || 0,
      total_monto: total?.monto_total || 0,
    }
  })
}
