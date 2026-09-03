// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { callApi } from './api-client'
import { useAuthStore } from '@core/auth/store'

const invokeMock = vi.fn()

const loggedIn = {
  usuario: { id: 7, usuario: 'admin', nombre: 'Admin', rol: 'admin' as const },
  isAuthenticated: true,
}

describe('callApi — inyección de usuario y canales pre-auth', () => {
  beforeEach(() => {
    invokeMock.mockReset()
    ;(window as any).api = { invoke: invokeMock }
    useAuthStore.setState({ usuario: null, isAuthenticated: false })
  })

  it('agrega usuario_id al primer argumento objeto en canales con sesión', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue([{ id: 1 }])
    await callApi('ventas:list', { fecha_inicio: '2026-01-01' })
    expect(invokeMock).toHaveBeenCalledWith('ventas:list', { fecha_inicio: '2026-01-01', usuario_id: 7 })
  })

  it('no inyecta ni desplaza argumentos en canales PREAUTH (license:import) aunque haya sesión', async () => {
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

  it('canal sin argumentos con sesión envía { usuario_id }', async () => {
    useAuthStore.setState(loggedIn)
    invokeMock.mockResolvedValue({ ok: true })
    await callApi('caja:status')
    expect(invokeMock).toHaveBeenCalledWith('caja:status', { usuario_id: 7 })
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
