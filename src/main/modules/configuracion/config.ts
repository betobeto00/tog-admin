import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getConfigMap, invalidateConfigCache } from '../../services/configCache'
import { configSetSchema, validateInput } from '../../../shared/validations'

/**
 * Claves que el renderer NO puede leer ni escribir por `config:get`/`config:set`.
 *
 * La app las gestiona por sus propios caminos (`red-config.ts`, `hipico/*-api.ts`),
 * que no pasan por estos canales. Sin la guarda de escritura, un usuario con
 * `config_edit` podía reescribir `red_base_url`/`red_cert_hash` (redirigir la
 * terminal a otro servidor) o pisar las claves de APIs externas.
 *
 * Se filtran también en la **lectura** porque si no, la guarda de escritura era
 * cosmética: `config:get` devolvía la tabla entera, así que las API keys (el
 * crédito del negocio) y la config de Red Local se podían leer igual. Los datos
 * de Red Local que la UI sí necesita salen por `red:status`.
 */
const RESERVED_CONFIG_KEYS: ReadonlySet<string> = new Set([
  'red_modo',
  'red_base_url',
  'red_par_id',
  'red_cert_hash',
  'red_pc_nombre',
  'red_ca_pem',
  'red_cert_fingerprint',
  'odds_api_key',
  'odds_api_base',
  'racing_api_key',
])

function isReservedConfigKey(clave: string): boolean {
  return RESERVED_CONFIG_KEYS.has(clave) || clave.endsWith('_api_key')
}

export function registerConfigHandlers(): void {
  handleIpc('config:get', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'config:get', 'config_access')
    if (fail) return fail
    const map = getConfigMap()
    return Array.from(map, ([clave, valor]) => ({ clave, valor }))
      .filter(({ clave }) => !isReservedConfigKey(clave))
      .sort((a, b) => a.clave.localeCompare(b.clave))
  })

  handleIpc('config:set', async (_event, data: { clave: string; valor: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'config:set', 'config_edit')
    if (fail) return fail
    const invalid = validateInput(configSetSchema, data)
    if (!invalid.ok) return { success: false, error: invalid.error }
    const clave = data.clave.trim()
    if (isReservedConfigKey(clave)) {
      return { success: false, error: `La configuración '${clave}' no se puede editar desde acá` }
    }
    const db = getDatabase()
    db.prepare(
      "INSERT OR REPLACE INTO configuracion (clave, valor, actualizado_en) VALUES (?, ?, datetime('now'))"
    ).run(clave, data.valor)
    invalidateConfigCache()
    return { success: true }
  })
}