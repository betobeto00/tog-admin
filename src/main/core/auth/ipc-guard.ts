import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-channels'

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173'])

/**
 * Frontera real de canales: solo se puede registrar (y por lo tanto exponer al
 * renderer) un canal declarado en `IPC_CHANNELS`. El preload expone un
 * `invoke` genérico, pero `ipcRenderer.invoke` solo alcanza canales con
 * `ipcMain.handle` registrado — así que este chequeo es lo que impide que un
 * canal interno futuro (debug, telemetría) quede accesible sin querer.
 */
const KNOWN_CHANNELS: ReadonlySet<string> = new Set(IPC_CHANNELS as readonly string[])

const ipcListeners = new Map<string, (event: any, ...args: any[]) => any>()

export function getIpcListener(channel: string): ((...args: any[]) => any) | undefined {
  return ipcListeners.get(channel)
}

export function isTrustedSender(event: IpcMainInvokeEvent): boolean {
  const webContents = event.sender
  if (!webContents) return false

  let url: string
  try {
    url = typeof (webContents as any).getURL === 'function' ? (webContents as any).getURL() : ''
  } catch {
    url = ''
  }

  if (!url) return false
  if (url.startsWith('file://')) return true
  try {
    return DEV_ALLOWED_ORIGINS.has(new URL(url).origin)
  } catch {
    return false
  }
}

export function handleIpc(
  channel: string,
  listener: (event: IpcMainInvokeEvent, ...args: any[]) => any,
): void {
  if (!KNOWN_CHANNELS.has(channel)) {
    throw new Error(
      `IPC channel not declared in IPC_CHANNELS: "${channel}". ` +
        `Add it to src/shared/ipc-channels.ts before registering a handler.`,
    )
  }
  ipcListeners.set(channel, listener)
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`IPC blocked: untrusted sender for channel "${channel}"`)
    }
    return listener(event, ...args)
  })
}
