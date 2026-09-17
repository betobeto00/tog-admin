// MED-04: `config:set` ya rechazaba las claves reservadas, pero `config:get`
// devolvía la tabla de configuración COMPLETA — así que las API keys (el crédito
// del negocio) y la config de Red Local se podían leer igual desde el renderer.
// Estos tests fijan que la guarda de lectura existe.

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { handles, configMap } = vi.hoisted(() => ({
  handles: {} as Record<string, any>,
  configMap: new Map<string, string>(),
}))

vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (c: string, fn: any) => {
    handles[c] = fn
  },
}))
vi.mock('../../core/auth', () => ({
  checkPermissionOrFail: (data: any) =>
    data?.usuario_id === 1
      ? null
      : { success: false, error: 'Permiso denegado', channel: 'config:get' },
}))
vi.mock('../../db/database', () => ({ getDatabase: () => ({ prepare: () => ({ run: () => {} }) }) }))
vi.mock('../../services/configCache', () => ({
  getConfigMap: () => configMap,
  invalidateConfigCache: () => {},
}))

import { registerConfigHandlers } from './config'

registerConfigHandlers()

const leer = (usuario_id = 1) => handles['config:get'](null, { usuario_id })

describe('config:get no expone claves reservadas', () => {
  beforeEach(() => {
    configMap.clear()
    configMap.set('nombre_negocio', 'Bodega OmniMargen')
    configMap.set('currency_name', 'USD')
    configMap.set('sales_tax_rate', '16')
    // Reservadas: secretos y credenciales de red
    configMap.set('odds_api_key', 'odds-secreta-abcd1234')
    configMap.set('racing_api_key', 'racing-secreta-9999')
    configMap.set('otra_api_key', 'clave-arbitraria')
    configMap.set('red_cert_hash', 'hash-secreto')
    configMap.set('red_ca_pem', '-----BEGIN CERTIFICATE-----')
    configMap.set('red_base_url', 'https://10.0.0.5:3002')
    configMap.set('red_par_id', 'par-secreto')
  })

  it('devuelve sólo las claves de negocio, ordenadas', async () => {
    const res = await leer()
    expect(res.map((c: any) => c.clave)).toEqual(['currency_name', 'nombre_negocio', 'sales_tax_rate'])
  })

  it('ningún secreto sobrevive en la respuesta', async () => {
    const serializado = JSON.stringify(await leer())
    for (const prohibido of [
      'odds-secreta',
      'racing-secreta',
      'clave-arbitraria',
      'hash-secreto',
      'BEGIN CERTIFICATE',
      '10.0.0.5',
      'par-secreto',
      '_api_key',
    ]) {
      expect(serializado, prohibido).not.toContain(prohibido)
    }
  })

  it('sigue exigiendo permisos', async () => {
    const res = await leer(2)
    expect(res.success).toBe(false)
    expect(res.error).toBe('Permiso denegado')
  })
})
