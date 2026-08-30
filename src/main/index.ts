import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { initializeDatabase } from './db/database'
import { registerIpcHandlers } from './ipc-handlers'
import { initI18n, t as i18nT } from './i18n'
import { saveCrashReport, captureLog } from './services/crash-reporter'
import { setupAutoUpdater, checkForUpdatesManual, downloadUpdate, installUpdate } from './services/updater'

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
      webSecurity: true, // Habilitar web security para producción
      allowRunningInsecureContent: false,
    },
    show: false,
  })

  // En desarrollo, cargar desde Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    const htmlPath = path.join(__dirname, '../../dist/index.html')
    console.log('[TOG Admin] Loading from:', htmlPath)
    mainWindow.loadFile(htmlPath)
    
    // Diagnóstico: verificar que el archivo HTML existe
    const fs = require('fs')
    if (!fs.existsSync(htmlPath)) {
      console.error('[TOG Admin] HTML file not found:', htmlPath)
    } else {
      console.log('[TOG Admin] HTML file exists, size:', fs.statSync(htmlPath).size)
    }
  }

  // Título de la app
  mainWindow.setTitle('TOG Admin')

  // Logging para diagnóstico de carga
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[TOG Admin] Renderer finished loading')
  })

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error('[TOG Admin] Renderer failed to load:', errorCode, errorDescription)
  })

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer Console] [${level}] ${message}`)
    captureLog(`[Renderer] [${level}] ${message}`)
  })

  // Capturar crashes del renderer/GPU
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('[CrashReporter] Renderer process gone:', details.reason, details.exitCode)
    captureLog(`RENDERER CRASH: ${details.reason} (exit code: ${details.exitCode})`)
    try {
      saveCrashReport({
        type: 'gpu-process-crash',
        message: `Renderer process crashed: ${details.reason} (exit code: ${details.exitCode})`,
      })
    } catch {}
  })

  mainWindow.webContents.on('unresponsive', () => {
    console.error('[CrashReporter] Renderer became unresponsive')
    captureLog('RENDERER UNRESPONSIVE')
    try {
      saveCrashReport({
        type: 'gpu-process-crash',
        message: 'Renderer process became unresponsive',
      })
    } catch {}
  })

  mainWindow.once('ready-to-show', () => {
    console.log('[TOG Admin] Window ready to show')
    mainWindow?.show()
  })

  mainWindow.on('closed', () => {
    console.log('[TOG Admin] Window closed')
    mainWindow = null
  })
}

function createTray() {
  // Crear tray icon (usar un icono placeholder)
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)
  tray.setToolTip('Papelería POS')

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
  console.error('[CrashReporter] Uncaught Exception:', error)
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
  console.error('[CrashReporter] Unhandled Rejection:', reason)
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
  // Inicializar i18n (lee .lang del NSIS installer o de userData)
  const lang = initI18n()
  console.log(`[TOG Admin] i18n: ${i18nT('logs.appStarting')} (${lang})`)

  // Inicializar base de datos
  initializeDatabase()
  console.log(`[TOG Admin] ${i18nT('logs.dbInitialized')}`)

  // Registrar handlers IPC
  registerIpcHandlers()
  console.log(`[TOG Admin] ${i18nT('logs.ipcRegistered')}`)

  // Crear ventana
  createWindow()
  console.log(`[TOG Admin] ${i18nT('logs.windowCreated')}`)

  // Iniciar auto-updater
  if (mainWindow) {
    setupAutoUpdater(mainWindow)
  }

  // Handlers IPC para updater
  ipcMain.handle('update:check', () => checkForUpdatesManual())
  ipcMain.handle('update:download', () => { downloadUpdate() })
  ipcMain.handle('update:install', () => { installUpdate() })

  // Crear tray (opcional, descomentar si se desea)
  // createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    } else {
      mainWindow?.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
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
