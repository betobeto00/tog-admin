import { contextBridge, ipcRenderer } from 'electron'

// Expone una API segura al renderer via contextBridge
contextBridge.exposeInMainWorld('api', {
  // Generic invoke: permite enviar cualquier canal IPC
  invoke: (channel: string, ...args: unknown[]) => {
    return ipcRenderer.invoke(channel, ...args)
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
  },

  // Backup
  backup: {
    create: (ruta?: string) => ipcRenderer.invoke('backup:create', { ruta }),
    restore: (ruta: string) => ipcRenderer.invoke('backup:restore', { ruta }),
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

  // Licencia
  license: {
    status: () => ipcRenderer.invoke('license:status'),
    validate: () => ipcRenderer.invoke('license:validate'),
    import: (fileContent: string) => ipcRenderer.invoke('license:import', fileContent),
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
  }
  backup: {
    create: (ruta?: string) => Promise<any>
    restore: (ruta: string) => Promise<any>
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
  license: {
    status: () => Promise<any>
    validate: () => Promise<any>
    import: (fileContent: string) => Promise<any>
  }
}

declare global {
  interface Window {
    api: PapeleriaAPI
  }
}
