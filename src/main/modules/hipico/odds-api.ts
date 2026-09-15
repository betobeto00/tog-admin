/**
 * Adaptador de The Odds API para tog-admin.
 * Fetch odds de carreras de caballos.
 *
 * Docs: https://the-odds-api.com
 * Free tier: 500 créditos/mes (cada request = 1 crédito).
 *
 * Sport keys: horseracing_uk, horseracing_ireland, horseracing_us, horseracing_australia.
 * La API devuelve eventos con bookmakers → markets → outcomes (nombre + price).
 */

import { getDatabase } from '../../db/database'
import { leerConfig } from '../../services/fiscal'

const CLAVE_ODDS_KEY = 'odds_api_key'
const CLAVE_ODDS_BASE = 'odds_api_base'
const DEFAULT_BASE = 'https://api.the-odds-api.com/v4'

const HORSE_RACING_SPORTS = [
  'horseracing_uk',
  'horseracing_ireland',
  'horseracing_us',
  'horseracing_australia',
]

export interface BookmakerOdds {
  key: string
  title: string
  outcomes: { name: string; price: number }[]
}

export interface OddsExterna {
  event_id: string
  race_name: string
  commence_time: string
  bookmakers: BookmakerOdds[]
}

function obtenerConfig(db: ReturnType<typeof getDatabase>) {
  const apiKey = leerConfig(db, CLAVE_ODDS_KEY)
  const apiBase = leerConfig(db, CLAVE_ODDS_BASE) || DEFAULT_BASE
  return { apiKey, apiBase }
}

export function guardarConfigOdds(db: ReturnType<typeof getDatabase>, apiKey: string, apiBase: string) {
  const { guardarConfig } = require('../../services/fiscal')
  if (apiKey) guardarConfig(db, CLAVE_ODDS_KEY, apiKey)
  if (apiBase) guardarConfig(db, CLAVE_ODDS_BASE, apiBase)
}

export function leerConfigOdds(db: ReturnType<typeof getDatabase>) {
  const config = obtenerConfig(db)
  return {
    api_key: config.apiKey,
    api_base: config.apiBase,
    configurado: !!config.apiKey,
  }
}

async function fetchOddsForSport(apiKey: string, apiBase: string, sportKey: string): Promise<unknown> {
  if (!apiKey) return null
  const url = `${apiBase}/sports/${sportKey}/odds?regions=uk,au,us&oddsFormat=decimal&apiKey=${apiKey}`
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function normalizarOdds(raw: unknown): OddsExterna[] {
  if (!raw || !Array.isArray(raw)) return []
  return raw.map((ev: any) => ({
    event_id: String(ev.id ?? ''),
    race_name: String(ev.home_team ?? ev.away_team ?? ev.title ?? 'Carrera'),
    commence_time: String(ev.commence_time ?? ''),
    bookmakers: (ev.bookmakers ?? []).map((bk: any) => ({
      key: String(bk.key ?? ''),
      title: String(bk.title ?? ''),
      outcomes: (bk.markets?.[0]?.outcomes ?? []).map((o: any) => ({
        name: String(o.name ?? ''),
        price: Number(o.price ?? 0),
      })),
    })),
  }))
}

export async function obtenerOddsDeApi(): Promise<{ ok: boolean; odds: OddsExterna[]; error?: string }> {
  const db = getDatabase()
  const { apiKey, apiBase } = obtenerConfig(db)
  if (!apiKey) return { ok: false, odds: [], error: 'API key no configurada (odds_api_key)' }

  const allOdds: OddsExterna[] = []
  for (const sportKey of HORSE_RACING_SPORTS) {
    const raw = await fetchOddsForSport(apiKey, apiBase, sportKey)
    allOdds.push(...normalizarOdds(raw))
    if (HORSE_RACING_SPORTS.indexOf(sportKey) < HORSE_RACING_SPORTS.length - 1) {
      await new Promise(r => setTimeout(r, 250))
    }
  }
  if (allOdds.length === 0) return { ok: false, odds: [], error: 'No se obtuvieron odds de ninguna API' }
  return { ok: true, odds: allOdds }
}

/**
 * Sincroniza odds de la API a la tabla hipico_carreras_odds.
 * Busca carreras existentes por hipódromo+fecha+número para vincular las odds.
 */
export async function sincronizarOdds(): Promise<{ ok: boolean; sincronizadas: number; error?: string }> {
  const resultado = await obtenerOddsDeApi()
  if (!resultado.ok) return { ok: false, sincronizadas: 0, error: resultado.error }

  const db = getDatabase()
  const upsert = db.prepare(
    `INSERT INTO hipico_carreras_odds (carrera_id, bookmaker_key, bookmaker_nombre, outcomes_json, actualizado_en)
     VALUES (?, ?, ?, ?, datetime('now'))
     ON CONFLICT (carrera_id, bookmaker_key) DO UPDATE SET
       outcomes_json = excluded.outcomes_json,
       actualizado_en = excluded.actualizado_en`,
  )

  let sincronizadas = 0
  const transaccion = db.transaction(() => {
    for (const odd of resultado.odds) {
      const fecha = odd.commence_time.slice(0, 10)
      // Buscar carrera que coincida approximate por nombre y fecha
      const carrera = db
        .prepare(
          `SELECT id FROM hipico_carreras
           WHERE date(fecha) = date(?) AND ( LOWER(hipodromo) LIKE LOWER(?) OR LOWER(notas) LIKE LOWER(?) )
           LIMIT 1`,
        )
        .get(fecha, `%${odd.race_name}%`, `%${odd.race_name}%`) as any
      if (!carrera) continue

      for (const bk of odd.bookmakers) {
        if (!bk.outcomes.length) continue
        upsert.run(carrera.id, bk.key, bk.title, JSON.stringify(bk.outcomes))
        sincronizadas++
      }
    }
  })
  transaccion()
  return { ok: true, sincronizadas }
}

/**
 * Lee odds cacheadas para una carrera.
 */
export function oddsDeCarrera(carreraId: number) {
  const db = getDatabase()
  return db
    .prepare('SELECT * FROM hipico_carreras_odds WHERE carrera_id = ? ORDER BY bookmaker_nombre')
    .all(carreraId)
}
