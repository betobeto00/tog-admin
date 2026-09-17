import { useAuthStore } from '@core/auth/store'
import type { IpcChannel, AnyIpcChannel, IpcPushChannel } from '@shared/ipc-channels'
import { PREAUTH_CHANNELS as PREAUTH_CHANNELS_RAW } from '@shared/ipc-channels'

const PREAUTH_CHANNELS: ReadonlySet<string> = new Set(PREAUTH_CHANNELS_RAW as readonly string[])

function needsAuth(channel: string): boolean {
  return !PREAUTH_CHANNELS.has(channel)
}

/**
 * Adjunta credenciales de sesión a la llamada.
 *
 * - `session_token`: es lo que **autoriza** en el main (el `usuario_id` ya no
 *   se cree: ver `core/auth/permissions.ts`).
 * - `usuario_id`: se sigue mandando porque los handlers lo persisten en la BD
 *   (ventas, caja, auditoría) y los schemas Zod lo piden; el main lo
 *   **normaliza** al usuario de la sesión antes de usarlo, así que no sirve
 *   para suplantar.
 */
function injectAuth(channel: string, args: unknown[]): unknown[] {
  if (!needsAuth(channel)) return args
  const { usuario, sessionToken } = useAuthStore.getState()
  if (!usuario && !sessionToken) return args

  const withAuth = (target: Record<string, unknown>): Record<string, unknown> => {
    if (sessionToken && target.session_token === undefined) {
      target.session_token = sessionToken
    }
    if (usuario && target.usuario_id === undefined) {
      target.usuario_id = usuario.id
    }
    return target
  }

  if (args.length === 0) {
    return [withAuth({})]
  }
  const first = args[0]
  if (first === null || first === undefined) {
    return [withAuth({})]
  }
  if (typeof first === 'object' && !Array.isArray(first)) {
    return [withAuth({ ...(first as Record<string, unknown>) }), ...args.slice(1)]
  }
  return [withAuth({}), ...args]
}

function isErrorResponse(response: unknown): response is { success: false; error: string; channel?: string } {
  return (
    response !== null &&
    typeof response === 'object' &&
    'success' in response &&
    (response as Record<string, unknown>).success === false &&
    'error' in response &&
    typeof (response as Record<string, unknown>).error === 'string'
  )
}

export async function callApi<T = unknown>(
  channel: AnyIpcChannel,
  ...args: unknown[]
): Promise<T> {
  const patched = injectAuth(channel, args)
  const response = (await window.api.invoke(channel, ...patched)) as T | { success: false; error: string; channel?: string }
  if (isErrorResponse(response)) {
    throw new Error(`IPC Error (${response.channel || channel}): ${response.error}`)
  }
  return response as T
}

// Nota: se eliminó el helper `getApi()` (devolvía `window.api` crudo). Era la
// vía para saltear `callApi`, y desde que la identidad viaja en `session_token`
// saltearlo significa llegar al main sin credencial: todo canal no-preauth
// falla con "requiere sesión activa". Para llamar a la API, usar `callApi`.

export type { IpcChannel, IpcPushChannel, AnyIpcChannel }