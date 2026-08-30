import { autoUpdater, UpdateInfo } from 'electron-updater'
import { app, BrowserWindow, dialog, shell } from 'electron'
import log from 'electron-log'

// Configurar logging
autoUpdater.logger = log

// Deshabilitar auto-download — solo notificaremos al usuario
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let mainWindow: BrowserWindow | null = null

export function setupAutoUpdater(win: BrowserWindow): void {
  mainWindow = win

  // Cuando hay una actualización disponible
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info(`[Updater] Actualización disponible: v${info.version}`)

    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Actualización disponible',
        message: `TOG Admin v${info.version} está disponible.`,
        detail: '¿Deseas descargar e instalar la actualización ahora?',
        buttons: ['Actualizar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.downloadUpdate()
        }
      })
  })

  // Progreso de descarga
  autoUpdater.on('download-progress', (progress) => {
    if (mainWindow) {
      mainWindow.webContents.send('update:progress', {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      })
    }
  })

  // Cuando la descarga termina
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info(`[Updater] Descarga completada: v${info.version}`)

    dialog
      .showMessageBox(mainWindow!, {
        type: 'info',
        title: 'Actualización lista',
        message: 'La actualización se ha descargado.',
        detail: 'La aplicación se reiniciará para aplicar la actualización.',
        buttons: ['Reiniciar ahora', 'Más tarde'],
        defaultId: 0,
        cancelId: 1,
      })
      .then(({ response }) => {
        if (response === 0) {
          autoUpdater.quitAndInstall()
        }
      })
  })

  // Errores
  autoUpdater.on('error', (err) => {
    log.error('[Updater] Error:', err.message)
    console.error('[Updater] Error:', err.message)
  })

  // Log cuando no hay actualización
  autoUpdater.on('update-not-available', () => {
    log.info('[Updater] No hay actualización disponible')
    console.log('[Updater] No hay actualización disponible')
  })

  // Log diagnóstico detallado para debug
  const debugLog = (label: string, data: any) => {
    const line = `[${new Date().toISOString()}] ${label}: ${JSON.stringify(data, null, 2)}`
    console.log(line)
    try {
      const path = require('path')
      const fs = require('fs')
      const logPath = path.join(app.getPath('userData'), 'updater-debug.log')
      fs.appendFileSync(logPath, line + '\n')
    } catch {}
  }

  autoUpdater.on('checking-for-update', () => debugLog('CHECKING', {}))
  autoUpdater.on('update-available', (info) => debugLog('UPDATE_AVAILABLE', { version: info.version, files: info.files?.map(f => f.url) }))
  autoUpdater.on('update-not-available', (info) => debugLog('UPDATE_NOT_AVAILABLE', { version: info?.version }))
  autoUpdater.on('download-progress', (p) => debugLog('DOWNLOAD_PROGRESS', { percent: p.percent }))
  autoUpdater.on('update-downloaded', (info) => debugLog('UPDATE_DOWNLOADED', { version: info.version, downloadedFile: info.downloadedFile }))
  autoUpdater.on('error', (err) => debugLog('UPDATE_ERROR', { message: err.message, stack: err.stack }))

  // Verificar actualizaciones al iniciar (después de 5 segundos)
  setTimeout(() => {
    console.log('[Updater] Verificando actualizaciones...')
    console.log('[Updater] Versión actual:', app.getVersion())
    console.log('[Updater] Publish config:', JSON.stringify(autoUpdater.getFeedURL()))
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[Updater] Error al verificar actualizaciones:', err.message)
      console.error('[Updater] Error al verificar:', err.message)
    })
  }, 5000)

  // Verificar cada 4 horas
  setInterval(() => {
    autoUpdater.checkForUpdates().catch(() => {})
  }, 4 * 60 * 60 * 1000)
}

/**
 * Verifica actualizaciones manualmente (llamado desde IPC).
 */
export async function checkForUpdatesManual(): Promise<{
  available: boolean
  version?: string
  currentVersion?: string
  feedUrl?: string
  error?: string
}> {
  const debugLog = (label: string, data: any) => {
    const line = `[${new Date().toISOString()}] ${label}: ${JSON.stringify(data)}`
    console.log(line)
    try {
      const path = require('path')
      const fs = require('fs')
      const logPath = path.join(app.getPath('userData'), 'updater-debug.log')
      fs.appendFileSync(logPath, line + '\n')
    } catch {}
  }

  try {
    const currentVersion = app.getVersion()
    const feedUrl = autoUpdater.getFeedURL()
    debugLog('MANUAL_CHECK_START', { currentVersion, feedUrl: feedUrl?.toString() })
    const result = await autoUpdater.checkForUpdates()
    debugLog('MANUAL_CHECK_RESULT', {
      hasUpdateInfo: !!result?.updateInfo,
      version: result?.updateInfo?.version,
      files: result?.updateInfo?.files?.map((f: any) => f.url),
    })
    if (result && result.updateInfo) {
      const latestVersion = result.updateInfo.version
      const available = latestVersion !== currentVersion
      debugLog('MANUAL_CHECK_DECISION', { latestVersion, currentVersion, available })
      return {
        available,
        version: latestVersion,
        currentVersion,
        feedUrl: feedUrl?.toString(),
      }
    }
    debugLog('MANUAL_CHECK_NO_UPDATEINFO', { currentVersion, feedUrl: feedUrl?.toString() })
    return { available: false, currentVersion, feedUrl: feedUrl?.toString() }
  } catch (err: any) {
    debugLog('MANUAL_CHECK_ERROR', { message: err.message, stack: err.stack, currentVersion: app.getVersion() })
    return { available: false, error: err.message, currentVersion: app.getVersion() }
  }
}

/**
 * Descarga la actualización (llamado desde IPC tras confirmar).
 */
export function downloadUpdate(): void {
  autoUpdater.downloadUpdate()
}

/**
 * Instala la actualización y reinicia.
 */
export function installUpdate(): void {
  autoUpdater.quitAndInstall(false, true)
}
