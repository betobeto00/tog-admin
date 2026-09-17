import { describe, it, expect } from 'vitest'
import { enmascararApiKey } from './claves-api'

describe('enmascararApiKey', () => {
  it('devuelve null cuando no hay clave', () => {
    expect(enmascararApiKey('')).toBeNull()
    expect(enmascararApiKey('   ')).toBeNull()
    expect(enmascararApiKey(null)).toBeNull()
    expect(enmascararApiKey(undefined)).toBeNull()
  })

  it('enmascara entera una clave muy corta (no revela sus últimos 4)', () => {
    expect(enmascararApiKey('ab')).toBe('••')
    expect(enmascararApiKey('abcd')).toBe('••••')
  })

  it('deja visibles sólo los últimos 4 caracteres', () => {
    expect(enmascararApiKey('k-1234')).toBe('••1234')
    expect(enmascararApiKey('odds-secreta-abcd1234')).toBe('••••••••1234')
  })

  it('no revela la longitud real de una clave larga', () => {
    const corte = enmascararApiKey('a'.repeat(40) + '9999')
    const larga = enmascararApiKey('a'.repeat(120) + '9999')
    expect(corte).toBe(larga)
    expect(corte).toBe('••••••••9999')
  })

  it('nunca devuelve la clave en claro', () => {
    const clave = 'sk-live-super-secreta-abcdef123456'
    const mascara = enmascararApiKey(clave)!
    expect(clave).not.toBe(mascara)
    expect(mascara.startsWith('•')).toBe(true)
    expect(clave.slice(0, -4)).not.toContain('•')
    // La máscara sólo contiene los últimos 4 caracteres reales
    expect(mascara.replace(/•/g, '')).toBe(clave.slice(-4))
  })

  it('ignora espacios alrededor', () => {
    expect(enmascararApiKey('  k-1234  ')).toBe('••1234')
    expect(enmascararApiKey('   ')).toBeNull()
  })
})
