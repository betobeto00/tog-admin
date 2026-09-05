import { getDatabase } from '../db/database'

export type RedModo = 'hija' | 'base' | 'local'

// Provider de licencia inyectable (evita electron en tests). Default lazy:
// consulta la licencia local recién cuando se evalúa el modo.
let licenciaValidaProvider: (() => boolean) | null = null

export function setLicenciaValidaProvider(fn: () => boolean): void {
  licenciaValidaProvider = fn
}

function licenciaValida(): boolean {
  if (licenciaValidaProvider) return licenciaValidaProvider()
  try {
    // Lazy require: red-config no debe arrastrar electron al importarse
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { getLicenseStatus } = require('./license')
    return !!getLicenseStatus().valid
  } catch {
    return false
  }
}

export interface HijaConfig {
  baseUrl: string
  parId: string
  certHash: string
  pcNombre: string
  ca?: string | null
  certFingerprint?: string | null
}

function getConfigValue(clave: string): string | null {
  const row = getDatabase().prepare('SELECT valor FROM configuracion WHERE clave = ?').get(clave) as
    | { valor: string }
    | undefined
  return row?.valor ?? null
}

function setConfigValue(clave: string, valor: string): void {
  getDatabase()
    .prepare(
      `INSERT INTO configuracion (clave, valor, descripcion, actualizado_en) VALUES (?, ?, '', datetime('now'))
       ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor, actualizado_en = datetime('now')`,
    )
    .run(clave, valor)
}

/**
 * Modo de la app respecto a la red local:
 * - 'hija'  → instalación enlazada a una PC Base (sin licencia propia).
 * - 'base'  → instalación con licencia local que sirve a PCs hijas.
 * - 'local' → instalación suelta (una sola PC, sin interconexión).
 */
export function getRedModo(): RedModo {
  const modo = getConfigValue('red_modo')
  if (modo === 'hija') return 'hija'
  // La PC que tiene la licencia activa ES la autoridad de la red local
  if (modo === 'base' || licenciaValida()) return 'base'
  return 'local'
}

export function isHija(): boolean {
  return getRedModo() === 'hija'
}

export function isBase(): boolean {
  return getRedModo() === 'base'
}

export function getHijaConfig(): HijaConfig | null {
  if (!isHija()) return null
  const baseUrl = getConfigValue('red_base_url')
  const parId = getConfigValue('red_par_id')
  const certHash = getConfigValue('red_cert_hash')
  const pcNombre = getConfigValue('red_pc_nombre')
  const ca = getConfigValue('red_ca_pem')
  const certFingerprint = getConfigValue('red_cert_fingerprint')
  if (!baseUrl || !parId || !certHash) return null
  return {
    baseUrl,
    parId,
    certHash,
    pcNombre: pcNombre || '',
    ca,
    certFingerprint,
  }
}

export function saveHijaConfig(config: HijaConfig): void {
  setConfigValue('red_modo', 'hija')
  setConfigValue('red_base_url', config.baseUrl)
  setConfigValue('red_par_id', config.parId)
  setConfigValue('red_cert_hash', config.certHash)
  setConfigValue('red_pc_nombre', config.pcNombre)
  if (config.ca) setConfigValue('red_ca_pem', config.ca)
  if (config.certFingerprint) setConfigValue('red_cert_fingerprint', config.certFingerprint)
}

export function clearHijaConfig(): void {
  const db = getDatabase()
  for (const clave of [
    'red_modo',
    'red_base_url',
    'red_par_id',
    'red_cert_hash',
    'red_pc_nombre',
    'red_ca_pem',
    'red_cert_fingerprint',
  ]) {
    db.prepare('DELETE FROM configuracion WHERE clave = ?').run(clave)
  }
}