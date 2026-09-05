import https from 'node:https'
import http from 'node:http'
import { URL } from 'node:url'
import { getHijaConfig, saveHijaConfig, clearHijaConfig, type HijaConfig } from './red-config'
import { logger } from './logger'

const RPC_TIMEOUT_MS = 15_000
const HEARTBEAT_TIMEOUT_MS = 5_000

export interface VincularResult {
  success: boolean
  error?: string
  parId?: string
  certHash?: string
  certFingerprint?: string
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  return String(err)
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/+$/, '')
}

function agentFor(baseUrl: string, caPem: string | null | undefined): https.Agent | http.Agent {
  const isHttps = baseUrl.startsWith('https://')
  if (isHttps) {
    return new https.Agent({
      ca: caPem ?? undefined,
      rejectUnauthorized: caPem ? true : false,
      keepAlive: false,
    })
  }
  return new http.Agent({ keepAlive: false })
}

interface RawResponse {
  status: number
  json: any
}

function postJson(
  baseUrl: string,
  path: string,
  body: unknown,
  caPem: string | null | undefined,
  timeoutMs: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const isHttps = baseUrl.startsWith('https://')
    const transport: typeof https | typeof http = isHttps ? https : http
    const agent = agentFor(baseUrl, caPem)
    const payload = Buffer.from(JSON.stringify(body))
    const req = transport.request(
      {
        method: 'POST',
        host: new URL(baseUrl).hostname,
        port: new URL(baseUrl).port || (isHttps ? 443 : 80),
        path,
        agent,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': payload.length,
        },
      },
      (res) => {
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          let json: any = {}
          try {
            json = data ? JSON.parse(data) : {}
          } catch {
            json = { success: false, error: 'Respuesta inválida de la PC Base' }
          }
          resolve({ status: res.statusCode ?? 0, json })
        })
      },
    )
    req.on('error', reject)
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`Timeout contacting ${baseUrl}${path}`))
    })
    req.write(payload)
    req.end()
  })
}

export async function vincularABase(baseUrl: string, codigo: string, nombre: string): Promise<VincularResult> {
  const url = normalizeBaseUrl(baseUrl)
  try {
    const r = await postJson(url, '/api/red/vincular', { codigo, nombre }, null, RPC_TIMEOUT_MS)
    if (r.status !== 201 || !r.json?.success) {
      return { success: false, error: r.json?.error || `Error al vincular (HTTP ${r.status})` }
    }
    if (url.startsWith('https://') && !r.json?.cert_pem) {
      return {
        success: false,
        error: 'La PC Base no expuso su certificado TLS. Verificá que la Base tenga HTTPS habilitado.',
      }
    }
    saveHijaConfig({
      baseUrl: url,
      parId: r.json.par_id,
      certHash: r.json.cert_hash,
      pcNombre: nombre,
      ca: r.json?.cert_pem ?? null,
      certFingerprint: r.json?.cert_fingerprint ?? null,
    })
    logger.info('red', `PC enlazada a Base ${url} como "${nombre}"`)
    return {
      success: true,
      parId: r.json.par_id,
      certHash: r.json.cert_hash,
      certFingerprint: r.json?.cert_fingerprint,
    }
  } catch (err) {
    return { success: false, error: `No se pudo contactar la PC Base en ${url}: ${errorMessage(err)}` }
  }
}

export function desvincularDeBase(): void {
  clearHijaConfig()
  logger.info('red', 'PC desvinculada de la Base')
}

export async function rpcABase(canal: string, args: unknown[]): Promise<any> {
  const config = getHijaConfig()
  if (!config) {
    throw new Error('Esta PC no está enlazada a una PC Base')
  }
  try {
    const r = await postJson(
      config.baseUrl,
      '/api/red/rpc',
      { canal, args, par_id: config.parId, cert_hash: config.certHash },
      config.ca ?? null,
      RPC_TIMEOUT_MS,
    )
    if (r.status >= 400) {
      const err = r.json?.error || `Error de red (HTTP ${r.status})`
      if (r.status === 401) {
        throw new Error(`Sin autorización en la PC Base: ${err}`)
      }
      throw new Error(err)
    }
    return r.json?.response
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Timeout contacting')) {
      throw new Error(`La PC Base no respondió (${config.baseUrl}). Verificá que esté encendida y en la misma red.`)
    }
    throw err
  }
}

export async function logoutEnBase(): Promise<void> {
  const config = getHijaConfig()
  if (!config) return
  try {
    await postJson(
      config.baseUrl,
      '/api/red/logout',
      { par_id: config.parId, cert_hash: config.certHash },
      config.ca ?? null,
      HEARTBEAT_TIMEOUT_MS,
    )
  } catch {
    // best-effort
  }
}

export interface HeartbeatResult {
  ok: boolean
  error?: string
  serverTime?: string
}

export async function heartbeatABase(): Promise<HeartbeatResult> {
  const config = getHijaConfig()
  if (!config) return { ok: false, error: 'Esta PC no está enlazada a una PC Base' }
  try {
    const r = await postJson(
      config.baseUrl,
      '/api/red/heartbeat',
      { par_id: config.parId, cert_hash: config.certHash },
      config.ca ?? null,
      HEARTBEAT_TIMEOUT_MS,
    )
    if (r.status !== 200 || !r.json?.success) {
      return { ok: false, error: r.json?.error || `HTTP ${r.status}` }
    }
    return { ok: true, serverTime: r.json?.server_time }
  } catch (err) {
    return { ok: false, error: errorMessage(err) }
  }
}

export type { HijaConfig }
