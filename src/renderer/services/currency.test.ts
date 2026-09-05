import { describe, it, expect, beforeEach, vi } from 'vitest'
import { loadCurrency, formatMoney, getRate, getSymbol, getName, setCurrency } from './currency'
import { callApi } from '../lib/api-client'

vi.mock('../lib/api-client', () => ({
  callApi: vi.fn(),
}))

const mockedCallApi = vi.mocked(callApi)

describe('currency service', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    setCurrency('$', 0, 'USD')
  })

  it('formatea con símbolo y tasa por defecto', async () => {
    mockedCallApi.mockResolvedValue([
      { clave: 'currency_symbol', valor: 'Bs' },
      { clave: 'tasa_cambio', valor: '800' },
      { clave: 'currency_name', valor: 'VES' },
    ])
    await loadCurrency()
    expect(formatMoney(10)).toBe('Bs8,000.00')
    expect(getRate()).toBe(800)
    expect(getSymbol()).toBe('Bs')
    expect(getName()).toBe('VES')
  })

  it('sin tasa (rate=0) usa 1:1', async () => {
    mockedCallApi.mockResolvedValue([
      { clave: 'currency_symbol', valor: '$' },
      { clave: 'tasa_cambio', valor: '0' },
    ])
    await loadCurrency()
    expect(formatMoney(10)).toBe('$10.00')
  })

  it('monto null/undefined devuelve 0', async () => {
    mockedCallApi.mockResolvedValue([
      { clave: 'currency_symbol', valor: '$' },
      { clave: 'tasa_cambio', valor: '0' },
    ])
    await loadCurrency()
    expect(formatMoney(null)).toBe('$0.00')
    expect(formatMoney(undefined)).toBe('$0.00')
  })

  it('mantuvo defaults si la carga falla (sin sesión)', async () => {
    mockedCallApi.mockRejectedValue(new Error('IPC Error'))
    await loadCurrency()
    expect(formatMoney(10)).toBe('$10.00')
    expect(getSymbol()).toBe('$')
    expect(getRate()).toBe(0)
    expect(getName()).toBe('USD')
  })

  it('setCurrency permite refresco en vivo', () => {
    setCurrency('€', 0.9, 'EUR')
    expect(formatMoney(100)).toBe('€90.00')
    expect(getName()).toBe('EUR')
  })
})