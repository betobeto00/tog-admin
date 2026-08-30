import { getDatabase } from '../db/database'

let configCache: Map<string, string> | null = null

export function getConfigMap(): Map<string, string> {
  if (!configCache) {
    const db = getDatabase()
    const rows = db.prepare('SELECT clave, valor FROM configuracion').all() as Array<{
      clave: string
      valor: string
    }>
    configCache = new Map(rows.map((r) => [r.clave, r.valor]))
  }
  return configCache
}

export function getConfig(key: string, fallback = ''): string {
  return getConfigMap().get(key) ?? fallback
}

export function invalidateConfigCache(): void {
  configCache = null
}