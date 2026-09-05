import { callApi } from '../lib/api-client'

let _symbol = '$'
let _rate = 1
let _name = 'USD'

export async function loadCurrency(): Promise<void> {
  try {
    const cfg = await callApi<{ clave: string; valor: string }[]>('config:get')
    const get = (k: string) => cfg.find((c) => c.clave === k)?.valor
    _symbol = get('currency_symbol') || '$'
    _rate = parseFloat(get('tasa_cambio') || '0') || 0
    _name = get('currency_name') || 'USD'
  } catch {
    // Sin sesión o error: mantener defaults
  }
}

export function setCurrency(symbol: string, rate: number, name: string): void {
  _symbol = symbol || '$'
  _rate = rate > 0 ? rate : 0
  _name = name || 'USD'
}

export function getSymbol(): string {
  return _symbol
}

export function getRate(): number {
  return _rate
}

export function getName(): string {
  return _name
}

export function formatMoney(amount: number | null | undefined): string {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const rate = _rate > 0 ? _rate : 1
  const value = safe * rate
  return `${_symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}