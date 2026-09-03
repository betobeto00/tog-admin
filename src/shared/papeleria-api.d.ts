export interface PapeleriaAPI {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  auth: {
    login: (data: { usuario: string; contrasena: string }) => Promise<{ success: boolean; usuario?: any; error?: string }>
  }
  usuarios: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<any>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<any>
    changePassword: (data: { usuario_id: number; contrasena_actual: string; contrasena_nueva: string }) => Promise<any>
    getPermissions: (payload: { id: number; usuario_id?: number }) => Promise<{ success: boolean; permisos?: string[]; rol?: string; error?: string }>
    setPermissions: (payload: { id: number; permisos: string[]; usuario_id?: number }) => Promise<{ success: boolean; message?: string; error?: string }>
  }
  categorias: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<any>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<any>
  }
  unidades: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<any>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<any>
  }
  productos: {
    list: (filters?: unknown) => Promise<any[]>
    getById: (payload: { id: number; usuario_id?: number }) => Promise<any>
    create: (data: unknown) => Promise<any>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<any>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<any>
    lowStock: () => Promise<any[]>
    ajustar: (data: { producto_id: number; stock_nuevo: number; justificacion: string; usuario_id: number }) => Promise<any>
    ajustesHistorial: (data?: { producto_id?: number; limite?: number }) => Promise<any[]>
    buscarPorCodigo: (payload: { codigo: string; usuario_id?: number }) => Promise<any>
    exportCsv: () => Promise<any>
    importCsv: (filePath: string) => Promise<any>
  }
  proveedores: {
    list: () => Promise<any[]>
    create: (data: unknown) => Promise<any>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<any>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<any>
  }
  ventas: {
    list: (filters?: unknown) => Promise<any[]>
    getById: (payload: { id: number; usuario_id?: number }) => Promise<any>
    create: (data: unknown) => Promise<any>
    anular: (payload: { id: number; motivo: string; usuario_id?: number }) => Promise<any>
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
    getById: (payload: { id: number; usuario_id?: number }) => Promise<any>
    create: (data: unknown) => Promise<any>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<any>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<any>
  }
  reportes: {
    ventasPeriodo: (inicio: string, fin: string) => Promise<any>
    productosMasVendidos: (inicio: string, fin: string, limite?: number) => Promise<any>
    ultimasVentas: (limite?: number) => Promise<any[]>
    ventasPorCategoria: (inicio: string, fin: string) => Promise<any[]>
  }
  backup: {
    create: (ruta?: string) => Promise<any>
    restore: (ruta?: string) => Promise<any>
  }
  db: {
    reset: () => Promise<any>
  }
  terminal: {
    conectar: (payload: { puerto: string; baudRate?: number; usuario_id?: number }) => Promise<any>
    desconectar: () => Promise<any>
    estado: () => Promise<any>
    procesarPago: (payload: { monto: number; timeoutMs?: number; usuario_id?: number }) => Promise<any>
  }
  config: {
    get: () => Promise<any[]>
    set: (clave: string, valor: string) => Promise<any>
  }
  metodosPago: {
    list: (activoOnly?: boolean) => Promise<any[]>
    create: (data: unknown) => Promise<{ success: boolean; id?: number; error?: string }>
    update: (payload: { id: number; data: unknown; usuario_id?: number }) => Promise<{ success: boolean; error?: string }>
    delete: (payload: { id: number; usuario_id?: number }) => Promise<{ success: boolean; error?: string }>
    procesarTarjeta: (payload: { monto: number; usuario_id?: number }) => Promise<{ success: boolean; authCode?: string; refNum?: string; cardType?: string; maskedPan?: string; responseText?: string; error?: string }>
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
    checkForUpdates: () => Promise<{ available: boolean; version?: string; currentVersion?: string; error?: string }>
    downloadUpdate: () => Promise<void>
    installUpdate: () => Promise<void>
    onProgress: (callback: (data: { percent: number; transferred: number; total: number }) => void) => void
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
    read: (payload: { filename: string; usuario_id?: number }) => Promise<{ success: boolean; content?: string; error?: string }>
    delete: (payload: { filename: string; usuario_id?: number }) => Promise<{ success: boolean; error?: string }>
    openFolder: () => Promise<{ success: boolean; error?: string }>
    getPath: () => Promise<string>
  }
}

declare global {
  interface Window {
    api: PapeleriaAPI
  }
}