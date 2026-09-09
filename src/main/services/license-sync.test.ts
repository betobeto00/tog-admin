import { describe, it, expect, vi } from 'vitest'
import { syncLicenseFromServer, syncLicenseWithAccount } from './license-sync'

const licenciaValida = {
  cliente: 'Corn Flakes LLC',
  expira: '2027-12-31',
  version: '1.0.0',
  machineId: null,
  modules: ['distribuidor'],
  emitida: '2026-09-01T00:00:00.000Z',
  id: 'abc123',
  firma: 'firma-base64',
}

function okFetch(status = 200, body: any = {}) {
  return vi.fn(async (_url: string, _init: any) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }))
}

describe('syncLicenseFromServer', () => {
  it('descarga, guarda y reporta la licencia activa', async () => {
    const fetchImpl = okFetch(200, { success: true, licencia: licenciaValida })
    const saveImpl = vi.fn(() => ({ success: true }))

    const result = await syncLicenseFromServer(
      { url: 'https://licencias.ejemplo.com/', empresaId: 7, apiKey: 'clave-123' },
      { fetchImpl, saveImpl },
    )

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.cliente).toBe('Corn Flakes LLC')
      expect(result.expira).toBe('2027-12-31')
      expect(result.modulos).toEqual(['distribuidor'])
    }
    // URL normalizada (sin barra final) + headers correctos
    const [calledUrl, init] = fetchImpl.mock.calls[0] as [string, any]
    expect(calledUrl).toBe('https://licencias.ejemplo.com/api/empresas/7/licencia')
    expect(init.headers['x-api-key']).toBe('clave-123')
    // Se guarda el JSON crudo de la licencia (con firma) para validación RSA
    expect(saveImpl).toHaveBeenCalledWith(JSON.stringify(licenciaValida))
  })

  it('propaga el error del servidor (ej: sin licencia activa)', async () => {
    const fetchImpl = okFetch(404, { success: false, error: 'Sin licencia activa' })
    const result = await syncLicenseFromServer(
      { url: 'http://localhost:3001', empresaId: '2', apiKey: 'k' },
      { fetchImpl },
    )
    expect(result).toEqual({ success: false, error: 'Sin licencia activa' })
  })

  it('devuelve mensaje claro si no se puede conectar', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: any) => {
      throw new Error('ECONNREFUSED')
    })
    const result = await syncLicenseFromServer(
      { url: 'http://localhost:3001', empresaId: 1, apiKey: 'k' },
      { fetchImpl },
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No se pudo conectar')
  })

  it('aborta con timeout y avisa al usuario', async () => {
    const fetchImpl = vi.fn(
      (_url: string, init: any): Promise<never> =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const err: any = new Error('aborted')
            err.name = 'AbortError'
            reject(err)
          })
        }),
    )
    const result = await syncLicenseFromServer(
      { url: 'http://localhost:3001', empresaId: 1, apiKey: 'k' },
      { fetchImpl, timeoutMs: 20 },
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('Tiempo de espera')
  })

  it('valida los parámetros de entrada', async () => {
    const sinUrl = await syncLicenseFromServer({ url: '', empresaId: 1, apiKey: 'k' })
    expect(sinUrl.success).toBe(false)

    const urlMala = await syncLicenseFromServer({ url: 'ftp://x', empresaId: 1, apiKey: 'k' })
    expect(urlMala.success).toBe(false)

    const idMalo = await syncLicenseFromServer({ url: 'http://x', empresaId: 'abc', apiKey: 'k' })
    expect(idMalo.success).toBe(false)

    const sinKey = await syncLicenseFromServer({ url: 'http://x', empresaId: 1, apiKey: ' ' })
    expect(sinKey.success).toBe(false)
  })

  it('informa si el guardado local falla (firma inválida, etc.)', async () => {
    const fetchImpl = okFetch(200, { success: true, licencia: licenciaValida })
    const saveImpl = vi.fn(() => ({ success: false, error: 'Firma RSA inválida' }))
    const result = await syncLicenseFromServer(
      { url: 'http://localhost:3001', empresaId: 1, apiKey: 'k' },
      { fetchImpl, saveImpl },
    )
    expect(result).toEqual({ success: false, error: 'Firma RSA inválida' })
  })

  it('rechaza respuestas sin licencia firmada', async () => {
    const fetchImpl = okFetch(200, { success: true, licencia: { cliente: 'X' } })
    const result = await syncLicenseFromServer(
      { url: 'http://localhost:3001', empresaId: 1, apiKey: 'k' },
      { fetchImpl },
    )
    expect(result.success).toBe(false)
  })
})

describe('syncLicenseWithAccount', () => {
  it('login → perfil → descarga la licencia de la empresa vinculada', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, token: 'token-123', user: { email: 'a@b.com' } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          empresa: { id: 9, nombre: 'AgroMaíz', api_key: 'api-key-9' },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, licencia: licenciaValida }),
      })
    const saveImpl = vi.fn(() => ({ success: true }))

    const result = await syncLicenseWithAccount(
      { url: 'https://licencias.ejemplo.com/', email: 'a@b.com', password: 'secreto' },
      { fetchImpl, saveImpl },
    )

    expect(result.success).toBe(true)
    if (result.success) expect(result.cliente).toBe('Corn Flakes LLC')
    const loginCall = fetchImpl.mock.calls[0] as [string, any]
    expect(loginCall[0]).toBe('https://licencias.ejemplo.com/api/auth/login')
    expect(loginCall[1].headers['Content-Type']).toBe('application/json')
    const profileCall = fetchImpl.mock.calls[1] as [string, any]
    expect(profileCall[1].headers.Authorization).toBe('Bearer token-123')
    const licenciaCall = fetchImpl.mock.calls[2] as [string, any]
    expect(licenciaCall[0]).toBe('https://licencias.ejemplo.com/api/empresas/9/licencia')
    expect(licenciaCall[1].headers['x-api-key']).toBe('api-key-9')
    expect(saveImpl).toHaveBeenCalledWith(JSON.stringify(licenciaValida))
  })

  it('propaga el error del login (credenciales incorrectas)', async () => {
    const fetchImpl = okFetch(401, { success: false, error: 'Email o contraseña incorrectos' })
    const result = await syncLicenseWithAccount(
      { url: 'http://localhost:3001', email: 'a@b.com', password: 'mala' },
      { fetchImpl },
    )
    expect(result).toEqual({ success: false, error: 'Email o contraseña incorrectos' })
  })

  it('informa cuando la cuenta no tiene empresa vinculada', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, token: 't' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, user: { email: 'a@b.com' }, empresa: null }),
      })
    const result = await syncLicenseWithAccount(
      { url: 'http://localhost:3001', email: 'a@b.com', password: 'secreto' },
      { fetchImpl },
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('empresa vinculada')
  })

  it('devuelve mensaje claro si no se puede conectar', async () => {
    const fetchImpl = vi.fn(async (_url: string, _init: any) => {
      throw new Error('ECONNREFUSED')
    })
    const result = await syncLicenseWithAccount(
      { url: 'http://localhost:3001', email: 'a@b.com', password: 'x' },
      { fetchImpl },
    )
    expect(result.success).toBe(false)
    if (!result.success) expect(result.error).toContain('No se pudo conectar')
  })

  it('valida los parámetros de entrada', async () => {
    const sinUrl = await syncLicenseWithAccount({ url: '', email: 'a@b.com', password: 'x' })
    expect(sinUrl.success).toBe(false)
    const sinEmail = await syncLicenseWithAccount({ url: 'http://x', email: '', password: 'x' })
    expect(sinEmail.success).toBe(false)
    const sinPass = await syncLicenseWithAccount({ url: 'http://x', email: 'a@b.com', password: '' })
    expect(sinPass.success).toBe(false)
    const urlMala = await syncLicenseWithAccount({ url: 'ftp://x', email: 'a@b.com', password: 'x' })
    expect(urlMala.success).toBe(false)
  })
})
