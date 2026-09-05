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
  subcategoria_id: number | null
  marca: string | null
  tipo: 'producto' | 'servicio'
  precio_compra: number
  precio_venta: number
  stock: number
  stock_minimo: number
  unidad: string
  imagen: string | null
  activo: number
  creado_en: string
  actualizado_en: string
  // Joined fields
  categoria_nombre?: string
  subcategoria_nombre?: string
}

export interface ProductoCreate {
  codigo_barras?: string
  sku?: string
  nombre: string
  descripcion?: string
  categoria_id?: number
  subcategoria_id?: number
  marca?: string
  tipo?: 'producto' | 'servicio'
  precio_compra: number
  precio_venta: number
  stock: number
  stock_minimo?: number
  unidad?: string
  imagen?: string
}

export interface ProductoUpdate {
  codigo_barras?: string
  sku?: string
  nombre?: string
  descripcion?: string
  categoria_id?: number
  subcategoria_id?: number
  marca?: string
  tipo?: 'producto' | 'servicio'
  precio_compra?: number
  precio_venta?: number
  stock?: number
  stock_minimo?: number
  unidad?: string
  imagen?: string
  activo?: number
}

// --- Subcategorías ---
export interface Subcategoria {
  id: number
  nombre: string
  categoria_id: number
  activo: number
  creado_en: string
  // Joined
  categoria_nombre?: string
}

export interface SubcategoriaCreate {
  nombre: string
  categoria_id: number
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
  metodo_pago: 'efectivo' | 'transferencia' | 'pago_movil' | 'mixto' | 'fiado'
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
  producto_id: number | null
  descripcion: string | null
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
  metodo_pago: 'efectivo' | 'transferencia' | 'pago_movil' | 'mixto' | 'fiado'
  monto_pagado: number
  cambio: number
  notas?: string
  cliente_id?: number | null
  deudor_nombre?: string
  deudor_telefono?: string
  deudor_documento?: string
  tipo_comprobante?: 'factura' | 'nota_entrega'
  detalles: VentaDetalleCreate[]
}

export interface VentaDetalleCreate {
  producto_id?: number | null
  descripcion?: string
  cantidad: number
  precio_unitario: number
  descuento: number
  subtotal: number
  notas?: string
}

// --- Créditos / Fiado ---
export interface Credito {
  id: number
  venta_id: number
  cliente_id: number | null
  deudor_nombre: string
  deudor_telefono: string | null
  deudor_documento: string | null
  monto_total: number
  saldo: number
  fecha: string
  estado: 'pendiente' | 'pagado' | 'anulado'
  usuario_id: number | null
  notas: string | null
  creado_en: string
  // Joined
  cliente_nombre?: string
  numero_venta?: number
  abonos?: CreditoAbono[]
}

export interface CreditoAbono {
  id: number
  credito_id: number
  monto: number
  fecha: string
  usuario_id: number | null
  notas: string | null
  // Joined
  usuario_nombre?: string
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

  // Subcategorías
  'subcategorias:list': { categoria_id?: number }
  'subcategorias:create': SubcategoriaCreate
  'subcategorias:update': { id: number; data: Partial<SubcategoriaCreate> }
  'subcategorias:delete': { id: number }

  // Productos
  'productos:list': { search?: string; categoria_id?: number; subcategoria_id?: number }
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
  'ventas:list': { fecha_inicio?: string; fecha_fin?: string; limite?: number; search?: string }
  'ventas:getById': { id: number }
  'ventas:create': VentaCreate
  'ventas:anular': { id: number; motivo: string }
  'ventas:resumen-dia': { fecha?: string }

  // Créditos / Fiado
  'creditos:list': { estado?: string; search?: string }
  'creditos:getById': { id: number }
  'creditos:abono': { credito_id: number; monto: number; notas?: string }

  // Borradores de venta (POS)
  'borradores:list': { usuario_id: number }
  'borradores:load': { id: number; usuario_id: number }
  'borradores:save': { id?: number; usuario_id: number; items: any[]; descuento_global: number; cliente_id: number | null; notas: string | null }
  'borradores:delete': { id: number; usuario_id: number }

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

  // Feedback
  'feedback:send': { mensaje: string; contacto?: string }

  // Combos / productos compuestos
  'combos:get': { producto_id: number }
  'combos:guardar': { producto_id: number; componentes: { componente_id: number; cantidad: number }[] }

  // Remitos (Distribuidor)
  'remitos:list': void
  'remitos:create': { pedido_id: number; observaciones?: string }
  'remitos:update': { id: number; estado: string; observaciones?: string | null }
  'remitos:getById': { id: number }

  // Listas de precio (Distribuidor)
  'listas-precio:list': void
  'listas-precio:create': { nombre: string; factor: number }
  'listas-precio:update': { id: number; data: { nombre?: string; factor?: number; activo?: number } }
  'listas-precio:delete': { id: number }

  // Reportes visuales guardados
  'reportes-visuales:list': void
  'reportes-visuales:save': { nombre: string; fuente: string; campos: string[]; fecha_inicio?: string; fecha_fin?: string }
  'reportes-visuales:delete': { id: number }

  // Restaurant
  'mesas:list': void
  'mesas:create': { nombre: string; capacidad?: number }
  'mesas:update': { id: number; data: { nombre?: string; capacidad?: number; estado?: string; activo?: number } }
  'mesas:delete': { id: number }
  'comandas:list': { activas?: boolean }
  'comandas:open': { mesa_id: number; notas?: string }
  'comandas:add-item': { comanda_id: number; producto_id?: number | null; descripcion?: string; cantidad: number; precio_unitario?: number; notas?: string }
  'comandas:update-item': { comanda_id: number; detalle_id: number; data: { cantidad?: number; notas?: string; estado?: string } }
  'comandas:remove-item': { comanda_id: number; detalle_id: number }
  'comandas:send-kitchen': { comanda_id: number }
  'comandas:mark-item': { comanda_id: number; detalle_id: number; estado: string }
  'comandas:merge': { comanda_id: number; mesa_destino_id: number }
  'comandas:move': { comanda_id: number; mesa_destino_id: number }
  'comandas:checkout': { comanda_id: number; metodo_pago: string; monto_pagado?: number; notas?: string; deudor_nombre?: string }

  // Métodos de pago
  'metodos-pago:list': { activoOnly?: boolean }
  'metodos-pago:create': MetodoPagoCreate
  'metodos-pago:update': { id: number; data: MetodoPagoUpdate }
  'metodos-pago:delete': { id: number }
  'metodos-pago:procesar-tarjeta': { monto: number }
}
