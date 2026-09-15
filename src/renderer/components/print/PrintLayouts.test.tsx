// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from '@testing-library/react'
import { documentoDePrueba, type DocumentoVenta } from '@shared/print'
import TicketLayout from './TicketLayout'
import A4Layout from './A4Layout'

const documento: DocumentoVenta = {
  ...documentoDePrueba(
    { razon_social: 'Bodega OmniMargen', rif: 'J-40123456-7', direccion: 'Av. Principal 123', telefono: '0212-5555555' },
    { alicuota_iva: 16, pie: 'Gracias por su compra' },
  ),
  titulo: 'FACTURA',
  numero: '42',
  numero_control: 'A-00000042',
  moneda: 'USD',
  cliente: { nombre: 'Cliente SA', documento: 'J-999', direccion: 'Calle 2' },
}

describe('TicketLayout', () => {
  it('renderiza el ticket con datos fiscales y totales', () => {
    render(<TicketLayout documento={documento} ancho={80} />)
    const ticket = screen.getByTestId('ticket-layout')
    expect(ticket.textContent).toContain('Bodega OmniMargen')
    expect(ticket.textContent).toContain('RIF: J-40123456-7')
    expect(ticket.textContent).toContain('A-00000042')
    expect(ticket.textContent).toContain('IVA (16%)')
    expect(ticket.textContent).toContain('TOTAL')
    expect(ticket.textContent).toContain('11.60 USD')
  })

  it('usa el ancho de papel pedido (58mm = menos columnas)', () => {
    const { unmount } = render(<TicketLayout documento={documento} ancho={58} />)
    expect(screen.getByTestId('ticket-layout').querySelector('pre')?.getAttribute('data-columnas')).toBe('32')
    unmount()
    render(<TicketLayout documento={documento} ancho={80} />)
    expect(screen.getByTestId('ticket-layout').querySelector('pre')?.getAttribute('data-columnas')).toBe('48')
  })
})

describe('A4Layout', () => {
  it('muestra encabezado, cliente, detalle y desglose fiscal', () => {
    render(<A4Layout documento={documento} />)
    const hoja = screen.getByTestId('a4-layout')
    expect(hoja.textContent).toContain('FACTURA')
    expect(hoja.textContent).toContain('J-40123456-7')
    expect(hoja.textContent).toContain('Cliente SA')
    expect(hoja.textContent).toContain('Base imponible')
    expect(hoja.textContent).toContain('IVA (16%)')
    expect(hoja.textContent).toContain('Firma del cliente')
  })

  it('lista los ítems en la tabla', () => {
    render(<A4Layout documento={documento} />)
    const filas = screen.getByTestId('a4-items').querySelectorAll('tbody tr')
    expect(filas.length).toBe(documento.items.length)
  })

  it('puede ocultar el bloque de firmas (tickets / comprobantes internos)', () => {
    render(<A4Layout documento={documento} mostrarFirma={false} />)
    expect(screen.queryByText('Firma del cliente')).toBeNull()
  })

  it('marca el área imprimible para el CSS de impresión', () => {
    render(<A4Layout documento={documento} />)
    expect(screen.getByTestId('a4-layout').className).toContain('print-area')
  })
})
