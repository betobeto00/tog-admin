import { useAuthStore } from '@core/auth/store'
import type { IpcChannel, AnyIpcChannel, IpcPushChannel } from '@shared/ipc-channels'
import type { PapeleriaAPI } from '@shared/papeleria-api'

const PREAUTH_CHANNELS: ReadonlySet<string> = new Set([
  'app:version',
  'auth:login',
  'crash-report:save',
  'i18n:get-lang',
  'i18n:set-lang',
  'license:status',
  'license:sync',
  'license:validate',
  'license:import',
])

function needsUserId(channel: string): boolean {
  return !PREAUTH_CHANNELS.has(channel)
}

function injectUserId(channel: string, args: unknown[]): unknown[] {
  if (!needsUserId(channel)) return args
  const usuario = useAuthStore.getState().usuario
  if (!usuario) return args
  if (args.length === 0) {
    return [{ usuario_id: usuario.id }]
  }
  const first = args[0]
  if (first === null || first === undefined) {
    return [{ usuario_id: usuario.id }]
  }
  if (typeof first === 'object' && !Array.isArray(first)) {
    const merged = { ...(first as Record<string, unknown>) }
    if (merged.usuario_id === undefined) {
      merged.usuario_id = usuario.id
    }
    return [merged, ...args.slice(1)]
  }
  return [{ usuario_id: usuario.id }, ...args]
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
  const patched = injectUserId(channel, args)
  const response = (await window.api.invoke(channel, ...patched)) as T | { success: false; error: string; channel?: string }
  if (isErrorResponse(response)) {
    throw new Error(`IPC Error (${response.channel || channel}): ${response.error}`)
  }
  return response as T
}

export function getApi(): PapeleriaAPI {
  return window.api
}

export type { IpcChannel, IpcPushChannel, AnyIpcChannel }