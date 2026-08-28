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
    },
    show: false,
  })

  // En desarrollo, cargar desde Vite dev server
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Título de la app
  mainWindow.setTitle('TOG Admin')

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.on('close', (e) => {
    // Prevenir cierre accidental
    e.preventDefault()
    mainWindow?.hide()
  })

  mainWindow.on('closed', () => {
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
