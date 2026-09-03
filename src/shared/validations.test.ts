import { describe, it, expect } from 'vitest'
import {
  usuarioCreateSchema,
  usuarioUpdateSchema,
  categoriaCreateSchema,
  productoCreateSchema,
  proveedorCreateSchema,
  clienteCreateSchema,
  pedidoCreateSchema,
  ventaCreateSchema,
  compraCreateSchema,
  cajaAbrirSchema,
  cajaCerrarSchema,
  movimientoCajaSchema,
  quoteCreateSchema,
  loginSchema,
  changePasswordSchema,
} from './validations'

describe('usuarioCreateSchema', () => {
  it('accepts valid user data', () => {
    const result = usuarioCreateSchema.safeParse({
      usuario: 'admin',
      contrasena: '123456',
      nombre: 'Administrador',
      rol: 'admin',
    })
    expect(result.success).toBe(true)
  })

  it('rejects short username', () => {
    const result = usuarioCreateSchema.safeParse({
      usuario: 'ab',
      contrasena: '123456',
      nombre: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid characters in username', () => {
    const result = usuarioCreateSchema.safeParse({
      usuario: 'admin user',
      contrasena: '123456',
      nombre: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('rejects short password', () => {
    const result = usuarioCreateSchema.safeParse({
      usuario: 'admin',
      contrasena: '12345',
      nombre: 'Test',
    })
    expect(result.success).toBe(false)
  })

  it('defaults role to cajero', () => {
    const result = usuarioCreateSchema.safeParse({
      usuario: 'admin',
      contrasena: '123456',
      nombre: 'Test',
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.rol).toBe('cajero')
  })
})

describe('productoCreateSchema', () => {
  it('accepts valid product', () => {
    const result = productoCreateSchema.safeParse({
      nombre: 'Cuaderno',
      precio_venta: 5.0,
      stock: 100,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative price', () => {
    const result = productoCreateSchema.safeParse({
      nombre: 'Test',
      precio_venta: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative stock', () => {
    const result = productoCreateSchema.safeParse({
      nombre: 'Test',
      precio_venta: 5,
      stock: -1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = productoCreateSchema.safeParse({
      nombre: '',
      precio_venta: 5,
    })
    expect(result.success).toBe(false)
  })
})

describe('ventaCreateSchema', () => {
  it('accepts valid sale', () => {
    const result = ventaCreateSchema.safeParse({
      usuario_id: 1,
      subtotal: 10,
      impuesto: 0.6,
      total: 10.6,
      metodo_pago: 'efectivo',
      monto_pagado: 11,
      cambio: 0.4,
      detalles: [{
        producto_id: 1,
        cantidad: 2,
        precio_unitario: 5,
        descuento: 0,
        subtotal: 10,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects sale with no items', () => {
    const result = ventaCreateSchema.safeParse({
      usuario_id: 1,
      subtotal: 0,
      impuesto: 0,
      total: 0,
      metodo_pago: 'efectivo',
      monto_pagado: 0,
      cambio: 0,
      detalles: [],
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid payment method', () => {
    const result = ventaCreateSchema.safeParse({
      usuario_id: 1,
      subtotal: 10,
      impuesto: 0,
      total: 10,
      metodo_pago: 'bitcoin',
      monto_pagado: 10,
      cambio: 0,
      detalles: [{ producto_id: 1, cantidad: 1, precio_unitario: 10, descuento: 0, subtotal: 10 }],
    })
    expect(result.success).toBe(false)
  })
})

describe('cajaAbrirSchema', () => {
  it('accepts valid opening', () => {
    const result = cajaAbrirSchema.safeParse({ usuario_id: 1, fondo_inicial: 100 })
    expect(result.success).toBe(true)
  })

  it('accepts zero fondo', () => {
    const result = cajaAbrirSchema.safeParse({ usuario_id: 1, fondo_inicial: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects negative fondo', () => {
    const result = cajaAbrirSchema.safeParse({ usuario_id: 1, fondo_inicial: -10 })
    expect(result.success).toBe(false)
  })
})

describe('movimientoCajaSchema', () => {
  it('accepts valid movement', () => {
    const result = movimientoCajaSchema.safeParse({
      tipo: 'entrada',
      monto: 50,
      descripcion: 'Cambio de proveedor',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty description', () => {
    const result = movimientoCajaSchema.safeParse({
      tipo: 'salida',
      monto: 10,
      descripcion: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const result = movimientoCajaSchema.safeParse({
      tipo: 'retiro',
      monto: 0,
      descripcion: 'Test',
    })
    expect(result.success).toBe(false)
  })
})

describe('loginSchema', () => {
  it('accepts valid login', () => {
    const result = loginSchema.safeParse({ usuario: 'admin', contrasena: '123456' })
    expect(result.success).toBe(true)
  })

  it('rejects empty username', () => {
    const result = loginSchema.safeParse({ usuario: '', contrasena: '123456' })
    expect(result.success).toBe(false)
  })

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({ usuario: 'admin', contrasena: '' })
    expect(result.success).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  it('accepts valid password change', () => {
    const result = changePasswordSchema.safeParse({
      usuario_id: 1,
      contrasena_actual: 'old123',
      contrasena_nueva: 'new123456',
    })
    expect(result.success).toBe(true)
  })

  it('rejects short new password', () => {
    const result = changePasswordSchema.safeParse({
      usuario_id: 1,
      contrasena_actual: 'old123',
      contrasena_nueva: '12345',
    })
    expect(result.success).toBe(false)
  })
})

describe('proveedorCreateSchema', () => {
  it('accepts valid supplier', () => {
    const result = proveedorCreateSchema.safeParse({
      nombre: 'Proveedor ABC',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = proveedorCreateSchema.safeParse({ nombre: '' })
    expect(result.success).toBe(false)
  })

  it('accepts optional fields', () => {
    const result = proveedorCreateSchema.safeParse({
      nombre: 'Test',
      ein: '12-3456789',
      telefono: '+58 412-1234567',
      email: 'test@example.com',
      direccion: 'Calle Principal',
    })
    expect(result.success).toBe(true)
  })
})

describe('quoteCreateSchema', () => {
  it('accepts valid quote', () => {
    const result = quoteCreateSchema.safeParse({
      cliente_nombre: 'Cliente Test',
      subtotal: 100,
      impuesto: 6,
      total: 106,
      usuario_id: 1,
      detalles: [{
        producto_id: null,
        descripcion: 'Servicio de impresión',
        cantidad: 10,
        precio_unitario: 10,
        subtotal: 100,
      }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects quote with no items', () => {
    const result = quoteCreateSchema.safeParse({
      cliente_nombre: 'Test',
      subtotal: 0,
      impuesto: 0,
      total: 0,
      usuario_id: 1,
      detalles: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('clienteCreateSchema', () => {
  it('accepts valid client', () => {
    const result = clienteCreateSchema.safeParse({
      nombre: 'Distribuidora Los Andes',
      documento: 'J-12345678-9',
      telefono: '+58 412-1234567',
      email: 'ventas@andes.com',
      direccion: 'Av. Principal',
      limite_credito: 500,
      notas: 'Cliente mayorista',
    })
    expect(result.success).toBe(true)
  })

  it('accepts minimal client (only name)', () => {
    const result = clienteCreateSchema.safeParse({ nombre: 'Cliente de Prueba' })
    expect(result.success).toBe(true)
  })

  it('accepts empty strings for optional fields', () => {
    const result = clienteCreateSchema.safeParse({
      nombre: 'Test',
      documento: '',
      email: '',
      telefono: '',
      direccion: '',
      notas: '',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = clienteCreateSchema.safeParse({ nombre: '' })
    expect(result.success).toBe(false)
  })

  it('rejects negative credit limit', () => {
    const result = clienteCreateSchema.safeParse({ nombre: 'Test', limite_credito: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = clienteCreateSchema.safeParse({ nombre: 'Test', email: 'no-es-un-email' })
    expect(result.success).toBe(false)
  })
})

describe('pedidoCreateSchema', () => {
  it('accepts a valid order with items', () => {
    const result = pedidoCreateSchema.safeParse({
      cliente_id: 1,
      notas: 'Entrega en la mañana',
      items: [
        { producto_id: 10, cantidad: 2, precio: 5.5 },
        { producto_id: 11, cantidad: 1, precio: 100 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('rejects order without items', () => {
    const result = pedidoCreateSchema.safeParse({ cliente_id: 1, items: [] })
    expect(result.success).toBe(false)
  })

  it('rejects missing client', () => {
    const result = pedidoCreateSchema.safeParse({ items: [{ producto_id: 1, cantidad: 1, precio: 5 }] })
    expect(result.success).toBe(false)
  })

  it('rejects zero or negative quantity', () => {
    const zero = pedidoCreateSchema.safeParse({ cliente_id: 1, items: [{ producto_id: 1, cantidad: 0, precio: 5 }] })
    expect(zero.success).toBe(false)
    const neg = pedidoCreateSchema.safeParse({ cliente_id: 1, items: [{ producto_id: 1, cantidad: -1, precio: 5 }] })
    expect(neg.success).toBe(false)
  })
})
