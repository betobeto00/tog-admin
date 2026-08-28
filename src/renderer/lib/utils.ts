import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Combina clases de Tailwind de forma inteligente.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea un número como moneda.
 */
export function formatCurrency(amount: number, symbol: string = '$'): string {
  return `${symbol}${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
