// @vitest-environment jsdom
// Vista A4 de una factura: es el formato en el que el número configurado y el
// N° de control salen en papel A4 (el térmico sale por ESC/POS).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { documentoDePrueba, type DocumentoVenta } from '@shared/print'
import A4PrintModal from './A4PrintModal'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

const documento: DocumentoVenta = {
  ...documentoDePrueba(
    { razon_social: 'Bodega OmniMargen', rif: 'J-40123456-7', direccion: 'Av. Principal 123' },
    { numero_control: 'A-00002325' },
  ),
  titulo: 'FACTURA',
  numero: '2325',
  numero_control: 'A-00002325',
}

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('A4PrintModal', () => {
  it('no renderiza nada si está cerrado o sin documento', () => {
    const { rerender } = render(<A4PrintModal open={false} documento={documento} onClose={() => {}} />)
    expect(screen.queryByTestId('a4-print-modal')).toBeNull()

    rerender(<A4PrintModal open documento={null} onClose={() => {}} />)
    expect(screen.queryByTestId('a4-print-modal')).toBeNull()
  })

  it('muestra el comprobante A4 con el número y el N° de control', () => {
    render(<A4PrintModal open documento={documento} onClose={() => {}} />)

    const hoja = screen.getByTestId('a4-layout')
    expect(hoja.className).toContain('print-area')
    expect(hoja.textContent).toContain('2325')
    expect(hoja.textContent).toContain('A-00002325')
  })

  it('imprime con window.print() (el CSS deja solo el área A4)', () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<A4PrintModal open documento={documento} onClose={() => {}} />)

    fireEvent.click(screen.getByText('print.printA4'))

    expect(print).toHaveBeenCalledTimes(1)
  })

  it('cierra desde el botón de cerrar', () => {
    const onClose = vi.fn()
    render(<A4PrintModal open documento={documento} onClose={onClose} />)

    fireEvent.click(screen.getByText('common.close'))

    expect(onClose).toHaveBeenCalled()
  })
})
