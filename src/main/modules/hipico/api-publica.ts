/**
 * Conexión con una API pública de carreras (FASE 7).
 *
 * No todas las hípicas publican datos abiertos, así que el diseño es:
 *   1. El cliente configura una URL que devuelva un JSON con carreras.
 *   2. Se normaliza lo que se pueda reconocer (campos con nombres habituales).
 *   3. Si la API no responde o devuelve algo inesperado, se avisa y la carga
 *      manual sigue disponible: la app nunca depende de la API para operar.
 */

import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { guardarConfig, leerConfig } from '../../services/fiscal'

export const CLAVE_API_URL = 'hipico_api_url'

export interface CarreraImportada {
  hipodromo: string
  fecha: string
  numero_carrera: number
  distancia_m: number | null
  categoria: string | null
  premio: number | null
}

/** Primera clave presente en el objeto (las APIs no son consistentes). */
function tomar(raw: Record<string, any>, claves: string[]): any {
  for (const clave of claves) {
    if (raw?.[clave] !== undefined && raw?.[clave] !== null && raw[clave] !== '') return raw[clave]
  }
  return undefined
}

/** Normaliza una carrera cruda. Devuelve null si no tiene lo mínimo indispensable. */
export function normalizarCarreraExterna(raw: any): CarreraImportada | null {
  if (!raw || typeof raw !== 'object') return null
  const hipodromo = String(tomar(raw, ['hipodromo', 'hipódromo', 'track', 'racetrack', 'pista']) ?? '').trim()
  const fechaCruda = tomar(raw, ['fecha', 'date', 'fecha_carrera'])
  const numeroCrudo = tomar(raw, ['numero_carrera', 'numero', 'race_number', 'nro_carrera', 'carrera'])

  const fecha = fechaCruda ? String(fechaCruda).slice(0, 10) : ''
  const numero = Number(numeroCrudo)
  if (!hipodromo || !/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isInteger(numero) || numero <= 0) return null

  const distancia = Number(tomar(raw, ['distancia_m', 'distancia', 'distance']))
  const premio = Number(tomar(raw, ['premio', 'prize', 'bolsa']))
  const categoria = tomar(raw, ['categoria', 'categoría', 'category', 'condicion'])

  return {
    hipodromo,
    fecha,
    numero_carrera: numero,
    distancia_m: Number.isFinite(distancia) && distancia > 0 ? Math.trunc(distancia) : null,
    categoria: categoria ? String(categoria).slice(0, 60) : null,
    premio: Number.isFinite(premio) && premio > 0 ? premio : null,
  }
}

/** Normaliza una respuesta que puede ser un array o `{ carreras: [...] }`. */
export function normalizarCarreras(raw: unknown): CarreraImportada[] {
  const lista = Array.isArray(raw)
    ? raw
    : Array.isArray((raw as any)?.carreras)
      ? (raw as any).carreras
      : Array.isArray((raw as any)?.data)
        ? (raw as any).data
        : []
  return lista.map(normalizarCarreraExterna).filter((c: CarreraImportada | null): c is CarreraImportada => c !== null)
}

export interface ResultadoImportacion {
  ok: boolean
  carreras: CarreraImportada[]
  descartadas: number
  error?: string
}

/** Trae y normaliza las carreras. Nunca lanza: devuelve `ok:false` con el motivo. */
export async function obtenerCarrerasDeApi(
  url: string,
  deps: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<ResultadoImportacion> {
  const destino = (url || '').trim()
  if (!/^https?:\/\/.+/i.test(destino)) {
    return { ok: false, carreras: [], descartadas: 0, error: 'La URL de la API debe empezar con http:// o https://' }
  }

  const fetchImpl = deps.fetchImpl || globalThis.fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), deps.timeoutMs ?? 10_000)
  try {
    const res = await fetchImpl(destino, { headers: { Accept: 'application/json' }, signal: controller.signal })
    if (!res.ok) return { ok: false, carreras: [], descartadas: 0, error: `La API respondió ${res.status}` }
    const json = await res.json()
    const carreras = normalizarCarreras(json)
    const total = Array.isArray(json) ? json.length : (json as any)?.carreras?.length ?? (json as any)?.data?.length ?? 0
    if (carreras.length === 0) {
      return { ok: false, carreras: [], descartadas: total, error: 'La API no devolvió carreras con el formato esperado' }
    }
    return { ok: true, carreras, descartadas: Math.max(total - carreras.length, 0) }
  } catch (err: any) {
    return {
      ok: false,
      carreras: [],
      descartadas: 0,
      error: err?.name === 'AbortError' ? 'La API tardó demasiado en responder' : `No se pudo consultar la API: ${err?.message || err}`,
    }
  } finally {
    clearTimeout(timer)
  }
}

export function registerApiHipicaHandlers(): void {
  handleIpc('hipico:api-config', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-config', 'hipico_view')
    if (fail) return fail
    const db = getDatabase()
    if (typeof data?.url === 'string') {
      const fail2 = checkPermissionOrFail(data, 'hipico:api-config', 'hipico_edit')
      if (fail2) return fail2
      guardarConfig(db, CLAVE_API_URL, data.url.trim())
    }
    return { url: leerConfig(db, CLAVE_API_URL) }
  })

  /**
   * Consulta la API y, si `guardar` es true, inserta las carreras nuevas.
   * Las existentes (mismo hipódromo/fecha/número) se omiten sin error.
   */
  handleIpc('hipico:api-importar', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'hipico:api-importar', 'hipico_edit')
    if (fail) return fail
    const db = getDatabase()
    const url = typeof data?.url === 'string' && data.url.trim() ? data.url.trim() : leerConfig(db, CLAVE_API_URL)
    const resultado = await obtenerCarrerasDeApi(url)
    if (!resultado.ok) return { success: false, error: resultado.error, carreras: [] }

    if (data?.guardar === false) {
      return { success: true, carreras: resultado.carreras, descartadas: resultado.descartadas, guardadas: 0 }
    }

    const insert = db.prepare(
      `INSERT OR IGNORE INTO hipico_carreras (hipodromo, fecha, numero_carrera, distancia_m, categoria, premio, estado, fuente)
       VALUES (?, ?, ?, ?, ?, ?, 'programada', 'api')`,
    )
    let guardadas = 0
    const transaccion = db.transaction(() => {
      for (const carrera of resultado.carreras) {
        const res = insert.run(
          carrera.hipodromo,
          carrera.fecha,
          carrera.numero_carrera,
          carrera.distancia_m,
          carrera.categoria,
          carrera.premio,
        )
        if (res.changes > 0) guardadas++
      }
    })
    transaccion()
    return {
      success: true,
      carreras: resultado.carreras,
      descartadas: resultado.descartadas,
      guardadas,
    }
  })
}
