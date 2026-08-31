import { autoUpdater, UpdateInfo } from 'electron-updater'
import { app, BrowserWindow, dialog, shell } from 'electron'
import log from 'electron-log'
import * as path from 'path'
import * as fs from 'fs'

// Configurar logging
autoUpdater.logger = log

// Deshabilitar auto-download — solo notificaremos al usuario
autoUpdater.autoDownload = false
autoUpdater.autoInstallOnAppQuit = false

let mainWindow: BrowserWindow | null = null

// ----------------------------------------------------------------------------
// GitHub token para repos privados
// ----------------------------------------------------------------------------
// El repo es privado, así que electron-updater necesita un Personal Access Token
// (PAT) para consultar releases. El token se inyecta al binario en build-time
// vía electron-builder extraResources (archivo gh-token en resources/), y se
// lee en runtime desde process.resourcesPath.
//
// ⚠️ SEGURIDAD: Solo dar scope `Contents: Read` al token. NO `repo` completo.
// ----------------------------------------------------------------------------
function loadGitHubToken(): string | null {
  // 1) Archivo inyectado por electron-builder (extraResources).
    //    Nota: el archivo fuente puede tener cualquier nombre (ej: ".gh-token"),
    //    pero electron-builder lo copia como "gh-token" (definido en `to:`).
    //    En producción: process.resourcesPath/gh-token
    //    En desarrollo: ./build-resources/.gh-token (para testing)
    const candidates = [
      path.join(process.resourcesPath || '', 'gh-token'),
      path.join(process.cwd(), 'build-resources', '.gh-token'),
    ]
    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const token = fs.readFileSync(filePath, 'utf-8').trim()
          if (token) {
            log.info(`[Updater] GitHub token loaded from file (length: ${token.length})`)
            return token
          }
        }
      } catch (err) {
        log.warn(`[Updater] Failed to read token file ${filePath}: ${err}`)
      }
    }

  // 2) Variables de entorno (útil en CI/CD)
  const envToken = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
  if (envToken) {
    log.info(`[Updater] GitHub token loaded from process.env (length: ${envToken.length})`)
    return envToken
  }

  // 3) En desarrollo, intentar cargar desde .env
  if (!app.isPackaged) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const dotenv = require('dotenv')
      const envPath = path.join(process.cwd(), '.env')
      dotenv.config({ path: envPath })
      const token = process.env.GH_TOKEN || process.env.GITHUB_TOKEN
      if (token) {
        log.info(`[Updater] GitHub token loaded from .env (length: ${token.length})`)
        return token
      }
    } catch (err) {
      log.warn('[Updater] dotenv not available, skipping .env load')
    }
  }

  log.warn('[Updater] No GH_TOKEN found. Auto-update will only work on public repos.')
  return null
}

const ghToken = loadGitHubToken()
if (ghToken) {
  autoUpdater.addAuthHeader(`token ${ghToken}`)
}

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
