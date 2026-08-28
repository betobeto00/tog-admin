import { z } from 'zod'

// ============================================
// USUARIOS
// ============================================

export const usuarioCreateSchema = z.object({
  usuario: z.string().min(3, 'Mínimo 3 caracteres').max(50).regex(/^[a-zA-Z0-9_]+$/, 'Solo letras, números y guión bajo'),
  contrasena: z.string().min(6, 'Mínimo 6 caracteres'),
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  rol: z.enum(['admin', 'cajero']).default('cajero'),
})

export const usuarioUpdateSchema = z.object({
  nombre: z.string().min(1).max(100).optional(),
  rol: z.enum(['admin', 'cajero']).optional(),
  activo: z.number().int().min(0).max(1).optional(),
  contrasena: z.string().min(6).optional(),
})

// ============================================
// CATEGORÍAS
// ============================================

export const categoriaCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(100),
  descripcion: z.string().max(500).optional(),
})

// ============================================
// UNIDADES DE MEDIDA
// ============================================

export const unidadCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(50),
  abreviatura: z.string().max(10).optional(),
})

// ============================================
// PRODUCTOS
// ============================================

export const productoCreateSchema = z.object({
  codigo_barras: z.string().max(50).optional(),
  sku: z.string().max(50).optional(),
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  descripcion: z.string().max(1000).optional(),
  categoria_id: z.number().int().positive().optional(),
  precio_compra: z.number().min(0, 'Precio no puede ser negativo').default(0),
  precio_venta: z.number().min(0, 'Precio de venta requerido'),
  stock: z.number().int().min(0, 'Stock no puede ser negativo').default(0),
  stock_minimo: z.number().int().min(0).default(5),
  unidad: z.string().max(50).default('unidad'),
})

export const productoUpdateSchema = productoCreateSchema.partial()

// ============================================
// PROVEEDORES
// ============================================

export const proveedorCreateSchema = z.object({
  nombre: z.string().min(1, 'Nombre requerido').max(200),
  ein: z.string().max(20).optional(),
  telefono: z.string().max(20).optional(),
  email: z.string().email('Email inválido').max(200).optional().or(z.literal('')),
  direccion: z.string().max(500).optional(),
  notas: z.string().max(1000).optional(),
})

// ============================================
// VENTAS
// ============================================

export const ventaDetalleCreateSchema = z.object({
  producto_id: z.number().int().positive('ID de producto inválido'),
  cantidad: z.number().positive('La cantidad debe ser mayor a 0'),
  precio_unitario: z.number().min(0),
  descuento: z.number().min(0).default(0),
  subtotal: z.number(),
  notas: z.string().max(500).optional(),
})

export const ventaCreateSchema = z.object({
  usuario_id: z.number().int().positive(),
  subtotal: z.number().min(0),
  impuesto: z.number().min(0),
  descuento: z.number().min(0).default(0),
  total: z.number().positive('El total debe ser mayor a 0'),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'pago_movil', 'mixto']),
  monto_pagado: z.number().min(0),
  cambio: z.number().min(0).default(0),
  notas: z.string().max(500).optional(),
  detalles: z.array(ventaDetalleCreateSchema).min(1, 'Debe haber al menos un producto'),
})

// ============================================
// COMPRAS
// ============================================

export const compraDetalleCreateSchema = z.object({
  producto_id: z.number().int().positive(),
  cantidad: z.number().positive(),
  costo_unitario: z.number().min(0),
  subtotal: z.number(),
})

export const compraCreateSchema = z.object({
  proveedor_id: z.number().int().positive().optional(),
  usuario_id: z.number().int().positive(),
  subtotal: z.number().min(0),
  impuesto: z.number().min(0),
  total: z.number().positive(),
  metodo_pago: z.enum(['efectivo', 'transferencia', 'pago_movil']).default('efectivo'),
  notas: z.string().max(500).optional(),
  detalles: z.array(compraDetalleCreateSchema).min(1, 'Debe haber al menos un producto'),
})

// ============================================
// CAJA
// ============================================

export const cajaAbrirSchema = z.object({
  usuario_id: z.number().int().positive(),
  fondo_inicial: z.number().min(0, 'El fondo inicial no puede ser negativo'),
})

export const cajaCerrarSchema = z.object({
  caja_id: z.number().int().positive(),
  total_real: z.number().min(0),
  notas: z.string().max(500).optional(),
})

export const movimientoCajaSchema = z.object({
  tipo: z.enum(['entrada', 'salida', 'retiro']),
  monto: z.number().positive('El monto debe ser mayor a 0'),
  descripcion: z.string().min(1, 'Descripción requerida').max(200),
})

// ============================================
// QUOTES / COTIZACIONES
// ============================================

export const quoteDetalleSchema = z.object({
  producto_id: z.number().int().positive().nullable(),
  descripcion: z.string().min(1, 'Descripción requerida').max(500),
  cantidad: z.number().positive(),
  precio_unitario: z.number().min(0),
  descuento: z.number().min(0).max(100).default(0),
  subtotal: z.number(),
})

export const quoteCreateSchema = z.object({
  cliente_nombre: z.string().min(1, 'Nombre del cliente requerido').max(200),
  cliente_email: z.string().email('Email inválido').max(200).optional().or(z.literal('')),
  cliente_telefono: z.string().max(20).optional(),
  cliente_direccion: z.string().max(500).optional(),
  fecha_vencimiento: z.string().optional(),
  subtotal: z.number().min(0),
  impuesto: z.number().min(0),
  descuento: z.number().min(0).default(0),
  total: z.number().min(0),
  notas: z.string().max(1000).optional(),
  usuario_id: z.number().int().positive(),
  detalles: z.array(quoteDetalleSchema).min(1, 'Debe haber al menos un item'),
})

// ============================================
// CONFIGURACIÓN
// ============================================

export const configSetSchema = z.object({
  clave: z.string().min(1).max(100),
  valor: z.string().max(500),
})

// ============================================
// AUTH
// ============================================

export const loginSchema = z.object({
  usuario: z.string().min(1, 'Usuario requerido'),
  contrasena: z.string().min(1, 'Contraseña requerida'),
})

export const changePasswordSchema = z.object({
  usuario_id: z.number().int().positive(),
  contrasena_actual: z.string().min(1),
  contrasena_nueva: z.string().min(6, 'Mínimo 6 caracteres'),
})
