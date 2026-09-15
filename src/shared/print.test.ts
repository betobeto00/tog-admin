import { describe, it, expect } from 'vitest'
import {
  COLUMNAS_POR_ANCHO,
  centrar,
  columnas,
  construirLineasTicket,
  documentoDePrueba,
  envolver,
  formatearFecha,
  formatearMonto,
  type DocumentoVenta,
} from './print'

const documento: DocumentoVenta = {
  titulo: 'FACTURA',
  empresa: { razon_social: 'Bodega OmniMargen', rif: 'J-40123456-7', direccion: 'Av. Principal 123', telefono: '0212-5555555' },
  cliente: { nombre: 'Cliente de Prueba', documento: 'V-12345678' },
  numero: '42',
  numero_control: 'A-00000042',
  fecha: '2026-09-14 15:30:00',
  cajero: 'admin',
  items: [
    { descripcion: 'Harina de maíz 1kg', cantidad: 2, precio_unitario: 1.75, subtotal: 3.5 },
    { descripcion: 'Arroz blanco 1kg', cantidad: 1, precio_unitario: 1.2, descuento: 0.2, subtotal: 1 },
  ],
  subtotal: 4.5,
  descuento: 0.5,
  impuesto: 0.64,
  alicuota_iva: 16,
  total: 4.64,
  moneda: 'USD',
  metodo_pago: 'Efectivo',
  monto_pagado: 5,
  cambio: 0.36,
  pie: 'Gracias por su compra',
}

describe('formateo', () => {
  it('formatea montos con dos decimales y moneda', () => {
    expect(formatearMonto(4.5)).toBe('4.50')
    expect(formatearMonto('3.5', 'USD')).toBe('3.50 USD')
    expect(formatearMonto(null)).toBe('0.00')
  })

  it('formatea fechas ISO y de SQLite', () => {
    expect(formatearFecha('2026-09-14 15:30:00')).toBe('14/09/2026 15:30')
    expect(formatearFecha(new Date(2026, 8, 14, 15, 30))).toBe('14/09/2026 15:30')
    expect(formatearFecha(null)).toBe('')
  })
})

describe('alineación de texto', () => {
  it('centra en el ancho disponible', () => {
    expect(centrar('TOTAL', 10)).toBe('  TOTAL   ')
    // Si no entra, devuelve el texto tal cual (sin cortar datos)
    expect(centrar('DOCUMENTO MUY LARGO', 5)).toBe('DOCUMENTO MUY LARGO')
  })

  it('alinea izquierda y derecha en columnas', () => {
    expect(columnas('Subtotal', '4.50', 20)).toBe('Subtotal        4.50')
    // Justo al límite: se recorta la etiqueta para que el monto se lea entero
    expect(columnas('TOTAL', '10.00', 10)).toBe('TOTA 10.00')
    expect(columnas('Descripcion muy larga', '10.00', 16)).toBe('Descripcio 10.00')
  })

  it('envuelve respetando palabras y parte palabras larguísimas', () => {
    expect(envolver('uno dos tres cuatro', 9)).toEqual(['uno dos', 'tres', 'cuatro'])
    expect(envolver('', 10)).toEqual([])
    expect(envolver('X'.repeat(12), 5)).toEqual(['XXXXX', 'XXXXX', 'XX'])
  })
})

describe('construirLineasTicket', () => {
  const lineas = construirLineasTicket(documento, 80)
  const texto = lineas.map((l) => l.texto).join('\n')
  const cols = COLUMNAS_POR_ANCHO[80]

  it('incluye los datos del emisor, el N° de control y la fecha', () => {
    expect(texto).toContain('Bodega OmniMargen')
    expect(texto).toContain('RIF: J-40123456-7')
    expect(texto).toContain('Av. Principal 123')
    expect(texto).toContain('FACTURA')
    expect(texto).toContain('N° CONTROL: A-00000042')
    expect(texto).toContain('14/09/2026 15:30')
    expect(texto).toContain('Cajero: admin')
  })

  it('lista los ítems con cantidad e importe', () => {
    expect(texto).toContain('Harina de maíz 1kg')
    expect(texto).toContain('3.50 USD')
    expect(texto).toContain('Arroz blanco 1kg')
    expect(texto).toContain('-0.20 USD')
  })

  it('muestra el desglose fiscal y el TOTAL destacado', () => {
    expect(texto).toContain('Subtotal')
    expect(texto).toContain('IVA (16%)')
    expect(texto).toContain('4.64 USD')
    const total = lineas.find((l) => l.texto.includes('TOTAL'))
    expect(total?.negrita).toBe(true)
    expect(total?.doble).toBe(true)
  })

  it('muestra el pago, el cambio y el pie', () => {
    expect(texto).toContain('Pago: Efectivo')
    expect(texto).toContain('Recibido: 5.00 USD')
    expect(texto).toContain('Cambio: 0.36 USD')
    expect(texto).toContain('Gracias por su compra')
  })

  it('ninguna línea supera el ancho del papel', () => {
    for (const ancho of [58, 80] as const) {
      const max = COLUMNAS_POR_ANCHO[ancho]
      for (const linea of construirLineasTicket(documento, ancho)) {
        expect(linea.texto.length).toBeLessThanOrEqual(max)
      }
    }
    expect(lineas.every((l) => l.texto.length <= cols)).toBe(true)
  })

  it('el ticket de 58mm es más angosto que el de 80mm', () => {
    const chico = construirLineasTicket(documento, 58).map((l) => l.texto.length)
    expect(Math.max(...chico)).toBeLessThanOrEqual(COLUMNAS_POR_ANCHO[58])
  })

  it('la nota de entrega no imprime N° de control', () => {
    const nota = construirLineasTicket({ ...documento, numero_control: null }, 80)
      .map((l) => l.texto)
      .join('\n')
    expect(nota).not.toContain('N° CONTROL')
  })
})

describe('documentoDePrueba', () => {
  it('trae datos completos para validar la impresora', () => {
    const doc = documentoDePrueba({ razon_social: 'TOG Admin', rif: 'J-1' })
    expect(doc.titulo).toBe('TICKET DE PRUEBA')
    expect(doc.numero_control).toBe('A-00000001')
    expect(doc.items.length).toBeGreaterThan(0)
    expect(doc.total).toBeGreaterThan(0)
  })
})
