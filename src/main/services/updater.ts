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

  // Verificar actualizaciones al iniciar (después de 5 segundos)
  setTimeout(() => {
    autoUpdater.checkForUpdates().catch((err) => {
      log.error('[Updater] Error al verificar actualizaciones:', err.message)
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
  hasToken?: boolean
  error?: string
}> {
  try {
    const currentVersion = app.getVersion()
    const result = await autoUpdater.checkForUpdates()
    if (result && result.updateInfo) {
      const latestVersion = result.updateInfo.version
      const available = latestVersion !== currentVersion
      return {
        available,
        version: latestVersion,
        currentVersion,
        hasToken: !!ghToken,
      }
    }
    return { available: false, currentVersion, hasToken: !!ghToken }
  } catch (err: any) {
    return {
      available: false,
      error: err.message,
      currentVersion: app.getVersion(),
      hasToken: !!ghToken,
    }
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
