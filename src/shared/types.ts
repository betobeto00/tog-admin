// ============================================
// Tipos compartidos entre Main Process y Renderer
// ============================================

// --- Usuarios ---
export interface Usuario {
  id: number
  usuario: string
  nombre: string
  rol: 'admin' | 'cajero'
  activo: number
  debe_cambiar_contrasena: number
  creado_en: string
  actualizado_en: string
}

export interface UsuarioCreate {
  usuario: string
  contrasena: string
  nombre: string
  rol: 'admin' | 'cajero'
}

export interface UsuarioUpdate {
  nombre?: string
  rol?: 'admin' | 'cajero'
  activo?: number
}

// --- Categorías ---
export interface Categoria {
  id: number
  nombre: string
  descripcion: string | null
  activo: number
  creado_en: string
}

export interface CategoriaCreate {
  nombre: string
  descripcion?: string
}

// --- Productos ---
export interface Producto {
  id: number
  codigo_barras: string | null
  sku: string | null
  nombre: string
  descripcion: string | null
  categoria_id: number | null
  precio_compra: number
  precio_venta: number
  stock: number
  stock_minimo: number
  unidad: 'unidad' | 'paquete' | 'hoja' | 'servicio'
  imagen: string | null
  activo: number
  creado_en: string
  actualizado_en: string
  // Joined fields
  categoria_nombre?: string
}

export interface ProductoCreate {
  codigo_barras?: string
  sku?: string
  nombre: string
  descripcion?: string
  categoria_id?: number
  precio_compra: number
  precio_venta: number
  stock: number
  stock_minimo?: number
  unidad?: 'unidad' | 'paquete' | 'hoja' | 'servicio'
}

export interface ProductoUpdate {
  codigo_barras?: string
  sku?: string
  nombre?: string
  descripcion?: string
  categoria_id?: number
  precio_compra?: number
  precio_venta?: number
  stock?: number
  stock_minimo?: number
  unidad?: 'unidad' | 'paquete' | 'hoja' | 'servicio'
  activo?: number
}

// --- Proveedores ---
export interface Proveedor {
  id: number
  nombre: string
  ein: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  notas: string | null
  activo: number
  creado_en: string
}

export interface ProveedorCreate {
  nombre: string
  ein?: string
  telefono?: string
  email?: string
  direccion?: string
  notas?: string
}

// --- Ventas ---
export interface Venta {
  id: number
  numero_venta: number
  fecha: string
  usuario_id: number
  subtotal: number
  impuesto: number
  descuento: number
  total: number
  metodo_pago: 'efectivo' | 'transferencia' | 'pago_movil' | 'mixto'
  monto_pagado: number
  cambio: number
  estado: 'completada' | 'anulada'
  notas: string | null
  creado_en: string
  // Joined
  usuario_nombre?: string
  detalles?: VentaDetalle[]
}

export interface VentaDetalle {
  id: number
  venta_id: number
  producto_id: number
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  notas: string | null
  // Joined
  producto_nombre?: string
}

export interface VentaCreate {
  usuario_id: number
  subtotal: number
  impuesto: number
  descuento: number
  total: number
  metodo_pago: 'efectivo' | 'transferencia' | 'pago_movil' | 'mixto'
  monto_pagado: number
  cambio: number
  notas?: string
  detalles: VentaDetalleCreate[]
}

export interface VentaDetalleCreate {
  producto_id: number
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  notas?: string
}

// --- Compras ---
export interface Compra {
  id: number
  numero_compra: number
  fecha: string
  proveedor_id: number | null
  usuario_id: number
  subtotal: number
  impuesto: number
  total: number
  metodo_pago: string
  notas: string | null
  estado: string
  creado_en: string
  // Joined
  proveedor_nombre?: string
  detalles?: CompraDetalle[]
}

export interface CompraDetalle {
  id: number
  compra_id: number
  producto_id: number
  cantidad: number
  costo_unitario: number
  subtotal: number
  // Joined
  producto_nombre?: string
}

export interface CompraCreate {
  proveedor_id?: number
  usuario_id: number
  subtotal: number
  impuesto: number
  total: number
  metodo_pago: string
  notas?: string
  detalles: CompraDetalleCreate[]
}

export interface CompraDetalleCreate {
  producto_id: number
  cantidad: number
  costo_unitario: number
  subtotal: number
}

// --- Caja ---
export interface Caja {
  id: number
  fecha_apertura: string
  fecha_cierre: string | null
  fondo_inicial: number
  total_ventas: number
  total_entradas: number
  total_salidas: number
  total_esperado: number
  total_real: number
  diferencia: number
  usuario_id: number
  estado: 'abierta' | 'cerrada'
  notas: string | null
  cerrado_en: string | null
  // Joined
  usuario_nombre?: string
}

export interface CajaAbrir {
  usuario_id: number
  fondo_inicial: number
}

export interface CajaCerrar {
  caja_id: number
  total_real: number
  notas?: string
}

export interface MovimientoCaja {
  id: number
  caja_id: number
  tipo: 'venta' | 'entrada' | 'salida' | 'retiro'
  monto: number
  descripcion: string | null
  referencia_id: number | null
  fecha: string
}

export interface MovimientoCajaCreate {
  caja_id: number
  tipo: 'entrada' | 'salida' | 'retiro'
  monto: number
  descripcion: string
}

// --- Configuración ---
export interface Configuracion {
  clave: string
  valor: string
  descripcion: string | null
  actualizado_en: string
}

// --- Métodos de Pago ---
export interface MetodoPago {
  id: number
  clave: string
  nombre: string
  icono: string
  requiere_terminal: number
  activo: number
  orden: number
  creado_en: string
  actualizado_en: string
}

export interface MetodoPagoCreate {
  clave: string
  nombre: string
  icono?: string
  requiere_terminal?: number
  activo?: number
  orden?: number
}

export interface MetodoPagoUpdate {
  nombre?: string
  icono?: string
  requiere_terminal?: number
  activo?: number
  orden?: number
}

// --- IPC Channels ---
export interface IpcChannels {
  // Auth
  'auth:login': { usuario: string; contrasena: string }
  'auth:login-response': { success: boolean; usuario?: Usuario; error?: string }

  // Usuarios
  'usuarios:list': void
  'usuarios:create': UsuarioCreate
  'usuarios:update': { id: number; data: UsuarioUpdate }
  'usuarios:delete': { id: number }

  // Categorías
  'categorias:list': void
  'categorias:create': CategoriaCreate
  'categorias:update': { id: number; data: Partial<CategoriaCreate> }
  'categorias:delete': { id: number }

  // Productos
  'productos:list': { search?: string; categoria_id?: number }
  'productos:getById': { id: number }
  'productos:create': ProductoCreate
  'productos:update': { id: number; data: ProductoUpdate }
  'productos:delete': { id: number }
  'productos:low-stock': void

  // Proveedores
  'proveedores:list': void
  'proveedores:create': ProveedorCreate
  'proveedores:update': { id: number; data: Partial<ProveedorCreate> }
  'proveedores:delete': { id: number }

  // Ventas
  'ventas:list': { fecha_inicio?: string; fecha_fin?: string }
  'ventas:getById': { id: number }
  'ventas:create': VentaCreate
  'ventas:anular': { id: number; motivo: string }
  'ventas:resumen-dia': { fecha?: string }

  // Compras
  'compras:list': { fecha_inicio?: string; fecha_fin?: string }
  'compras:create': CompraCreate

  // Caja
  'caja:status': void
  'caja:abrir': CajaAbrir
  'caja:cerrar': CajaCerrar
  'caja:movimiento': MovimientoCajaCreate
  'caja:historial': { fecha_inicio?: string; fecha_fin?: string }

  // Reportes
  'reportes:ventas-periodo': { fecha_inicio: string; fecha_fin: string }
  'reportes:productos-mas-vendidos': { fecha_inicio: string; fecha_fin: string; limite?: number }

  // Backup
  'backup:create': { ruta?: string }
  'backup:restore': { ruta: string }

  // Config
  'config:get': void
  'config:set': { clave: string; valor: string }

  // Métodos de pago
  'metodos-pago:list': { activoOnly?: boolean }
  'metodos-pago:create': MetodoPagoCreate
  'metodos-pago:update': { id: number; data: MetodoPagoUpdate }
  'metodos-pago:delete': { id: number }
  'metodos-pago:procesar-tarjeta': { monto: number }
}
