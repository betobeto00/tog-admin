/**
 * Adaptador de The Racing API para tog-admin.
 * Fetch racecards (carreras programadas) con post_time.
 *
 * Docs: https://www.theracingapi.com
 * Free tier: 5 req/s — minimizar llamadas.
 *
 * La API devuelve racecards con course (hipódromo), off_time, race_name, runners.
 * Normalizamos a nuestro formato de hipico_carreras.
 */

import { getDatabase } from '../../db/database'
import { guardarConfig, leerConfig } from '../../services/fiscal'
import { enmascararApiKey } from '../../services/claves-api'

const CLAVE_API_KEY = 'racing_api_key'
const CLAVE_API_BASE = 'racing_api_base'
const DEFAULT_BASE = 'https://api.theracingapi.com/v1'

export interface CarreraExterna {
  api_event_id: string
  hipodromo: string
  fecha: string
  numero_carrera: number
  race_name: string
  off_time: string
  runners: number
  distancia_m: number | null
  categoria: string | null
}

function obtenerConfig(db: ReturnType<typeof getDatabase>) {
  const apiKey = leerConfig(db, CLAVE_API_KEY)
  const apiBase = leerConfig(db, CLAVE_API_BASE) || DEFAULT_BASE
  return { apiKey, apiBase }
}

export function guardarConfigApi(db: ReturnType<typeof getDatabase>, apiKey: string, apiBase: string) {
  if (apiKey) guardarConfig(db, CLAVE_API_KEY, apiKey)
  if (apiBase) guardarConfig(db, CLAVE_API_BASE, apiBase)
}

/**
 * Config de The Racing API **lista para el renderer**: sin la clave.
 * Mismo criterio que `leerConfigOdds` (ver `services/claves-api.ts`).
 */
export function leerConfigApi(db: ReturnType<typeof getDatabase>) {
  const config = obtenerConfig(db)
  return {
    api_base: config.apiBase,
    configurado: !!config.apiKey,
    api_key_masked: enmascararApiKey(config.apiKey),
  }
}

async function fetchRacecards(apiKey: string, apiBase: string, date?: string): Promise<unknown> {
  if (!apiKey) return null
  const targetDate = date ?? new Date().toISOString().split('T')[0]
  const url = `${apiBase}/racecards?date=${targetDate}`

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function normalizarRacecards(raw: unknown): CarreraExterna[] {
  if (!raw || typeof raw !== 'object') return []
  const data = raw as Record<string, unknown>
  const racecards = (data.racecards ?? data.data ?? data.results ?? []) as any[]
  if (!Array.isArray(racecards)) return []

  const carreras: CarreraExterna[] = []
  for (const rc of racecards) {
    if (!rc || typeof rc !== 'object') continue
    const course = rc.course as Record<string, unknown> | undefined
    const hipodromo = String(course?.course_name ?? course?.name ?? '').trim()
    const offTime = rc.off_time ?? rc.post_time ?? rc.time
    const fecha = offTime ? String(offTime).slice(0, 10) : ''
    const numero = Number(rc.number ?? rc.race_number ?? rc.race_number_relative ?? 0)
    const raceName = String(rc.race_name ?? rc.name ?? 'Carrera').trim()

    if (!hipodromo || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !numero) continue

    const runners = Number(rc.number_of_runners ?? rc.runners ?? 0)
    const distancia = Number(rc.distance_m ?? rc.distance ?? 0)
    const categoria = rc.race_class ?? rc.category ?? null

    carreras.push({
      api_event_id: String(rc.race_id ?? rc.id ?? ''),
      hipodromo,
      fecha,
      numero_carrera: numero,
      race_name: raceName,
      off_time: String(offTime),
      runners: runners || 0,
      distancia_m: Number.isFinite(distancia) && distancia > 0 ? Math.trunc(distancia) : null,
      categoria: categoria ? String(categoria).slice(0, 60) : null,
    })
  }
  return carreras
}

export async function importarCarrerasDeApi(
  fecha?: string,
  guardar = true,
): Promise<{ ok: boolean; carreras: CarreraExterna[]; guardadas: number; error?: string }> {
  const db = getDatabase()
  const { apiKey, apiBase } = obtenerConfig(db)
  if (!apiKey) return { ok: false, carreras: [], guardadas: 0, error: 'API key no configurada (racing_api_key)' }

  const raw = await fetchRacecards(apiKey, apiBase, fecha)
  const carreras = normalizarRacecards(raw)
  if (carreras.length === 0) return { ok: false, carreras: [], guardadas: 0, error: 'La API no devolvió carreras válidas' }

  if (!guardar) return { ok: true, carreras, guardadas: 0 }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO hipico_carreras (hipodromo, fecha, numero_carrera, distancia_m, categoria, premio, estado, fuente, notas)
     VALUES (?, ?, ?, ?, ?, ?, 'programada', 'racing_api', ?)`,
  )
  let guardadas = 0
  const transaccion = db.transaction(() => {
    for (const c of carreras) {
      const res = insert.run(c.hipodromo, c.fecha, c.numero_carrera, c.distancia_m, c.categoria, null, c.race_name)
      if (res.changes > 0) guardadas++
    }
  })
  transaccion()
  return { ok: true, carreras, guardadas }
}
