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
  if (!webContents) {
    console.error('[IPC Guard] no webContents')
    return false
  }

  const prefs = (webContents as any).webPreferences
  if (prefs?.contextIsolation !== true) {
    console.error('[IPC Guard] contextIsolation !== true, prefs:', JSON.stringify(prefs))
    return false
  }

  // getURL() puede no estar disponible en algunos contextos sandboxed
  let url: string
  try {
    url = typeof webContents.getURL === 'function' ? webContents.getURL() : ''
  } catch {
    url = ''
  }
  if (!url) {
    console.error('[IPC Guard] empty URL, webContents.getURL type:', typeof webContents.getURL)
    return false
  }
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
