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
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('usuarios:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('usuarios:delete', payload),
    changePassword: (data: { usuario_id: number; contrasena_actual: string; contrasena_nueva: string }) =>
      ipcRenderer.invoke('usuarios:change-password', data),
    getPermissions: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('usuarios:getPermissions', payload),
    setPermissions: (payload: { id: number; permisos: string[]; usuario_id?: number }) =>
      ipcRenderer.invoke('usuarios:setPermissions', payload),
  },

  // Categorías
  categorias: {
    list: () => ipcRenderer.invoke('categorias:list'),
    create: (data: unknown) => ipcRenderer.invoke('categorias:create', data),
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('categorias:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('categorias:delete', payload),
  },

  // Unidades de medida
  unidades: {
    list: () => ipcRenderer.invoke('unidades:list'),
    create: (data: unknown) => ipcRenderer.invoke('unidades:create', data),
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('unidades:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('unidades:delete', payload),
  },

  // Productos
  productos: {
    list: (filters?: unknown) => ipcRenderer.invoke('productos:list', filters),
    getById: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('productos:getById', payload),
    create: (data: unknown) => ipcRenderer.invoke('productos:create', data),
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('productos:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('productos:delete', payload),
    lowStock: () => ipcRenderer.invoke('productos:low-stock'),
    ajustar: (data: { producto_id: number; stock_nuevo: number; justificacion: string; usuario_id: number }) =>
      ipcRenderer.invoke('productos:ajustar', data),
    ajustesHistorial: (data?: { producto_id?: number; limite?: number }) =>
      ipcRenderer.invoke('productos:ajustes-historial', data),
    buscarPorCodigo: (payload: { codigo: string; usuario_id?: number }) =>
      ipcRenderer.invoke('productos:buscar-por-codigo', payload),
    exportCsv: () => ipcRenderer.invoke('productos:export-csv'),
    importCsv: (filePath: string) => ipcRenderer.invoke('productos:import-csv', filePath),
  },

  // Proveedores
  proveedores: {
    list: () => ipcRenderer.invoke('proveedores:list'),
    create: (data: unknown) => ipcRenderer.invoke('proveedores:create', data),
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('proveedores:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('proveedores:delete', payload),
  },

  // Ventas
  ventas: {
    list: (filters?: unknown) => ipcRenderer.invoke('ventas:list', filters),
    getById: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('ventas:getById', payload),
    create: (data: unknown) => ipcRenderer.invoke('ventas:create', data),
    anular: (payload: { id: number; motivo: string; usuario_id?: number }) =>
      ipcRenderer.invoke('ventas:anular', payload),
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
    getById: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('quotes:getById', payload),
    create: (data: unknown) => ipcRenderer.invoke('quotes:create', data),
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('quotes:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('quotes:delete', payload),
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
    restore: (ruta?: string) => ipcRenderer.invoke('backup:restore', { ruta }),
  },

  // DB Reset (dangerous)
  db: {
    reset: () => ipcRenderer.invoke('db:reset'),
  },

  // Terminal VP800
  terminal: {
    conectar: (payload: { puerto: string; baudRate?: number; usuario_id?: number }) =>
      ipcRenderer.invoke('terminal:conectar', payload),
    desconectar: () => ipcRenderer.invoke('terminal:desconectar'),
    estado: () => ipcRenderer.invoke('terminal:estado'),
    procesarPago: (payload: { monto: number; timeoutMs?: number; usuario_id?: number }) =>
      ipcRenderer.invoke('terminal:procesar-pago', payload),
  },

  // Configuración
  config: {
    get: () => ipcRenderer.invoke('config:get'),
    set: (clave: string, valor: string) => ipcRenderer.invoke('config:set', { clave, valor }),
  },

  metodosPago: {
    list: (activoOnly?: boolean) => ipcRenderer.invoke('metodos-pago:list', { activoOnly }),
    create: (data: unknown) => ipcRenderer.invoke('metodos-pago:create', data),
    update: (payload: { id: number; data: unknown; usuario_id?: number }) =>
      ipcRenderer.invoke('metodos-pago:update', payload),
    delete: (payload: { id: number; usuario_id?: number }) =>
      ipcRenderer.invoke('metodos-pago:delete', payload),
    procesarTarjeta: (payload: { monto: number; usuario_id?: number }) =>
      ipcRenderer.invoke('metodos-pago:procesar-tarjeta', payload),
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
    read: (payload: { filename: string; usuario_id?: number }) =>
      ipcRenderer.invoke('crash-report:read', payload),
    delete: (payload: { filename: string; usuario_id?: number }) =>
      ipcRenderer.invoke('crash-report:delete', payload),
    openFolder: () => ipcRenderer.invoke('crash-report:open-folder'),
    getPath: () => ipcRenderer.invoke('crash-report:path'),
  },
})

// Declarar tipo global para window.api
export type { PapeleriaAPI } from '@shared/papeleria-api'
