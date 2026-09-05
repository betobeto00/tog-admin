import { app, BrowserWindow, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { loadEnv } from './core/env'
import { initializeDatabase } from './db/database'
import { registerIpcHandlers } from './ipc-handlers'
import { initI18n, t as i18nT } from './i18n'
import { saveCrashReport, captureLog } from './services/crash-reporter'
import { setupAutoUpdater } from './services/updater'
import { logger } from './services/logger'
import { startRedServerIfBase } from './services/red-server'
import { isHija, getHijaConfig } from './services/red-config'
import { logoutEnBase } from './services/red-client'

loadEnv()

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null

const isDev = !app.isPackaged

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 700,
    title: 'TOG Admin',
    icon: path.join(__dirname, '../../resources/icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: !isDev,
      allowRunningInsecureContent: isDev,
    },
    show: false,
  })

// En desarrollo, cargar desde Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    const htmlPath = path.join(__dirname, '../../dist/index.html')
    logger.info('app', 'Loading from:', htmlPath)
    mainWindow.loadFile(htmlPath)
    
    // Diagnóstico: verificar que el archivo HTML existe
    const fs = require('fs')
    if (!fs.existsSync(htmlPath)) {
      logger.error('app', 'HTML file not found:', htmlPath)
    } else {
      logger.info('app', 'HTML file exists, size:', fs.statSync(htmlPath).size)
    }
  }

  // Título de la app
  mainWindow.setTitle('TOG Admin')

  // Logging para diagnóstico de carga
  mainWindow.webContents.on('did-finish-load', () => {
    logger.info('app', 'Renderer finished loading')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    logger.error('app', 'Renderer failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    logger.debug('renderer', `[${level}] ${message}`)
    captureLog(`[Renderer] [${level}] ${message}`)
  })

  // Capturar crashes del renderer/GPU
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    logger.error('crash', 'Renderer process gone:', details.reason, details.exitCode)
    captureLog(`RENDERER CRASH: ${details.reason} (exit code: ${details.exitCode})`)
    try {
      saveCrashReport({
        type: 'gpu-process-crash',
        message: `Renderer process crashed: ${details.reason} (exit code: ${details.exitCode})`,
      })
    } catch {}
  })

  mainWindow.webContents.on('unresponsive', () => {
    logger.error('crash', 'Renderer became unresponsive')
    captureLog('RENDERER UNRESPONSIVE')
    try {
      saveCrashReport({
        type: 'gpu-process-crash',
        message: 'Renderer process became unresponsive',
      })
    } catch {}
  })

  mainWindow.once('ready-to-show', () => {
    logger.info('app', 'Window ready to show')
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    logger.info('app', 'Window closed')
    mainWindow = null
  })
}

function createTray() {
  // Crear tray icon (usar un icono placeholder)
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('TOG Admin POS')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Abrir',
      click: () => {
        mainWindow?.show()
      },
    },
    {
      label: 'Salir',
      click: () => {
        mainWindow?.destroy()
        app.quit()
      },
    },
  ])

  tray.setContextMenu(contextMenu)

  tray.on('double-click', () => {
    mainWindow?.show()
  })
}

// ============================================
// GLOBAL ERROR HANDLERS - Crash Reports
// ============================================

// Capturar excepciones no atrapadas
process.on('uncaughtException', (error) => {
  logger.error('crash', 'Uncaught Exception:', error)
  captureLog(`UNCAUGHT EXCEPTION: ${error.message}`)
  try {
    saveCrashReport({
      type: 'uncaught-exception',
      message: error.message,
      stack: error.stack,
    })
  } catch {}
  // No cerrar la app inmediatamente, dar tiempo para guardar el reporte
})

// Capturar promesas rechazadas sin handler
process.on('unhandledRejection', (reason) => {
  const message = reason instanceof Error ? reason.message : String(reason)
  const stack = reason instanceof Error ? reason.stack : undefined
  logger.error('crash', 'Unhandled Rejection:', reason)
  captureLog(`UNHANDLED REJECTION: ${message}`)
  try {
    saveCrashReport({
      type: 'unhandled-rejection',
      message,
      stack,
    })
  } catch {}
})

// App lifecycle
app.whenReady().then(() => {
  logger.info('app', 'app ready')
  try {
    // Inicializar i18n (lee .lang del NSIS installer o de userData)
    const lang = initI18n()
    logger.info('app', `i18n: ${i18nT('logs.appStarting')} (${lang})`)

    // Inicializar base de datos
    initializeDatabase()
    logger.info('app', `${i18nT('logs.dbInitialized')}`)

    // Registrar handlers IPC
    registerIpcHandlers()
    logger.info('app', `${i18nT('logs.ipcRegistered')}`)

    // Modo PC Base: arrancar el servidor de red local para las PCs hijas
    startRedServerIfBase().then((ok) => {
      logger.info('red', ok ? 'Servidor red local iniciado' : 'Servidor red local no iniciado (modo hija/local)')
    })

    // Crear ventana
    createWindow()
    logger.info('app', `${i18nT('logs.windowCreated')}`)
  } catch (err) {
    logger.error('app', 'FATAL during init:', err)
    saveCrashReport({
      type: 'uncaught-exception',
      message: 'FATAL during init: ' + (err instanceof Error ? err.message : String(err)),
      stack: err instanceof Error ? err.stack : undefined,
    })
    app.quit()
  }

  // Iniciar auto-updater
  if (mainWindow) {
    setupAutoUpdater(mainWindow)
  }

  // Crear tray (opcional, descomentar si se desea)
  // createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
}).catch((err) => {
  logger.error('app', 'FATAL whenReady rejected:', err)
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Al cerrar una PC Hija, liberar sus sesiones en la Base (best-effort)
app.on('before-quit', () => {
  if (isHija() && getHijaConfig()) {
    logoutEnBase()
  }
})

// Prevenir múltiples instancias
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
    }
  })
}
