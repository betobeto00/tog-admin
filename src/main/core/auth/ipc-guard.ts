import { ipcMain, type IpcMainInvokeEvent } from 'electron'

const DEV_ALLOWED_ORIGINS = new Set(['http://localhost:5173'])

const ipcListeners = new Map<string, (event: any, ...args: any[]) => any>()

export function getIpcListener(channel: string): ((...args: any[]) => any) | undefined {
  return ipcListeners.get(channel)
}

export function hasIpcListener(channel: string): boolean {
  return ipcListeners.has(channel)
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
  ipcListeners.set(channel, listener)
  ipcMain.handle(channel, (event, ...args) => {
    if (!isTrustedSender(event)) {
      throw new Error(`IPC blocked: untrusted sender for channel "${channel}"`)
    }
    return listener(event, ...args)
  })
}
