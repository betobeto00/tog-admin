import { contextBridge, ipcRenderer } from 'electron'

// Expone una API segura al renderer via contextBridge
contextBridge.exposeInMainWorld('api', {
  // Generic invoke: permite enviar cualquier canal IPC
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args)
  },

  // Updater
  updater: {
    checkForUpdates: () => ipcRenderer.invoke('update:check'),
    downloadUpdate: () => ipcRenderer.invoke('update:download'),
    installUpdate: () => ipcRenderer.invoke('update:install'),
    onProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => {
      ipcRenderer.on('update:progress', (_event, data) => callback(data))
    },
    getAppVersion: () => ipcRenderer.invoke('updater:version'),
  },

  // Atajos específicos para autenticación
  auth: {
    login: (data: { usuario: string; contrasena: string }) =>
      ipcRenderer.invoke('auth:login', data),
  },

  // Usuarios
  usuarios: {
    list: () => ipcRenderer.invoke('usuarios:list'),
    create: (data: unknown) => ipcRenderer.invoke('usuarios:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('usuarios:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('usuarios:delete', { id }),
    changePassword: (data: { usuario_id: number; contrasena_actual: string; contrasena_nueva: string }) =>
      ipcRenderer.invoke('usuarios:change-password', data),
    getPermissions: (id: number) => ipcRenderer.invoke('usuarios:getPermissions', { id }),
    setPermissions: (id: number, permisos: string[]) => ipcRenderer.invoke('usuarios:setPermissions', { id, permisos }),
  },

  // Categorías
  categorias: {
    list: () => ipcRenderer.invoke('categorias:list'),
    create: (data: unknown) => ipcRenderer.invoke('categorias:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('categorias:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('categorias:delete', { id }),
  },

  // Unidades de medida
  unidades: {
    list: () => ipcRenderer.invoke('unidades:list'),
    create: (data: unknown) => ipcRenderer.invoke('unidades:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('unidades:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('unidades:delete', { id }),
  },

  // Productos
  productos: {
    list: (filters?: unknown) => ipcRenderer.invoke('productos:list', filters),
    getById: (id: number) => ipcRenderer.invoke('productos:getById', { id }),
    create: (data: unknown) => ipcRenderer.invoke('productos:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('productos:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('productos:delete', { id }),
    lowStock: () => ipcRenderer.invoke('productos:low-stock'),
    ajustar: (data: { producto_id: number; stock_nuevo: number; justificacion: string; usuario_id: number }) =>
      ipcRenderer.invoke('productos:ajustar', data),
    ajustesHistorial: (data?: { producto_id?: number; limite?: number }) =>
      ipcRenderer.invoke('productos:ajustes-historial', data),
    buscarPorCodigo: (codigo: string) => ipcRenderer.invoke('productos:buscar-por-codigo', { codigo }),
    exportCsv: () => ipcRenderer.invoke('productos:export-csv'),
    importCsv: (filePath: string) => ipcRenderer.invoke('productos:import-csv', filePath),
  },

  // Proveedores
  proveedores: {
    list: () => ipcRenderer.invoke('proveedores:list'),
    create: (data: unknown) => ipcRenderer.invoke('proveedores:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('proveedores:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('proveedores:delete', { id }),
  },

  // Ventas
  ventas: {
    list: (filters?: unknown) => ipcRenderer.invoke('ventas:list', filters),
    getById: (id: number) => ipcRenderer.invoke('ventas:getById', { id }),
    create: (data: unknown) => ipcRenderer.invoke('ventas:create', data),
    anular: (id: number, motivo: string) => ipcRenderer.invoke('ventas:anular', { id, motivo }),
    resumenDia: (fecha?: string) => ipcRenderer.invoke('ventas:resumen-dia', { fecha }),
  },

  // Compras
  compras: {
    list: (filters?: unknown) => ipcRenderer.invoke('compras:list', filters),
    create: (data: unknown) => ipcRenderer.invoke('compras:create', data),
  },

  // Caja
  caja: {
    status: () => ipcRenderer.invoke('caja:status'),
    abrir: (data: unknown) => ipcRenderer.invoke('caja:abrir', data),
    cerrar: (data: unknown) => ipcRenderer.invoke('caja:cerrar', data),
    movimiento: (data: unknown) => ipcRenderer.invoke('caja:movimiento', data),
    historial: (filters?: unknown) => ipcRenderer.invoke('caja:historial', filters),
    reporteX: () => ipcRenderer.invoke('caja:reporte-x'),
    backupAuto: () => ipcRenderer.invoke('caja:backup-auto'),
  },

  // Quotes / Cotizaciones
  quotes: {
    list: (filters?: unknown) => ipcRenderer.invoke('quotes:list', filters),
    getById: (id: number) => ipcRenderer.invoke('quotes:getById', { id }),
    create: (data: unknown) => ipcRenderer.invoke('quotes:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('quotes:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('quotes:delete', { id }),
  },

  // Reportes
  reportes: {
    ventasPeriodo: (inicio: string, fin: string) =>
      ipcRenderer.invoke('reportes:ventas-periodo', { fecha_inicio: inicio, fecha_fin: fin }),
    productosMasVendidos: (inicio: string, fin: string, limite?: number) =>
      ipcRenderer.invoke('reportes:productos-mas-vendidos', { fecha_inicio: inicio, fecha_fin: fin, limite }),
    ultimasVentas: (limite?: number) =>
      ipcRenderer.invoke('reportes:ultimas-ventas', { limite }),
    ventasPorCategoria: (inicio: string, fin: string) =>
      ipcRenderer.invoke('reportes:ventas-por-categoria', { fecha_inicio: inicio, fecha_fin: fin }),
  },

  // Backup
  backup: {
    create: (ruta?: string) => ipcRenderer.invoke('backup:create', { ruta }),
    restore: (ruta: string) => ipcRenderer.invoke('backup:restore', { ruta }),
  },

  // DB Reset (dangerous)
  db: {
    reset: () => ipcRenderer.invoke('db:reset'),
  },

  // Terminal VP800
  terminal: {
    conectar: (puerto: string, baudRate?: number) => ipcRenderer.invoke('terminal:conectar', { puerto, baudRate }),
    desconectar: () => ipcRenderer.invoke('terminal:desconectar'),
    estado: () => ipcRenderer.invoke('terminal:estado'),
    procesarPago: (monto: number, timeoutMs?: number) => ipcRenderer.invoke('terminal:procesar-pago', { monto, timeoutMs }),
  },

  // Configuración
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (clave: string, valor: string) => ipcRenderer.invoke('config:set', { clave, valor }),
  },

  metodosPago: {
    list: (activoOnly?: boolean) => ipcRenderer.invoke('metodos-pago:list', { activoOnly }),
    create: (data: unknown) => ipcRenderer.invoke('metodos-pago:create', data),
    update: (id: number, data: unknown) => ipcRenderer.invoke('metodos-pago:update', { id, data }),
    delete: (id: number) => ipcRenderer.invoke('metodos-pago:delete', { id }),
    procesarTarjeta: (monto: number) => ipcRenderer.invoke('metodos-pago:procesar-tarjeta', { monto }),
  },

  // Licencia
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    validate: () => ipcRenderer.invoke('license:validate'),
    import: (fileContent: string) => ipcRenderer.invoke('license:import', fileContent),
    resetState: () => ipcRenderer.invoke('license:reset-state'),
  },

  // Idioma
  i18n: {
    getLang: () => ipcRenderer.invoke('i18n:get-lang'),
    setLang: (lang: 'es' | 'en') => ipcRenderer.invoke('i18n:set-lang', { lang }),
  },

  // Versión de la app
  app: {
    getVersion: () => ipcRenderer.invoke('app:version'),
  },

  // Crash Reports
  crashReport: {
    save: (data: {
      type: string
      message: string
      stack?: string
      componentStack?: string
      currentUrl?: string
      userAgent?: string
      loggedUser?: string
    }) => ipcRenderer.invoke('crash-report:save', data),
    list: () => ipcRenderer.invoke('crash-report:list'),
    read: (filename: string) => ipcRenderer.invoke('crash-report:read', { filename }),
    delete: (filename: string) => ipcRenderer.invoke('crash-report:delete', { filename }),
    openFolder: () => ipcRenderer.invoke('crash-report:open-folder'),
    getPath: () => ipcRenderer.invoke('crash-report:path'),
  },
})

// Declarar tipo global para window.api
export interface PapeleriaAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  auth: {
    login: (data: { usuario: string; contrasena: string }) => Promise<{ success: boolean; usuario?: any; error?: string }>
  }
  usuarios: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (id: number, data: unknown) => Promise<any>
    delete: (id: number) => Promise<any>
    changePassword: (data: { usuario_id: number; contrasena_actual: string; contrasena_nueva: string }) => Promise<any>
    getPermissions: (id: number) => Promise<{ success: boolean; permisos?: string[]; rol?: string; error?: string }>
    setPermissions: (id: number, permisos: string[]) => Promise<{ success: boolean; message?: string; error?: string }>
  }
  categorias: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (id: number, data: unknown) => Promise<any>
    delete: (id: number) => Promise<any>
  }
  unidades: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (id: number, data: unknown) => Promise<any>
    delete: (id: number) => Promise<any>
  }
  productos: {
    list: (filters?: unknown) => Promise<any[]>
    getById: (id: number) => Promise<any>
    create: (data: unknown) => Promise<any>
    update: (id: number, data: unknown) => Promise<any>
    delete: (id: number) => Promise<any>
    lowStock: () => Promise<any[]>
    ajustar: (data: { producto_id: number; stock_nuevo: number; justificacion: string; usuario_id: number }) => Promise<any>
    ajustesHistorial: (data?: { producto_id?: number; limite?: number }) => Promise<any[]>
    buscarPorCodigo: (codigo: string) => Promise<any>
    exportCsv: () => Promise<any>
    importCsv: (filePath: string) => Promise<any>
  }
  proveedores: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (id: number, data: unknown) => Promise<any>
    delete: (id: number) => Promise<any>
  }
  ventas: {
    list: (filters?: unknown) => Promise<any[]>
    getById: (id: number) => Promise<any>
    create: (data: unknown) => Promise<any>
    anular: (id: number, motivo: string) => Promise<any>
    resumenDia: (fecha?: string) => Promise<any>
  }
  compras: {
    list: (filters?: unknown) => Promise<any[]>
    create: (data: unknown) => Promise<any>
  }
  caja: {
    status: () => Promise<any>
    abrir: (data: unknown) => Promise<any>
    cerrar: (data: unknown) => Promise<any>
    movimiento: (data: unknown) => Promise<any>
    historial: (filters?: unknown) => Promise<any>
    reporteX: () => Promise<any>
    backupAuto: () => Promise<any>
  }
  quotes: {
    list: (filters?: unknown) => Promise<any[]>
    getById: (id: number) => Promise<any>
    create: (data: unknown) => Promise<any>
    update: (id: number, data: unknown) => Promise<any>
    delete: (id: number) => Promise<any>
  }
  reportes: {
    ventasPeriodo: (inicio: string, fin: string) => Promise<any>
    productosMasVendidos: (inicio: string, fin: string, limite?: number) => Promise<any>
    ultimasVentas: (limite?: number) => Promise<any[]>
    ventasPorCategoria: (inicio: string, fin: string) => Promise<any[]>
  }
  backup: {
    create: (ruta?: string) => Promise<any>
    restore: (ruta: string) => Promise<any>
  }
  db: {
    reset: () => Promise<any>
  }
  terminal: {
    conectar: (puerto: string, baudRate?: number) => Promise<any>
    desconectar: () => Promise<any>
    estado: () => Promise<any>
    procesarPago: (monto: number, timeoutMs?: number) => Promise<any>
  }
  config: {
    get: () => Promise<any[]>
    set: (clave: string, valor: string) => Promise<any>
  }
  metodosPago: {
    list: (activoOnly?: boolean) => Promise<any[]>
    create: (data: unknown) => Promise<{ success: boolean; id?: number; error?: string }>
    update: (id: number, data: unknown) => Promise<{ success: boolean; error?: string }>
    delete: (id: number) => Promise<{ success: boolean; error?: string }>
    procesarTarjeta: (monto: number) => Promise<{ success: boolean; authCode?: string; refNum?: string; cardType?: string; maskedPan?: string; responseText?: string; error?: string }>
  }
  license: {
    status: () => Promise<any>
    validate: () => Promise<any>
    import: (fileContent: string) => Promise<any>
    resetState: () => Promise<any>
  }
  i18n: {
    getLang: () => Promise<'es' | 'en'>
    setLang: (lang: 'es' | 'en') => Promise<{ success: boolean; lang: 'es' | 'en' }>
  }
  updater: {
    checkForUpdates: () => Promise<{ available: boolean; version?: string; currentVersion?: string; feedUrl?: string; error?: string }>
    downloadUpdate: () => Promise<void>
    installUpdate: () => Promise<void>
    onProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => void
    getAppVersion: () => Promise<string>
  }
  app: {
    getVersion: () => Promise<string>
  }
  crashReport: {
    save: (data: {
      type: string
      message: string
      stack?: string
      componentStack?: string
      currentUrl?: string
      userAgent?: string
      loggedUser?: string
    }) => Promise<{ success: boolean; path?: string; error?: string }>
    list: () => Promise<{ success: boolean; reports?: Array<{ id: string; filename: string; path: string; timestamp: string; size: number }>; error?: string }>
    read: (filename: string) => Promise<{ success: boolean; content?: string; error?: string }>
    delete: (filename: string) => Promise<{ success: boolean; error?: string }>
    openFolder: () => Promise<{ success: boolean; error?: string }>
    getPath: () => Promise<string>
  }
}

declare global {
  interface Window {
    api: PapeleriaAPI
  }
}
