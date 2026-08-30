import { useEffect, useRef, useCallback } from 'react'

interface UseBarcodeScannerOptions {
  /** Callback when a barcode is scanned */
  onScan: (barcode: string) => void
  /** Timeout in ms to distinguish scanner vs manual typing (default: 50ms) */
  timeout?: number
  /** Enable/disable the scanner (default: true) */
  enabled?: boolean
  /** Ignore keydown events when focus is on these elements (default: input, textarea, select) */
  ignoreFocusOn?: string[]
}

/**
 * Hook para capturar escaneo de lector de codigos de barras USB HID.
 *
 * Los lectores USB HID actuan como teclado: envian caracteres rapido
 * y terminan con Enter. Este hook:
 * 1. Acumula caracteres en un buffer
 * 2. Usa un timeout para distinguir escaneo vs tipeo manual
 * 3. Al recibir Enter con buffer > 0, dispara onScan(barcode)
 * 4. Ignora eventos si el foco esta en un input/textarea/select
 */
export function useBarcodeScanner({
  onScan,
  timeout = 50,
  enabled = true,
  ignoreFocusOn = ['INPUT', 'TEXTAREA', 'SELECT'],
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef('')
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return

      // Ignorar si el foco esta en un campo de entrada
      const target = e.target as HTMLElement
      if (ignoreFocusOn.includes(target.tagName)) return

      // Limpiar timeout anterior
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      // Enter: procesar el buffer
      if (e.key === 'Enter') {
        e.preventDefault()
        const barcode = bufferRef.current.trim()
        bufferRef.current = ''
        if (barcode.length > 0) {
          onScan(barcode)
        }
        return
      }

      // Backspace: borrar ultimo caracter
      if (e.key === 'Backspace') {
        bufferRef.current = bufferRef.current.slice(0, -1)
        return
      }

      // Ignorar teclas de control/modificador
      if (e.key.length > 1 && !e.key.startsWith('F')) return

      // Agregar caracter al buffer
      bufferRef.current += e.key

      // Configurar timeout para limpiar buffer (distingue escaneo vs tipeo)
      timeoutRef.current = setTimeout(() => {
        bufferRef.current = ''
        timeoutRef.current = null
      }, timeout)
    },
    [enabled, onScan, timeout, ignoreFocusOn],
  )

  useEffect(() => {
    if (!enabled) return

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [enabled, handleKeyDown])
}
