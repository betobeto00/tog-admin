import { describe, it, expect } from 'vitest'
import { desgloseFiscal, formatearNumeroControl, ivaDesdeTotalIncluido } from './fiscal'

describe('formatearNumeroControl', () => {
  it('devuelve el siguiente correlativo con padding y serie', () => {
    expect(formatearNumeroControl('A', 0)).toBe('A-00000001')
    expect(formatearNumeroControl('A', 41)).toBe('A-00000042')
    expect(formatearNumeroControl('b', 99999999)).toBe('B-100000000')
  })

  it('normaliza series raras sin romper el formato', () => {
    expect(formatearNumeroControl('', 0)).toBe('A-00000001')
    expect(formatearNumeroControl(null, 0)).toBe('A-00000001')
    expect(formatearNumeroControl('serie-larga', 0)).toBe('SERI-00000001')
  })

  it('nunca repite ni devuelve números negativos', () => {
    expect(formatearNumeroControl('A', -5)).toBe('A-00000001')
    expect(formatearNumeroControl('A', 1)).not.toBe(formatearNumeroControl('A', 2))
  })
})

describe('desgloseFiscal', () => {
  it('separa la base imponible del IVA exclusivo', () => {
    expect(desgloseFiscal({ subtotal: 10, descuento: 1, impuesto: 1.44, total: 10.44 })).toEqual({
      base_imponible: 9,
      iva: 1.44,
      total: 10.44,
    })
  })

  it('calcula el total si no viene', () => {
    expect(desgloseFiscal({ subtotal: 100, impuesto: 16 }).total).toBe(116)
  })

  it('redondea a dos decimales', () => {
    expect(desgloseFiscal({ subtotal: 33.333, impuesto: 5.333 })).toEqual({
      base_imponible: 33.33,
      iva: 5.33,
      total: 38.66,
    })
  })

  it('sin IVA la base es el total', () => {
    expect(desgloseFiscal({ subtotal: 7.5, impuesto: 0 })).toEqual({ base_imponible: 7.5, iva: 0, total: 7.5 })
  })
})

describe('ivaDesdeTotalIncluido', () => {
  it('descuenta el IVA de un total que ya lo incluye', () => {
    const r = ivaDesdeTotalIncluido(116, 16)
    expect(r.base_imponible).toBe(100)
    expect(r.iva).toBe(16)
    expect(r.total).toBe(116)
  })

  it('con alícuota 0 no toca el monto', () => {
    expect(ivaDesdeTotalIncluido(50, 0)).toEqual({ base_imponible: 50, iva: 0, total: 50 })
  })
})
