import { getHijaConfig, saveHijaConfig, clearHijaConfig, type HijaConfig } from './red-config'
import { logger } from './logger'

const RPC_TIMEOUT_MS = 15_000

export interface VincularResult {
  success: boolean
  error?: string
  parId?: string
  certHash?: string
}

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

/**
 * Vincula esta PC a una PC Base usando el código de enlace. Si la Base
 * acepta, persiste la config hija (baseUrl + credenciales de par).
 */
export async function vincularABase(baseUrl: string, codigo: string, nombre: string): Promise<VincularResult> {
  const url = normalizeBaseUrl(baseUrl)
  try {
    const res = await fetch(`${url}/api/red/vincular`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigo, nombre }),
      signal: timeoutSignal(RPC_TIMEOUT_MS),
    })
    const body: any = await res.json().catch(() => ({ success: false, error: 'Respuesta inválida de la PC Base' }))
    if (!res.ok || !body?.success) {
      return { success: false, error: body?.error || `Error al vincular (HTTP ${res.status})` }
    }
    saveHijaConfig({
      baseUrl: url,
      parId: body.par_id,
      certHash: body.cert_hash,
      pcNombre: nombre,
    })
    logger.info('red', `PC enlazada a Base ${url} como "${nombre}"`)
    return { success: true, parId: body.par_id, certHash: body.cert_hash }
  } catch (err) {
    return { success: false, error: `No se pudo contactar la PC Base en ${url}: ${errorMessage(err)}` }
  }
}

/**
 * Desvincula esta PC de la Base (borra la config hija local).
 */
export function desvincularDeBase(): void {
  clearHijaConfig()
  logger.info('red', 'PC desvinculada de la Base')
}

/**
 * Reenvía un canal IPC a la Base vía HTTP. Devuelve exactamente lo que
 * devolvió el handler en la Base (misma forma que una respuesta IPC local).
 */
export async function rpcABase(canal: string, args: unknown[]): Promise<any> {
  const config = getHijaConfig()
  if (!config) {
    throw new Error('Esta PC no está enlazada a una PC Base')
  }
  try {
    const res = await fetch(`${config.baseUrl}/api/red/rpc`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ canal, args, par_id: config.parId, cert_hash: config.certHash }),
      signal: timeoutSignal(RPC_TIMEOUT_MS),
    })
    const body: any = await res.json().catch(() => ({}))
    if (!res.ok) {
      const err = body?.error || `Error de red (HTTP ${res.status})`
      if (res.status === 401) {
        throw new Error(`Sin autorización en la PC Base: ${err}`)
      }
      if (res.status === 409) {
        throw new Error(err)
      }
      throw new Error(err)
    }
    return body?.response
  } catch (err) {
    if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
      throw new Error(`La PC Base no respondió (${config.baseUrl}). Verificá que esté encendida y en la misma red.`)
    }
    throw err
  }
}

/**
 * Avisa a la Base que esta PC cierra sesión (libera las sesiones del par).
 */
export async function logoutEnBase(): Promise<void> {
  const config = getHijaConfig()
  if (!config) return
  try {
    await fetch(`${config.baseUrl}/api/red/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ par_id: config.parId, cert_hash: config.certHash }),
      signal: timeoutSignal(5_000),
    })
  } catch {
    // best-effort: si la Base no responde, la sesión se libera sola al reingresar
  }
}

export type { HijaConfig }