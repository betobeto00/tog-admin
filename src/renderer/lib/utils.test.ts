import { describe, it, expect } from 'vitest'
import { formatCurrency, formatDate, formatDateTime, formatTicketNumber, cn } from './utils'

describe('formatCurrency', () => {
  it('formats a normal number with 2 decimals', () => {
    expect(formatCurrency(10)).toBe('$10.00')
    expect(formatCurrency(10.5)).toBe('$10.50')
    expect(formatCurrency(10.99)).toBe('$10.99')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('formats large numbers with thousands separator', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89')
  })

  it('formats negative numbers', () => {
    expect(formatCurrency(-5.5)).toBe('$-5.50')
  })

  it('handles undefined gracefully', () => {
    expect(formatCurrency(undefined)).toBe('$0.00')
  })

  it('handles null gracefully', () => {
    expect(formatCurrency(null)).toBe('$0.00')
  })

  it('handles NaN gracefully', () => {
    expect(formatCurrency(NaN)).toBe('$0.00')
  })

  it('accepts custom symbol', () => {
    expect(formatCurrency(100, '€')).toBe('€100.00')
    expect(formatCurrency(100, 'Bs. ')).toBe('Bs. 100.00')
  })

  it('rounds to 2 decimal places', () => {
    expect(formatCurrency(10.999)).toBe('$11.00')
    expect(formatCurrency(10.991)).toBe('$10.99')
  })
})

describe('formatDate', () => {
  it('formats ISO date string', () => {
    const result = formatDate('2026-08-30T12:00:00.000Z')
    // Format depends on locale, but should contain the date parts
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns a non-empty string for valid date', () => {
    const result = formatDate('2025-01-15')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatDateTime', () => {
  it('formats ISO datetime string', () => {
    const result = formatDateTime('2026-08-30T17:30:00.000Z')
    expect(result).toBeTruthy()
    expect(typeof result).toBe('string')
  })

  it('returns a non-empty string for valid datetime', () => {
    const result = formatDateTime('2025-12-25T10:00:00.000Z')
    expect(result.length).toBeGreaterThan(0)
  })
})

describe('formatTicketNumber', () => {
  it('pads to 6 digits with # prefix', () => {
    expect(formatTicketNumber(1)).toBe('#000001')
    expect(formatTicketNumber(42)).toBe('#000042')
    expect(formatTicketNumber(999)).toBe('#000999')
  })

  it('handles large numbers', () => {
    expect(formatTicketNumber(123456)).toBe('#123456')
    expect(formatTicketNumber(1000000)).toBe('#1000000')
  })

  it('handles zero', () => {
    expect(formatTicketNumber(0)).toBe('#000000')
  })
})

describe('cn', () => {
  it('merges class names', () => {
    const result = cn('foo', 'bar')
    expect(result).toContain('foo')
    expect(result).toContain('bar')
  })

  it('handles conditional classes', () => {
    const result = cn('base', false && 'hidden', 'other')
    expect(result).toContain('base')
    expect(result).not.toContain('hidden')
    expect(result).toContain('other')
  })

  it('deduplicates tailwind classes', () => {
    // twMerge should keep only the last conflicting class
    const result = cn('p-4', 'p-8')
    expect(result).toBe('p-8')
  })

  it('handles empty input', () => {
    const result = cn()
    expect(result).toBe('')
  })

  it('handles single input', () => {
    const result = cn('foo')
    expect(result).toBe('foo')
  })
})
