import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases de Tailwind de forma inteligente.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda con símbolo explícito.
 * Deprecated: para v2 usar formatMoney de services/currency (símbolo + tasa de la config).
 */
export function formatCurrency(amount: number | undefined | null, symbol: string = '$'): string {
  const safe = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  return `${symbol}${safe.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Fecha local `YYYY-MM-DD`.
 *
 * No usar `toISOString().slice(0, 10)`: convierte a UTC y de noche (p. ej.
 * 20:00–23:59 en UTC-4) devuelve el día siguiente, adelantando los reportes
 * y los filtros por un día.
 */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * Escapa texto para insertarlo en HTML. Se usa al generar documentos
 * imprimibles con `document.write`, donde un nombre de cliente o una nota
 * podrían inyectar script (XSS).
 */
export function escapeHtml(value: unknown): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(value ?? '').replace(/[&<>"']/g, (c) => map[c] || c)
}

/**
 * Formatea una fecha ISO a formato local.
 */
export function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/**
 * Formatea una fecha ISO con hora.
 */
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('es-VE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Genera el número de ticket formateado.
 */
export function formatTicketNumber(numero: number): string {
  return `#${String(numero).padStart(6, '0')}`
}
