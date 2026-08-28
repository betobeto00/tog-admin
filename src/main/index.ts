import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import { initializeDatabase } from './db/database'
import { registerIpcHandlers } from './ipc-handlers'

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

// App lifecycle
app.whenReady().then(() => {
  // Inicializar base de datos
  initializeDatabase()

  // Registrar handlers IPC
  registerIpcHandlers()

  // Crear ventana
  createWindow()

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
