// @vitest-environment jsdom
// Ventas: la reimpresión del ticket y la vista A4 salen del mismo
// `DocumentoVenta`, así que el número configurado y el N° de control aparecen
// en los dos formatos.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { documentoDePrueba, type DocumentoVenta } from '@shared/print'
import VentasPage from './VentasPage'

const { apiMock } = vi.hoisted(() => ({ apiMock: vi.fn() }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../lib/api-client', () => ({
  callApi: (channel: string, data?: unknown) => apiMock(channel, data),
}))

vi.mock('../services/currency', () => ({
  formatMoney: (n: number | null | undefined) => `$${Number(n || 0).toFixed(2)}`,
}))

const VENTA = {
  id: 1, numero_venta: 2325, fecha: '2026-09-19 10:00:00', usuario_nombre: 'admin',
  subtotal: 100, impuesto: 16, descuento: 0, total: 116, metodo_pago: 'efectivo',
  monto_pagado: 116, cambio: 0, estado: 'completada', notas: null,
  cliente_nombre: 'Cliente SA', cliente_documento: 'J-999',
}

const DETALLE = {
  ...VENTA,
  numero_control: 'A-00002325',
  detalles: [{ id: 1, producto_id: 1, descripcion: 'Harina 1kg', producto_nombre: 'Harina 1kg', cantidad: 2, precio_unitario: 50, descuento: 0, subtotal: 100, notas: null }],
}

const DOCUMENTO: DocumentoVenta = {
  ...documentoDePrueba({ razon_social: 'Bodega OmniMargen', rif: 'J-40123456-7' }, { numero_control: 'A-00002325' }),
  titulo: 'FACTURA',
  numero: '2325',
  numero_control: 'A-00002325',
}

function mockVentana() {
  const html: string[] = []
  const win = { document: { write: (h: string) => html.push(h), close: vi.fn() }, focus: vi.fn(), print: vi.fn() }
  vi.spyOn(window, 'open').mockReturnValue(win as any)
  return { html, win }
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.mockImplementation((channel: string) => {
    if (channel === 'ventas:list') return Promise.resolve([VENTA])
    if (channel === 'ventas:getById') return Promise.resolve(DETALLE)
    if (channel === 'print:documento-venta') return Promise.resolve({ success: true, documento: DOCUMENTO })
    return Promise.resolve(null)
  })
})

describe('VentasPage — formatos de impresión', () => {
  it('abre la vista A4 del comprobante con el número y el N° de control', async () => {
    render(<VentasPage />)
    expect(await screen.findByText('#002325')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('print.printA4'))

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('print:documento-venta', { venta_id: 1 }))
    const hoja = await screen.findByTestId('a4-layout')
    expect(hoja.textContent).toContain('2325')
    expect(hoja.textContent).toContain('A-00002325')
  })

  it('la reimpresión del ticket incluye el N° de control', async () => {
    const { html } = mockVentana()
    render(<VentasPage />)
    expect(await screen.findByText('#002325')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('ventas.reprint'))

    await waitFor(() => expect(html).toHaveLength(1))
    expect(apiMock).toHaveBeenCalledWith('ventas:getById', { id: 1 })
    expect(html[0]).toContain('#002325')
    expect(html[0]).toContain('N° Control: A-00002325')
    expect(html[0]).toContain('Harina 1kg')
  })
})
