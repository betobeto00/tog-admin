// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callApi } from './api-client'
import { useAuthStore } from '@core/auth/store'

const invokeMock = vi.fn()

const loggedIn = {
  usuario: { id: 7, usuario: 'admin', nombre: 'Admin', rol: 'admin' as const },
  sessionToken: 'tok-7',
  isAuthenticated: true,
}

describe('callApi — inyección de sesión y canales pre-auth', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    ;(window as any).api = { invoke: invokeMock }
    useAuthStore.setState({ usuario: null, sessionToken: null, isAuthenticated: false })
  })

  it('agrega session_token y usuario_id al primer argumento objeto en canales con sesión', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue([{ id: 1 }])
    await callApi('ventas:list', { fecha_inicio: '2026-01-01' })
    expect(invokeMock).toHaveBeenCalledWith('ventas:list', {
      fecha_inicio: '2026-01-01',
      session_token: 'tok-7',
      usuario_id: 7,
    })
  })

  it('el token es lo que autoriza: con token y sin usuario en el store igual viaja el token', async () => {
    useAuthStore.setState({ usuario: null, sessionToken: 'tok-solo', isAuthenticated: true })
    invokeMock.mockResolvedValue({ ok: true })
    await callApi('caja:status')
    expect(invokeMock).toHaveBeenCalledWith('caja:status', { session_token: 'tok-solo' })
  })

  it('no pisa un session_token ya presente en los argumentos', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue({ ok: true })
    await callApi('red:logout', { session_token: 'tok-explicito' })
    expect(invokeMock).toHaveBeenCalledWith('red:logout', {
      session_token: 'tok-explicito',
      usuario_id: 7,
    })
  })

  it('sin sesión no manda ni token ni usuario_id (el main debe rechazar el canal)', async () => {
    invokeMock.mockResolvedValue({ ok: true })
    await callApi('caja:status')
    expect(invokeMock).toHaveBeenCalledWith('caja:status')
  })

  it('no inyecta sesión ni desplaza argumentos en canales PREAUTH (license:import) aunque haya sesión', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue({ success: true })
    await callApi('license:import', '{"cliente":"x","firma":"abc"}')
    expect(invokeMock).toHaveBeenCalledWith('license:import', '{"cliente":"x","firma":"abc"}')
  })

  it('deja los argumentos intactos cuando no hay sesión', async () => {
    invokeMock.mockResolvedValue([])
    await callApi('ventas:list', { fecha_inicio: '2026-01-01' })
    expect(invokeMock).toHaveBeenCalledWith('ventas:list', { fecha_inicio: '2026-01-01' })
  })

  it('canal sin argumentos con sesión envía { session_token, usuario_id }', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue({ ok: true })
    await callApi('caja:status')
    expect(invokeMock).toHaveBeenCalledWith('caja:status', { session_token: 'tok-7', usuario_id: 7 })
  })

  it('respuesta { success: false } lanza error con el mensaje del main', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue({ success: false, error: "Permiso denegado: 'pos_access' requerido", channel: 'ventas:list' })
    await expect(callApi('ventas:list', {})).rejects.toThrow("Permiso denegado: 'pos_access' requerido")
  })

  it('respuesta exitosa se devuelve tal cual', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue({ success: true, id: 1 })
    const out = await callApi<{ success: boolean; id: number }>('ventas:create', {})
    expect(out).toEqual({ success: true, id: 1 })
  })
})
