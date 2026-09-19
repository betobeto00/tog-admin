// @vitest-environment jsdom
// POS: después de cobrar, el comprobante se puede imprimir en A4 (el mismo
// documento que va a la ticketera, con el número configurado y el N° de control).

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { documentoDePrueba, type DocumentoVenta } from '@shared/print'
import POSPage from './POSPage'

const { apiMock, toasts } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  toasts: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../lib/api-client', () => ({
  callApi: (channel: string, data?: unknown) => apiMock(channel, data),
}))

vi.mock('@core/auth/store', () => ({
  useAuthStore: (selector: any) => selector({ usuario: { id: 1, nombre: 'admin', rol: 'admin' } }),
}))

vi.mock('../components/ui/Toast', () => ({ useToast: () => toasts }))

vi.mock('../hooks/useBarcodeScanner', () => ({ useBarcodeScanner: () => {} }))

vi.mock('../services/currency', () => ({
  formatMoney: (n: number | null | undefined) => `$${Number(n || 0).toFixed(2)}`,
  getRate: () => 1,
  getSymbol: () => '$',
  setCurrency: vi.fn(),
}))

const PRODUCTO = {
  id: 1, nombre: 'Harina 1kg', codigo_barras: null, sku: 'HAR1', precio_venta: 100,
  precio_compra: 50, stock: 10, stock_minimo: 1, unidad: 'unidad', tipo: 'producto',
  categoria_id: null, marca: null, imagen: null,
}

const DOCUMENTO: DocumentoVenta = {
  ...documentoDePrueba({ razon_social: 'Bodega OmniMargen', rif: 'J-40123456-7' }, { numero_control: 'A-00002325' }),
  titulo: 'FACTURA',
  numero: '2325',
  numero_control: 'A-00002325',
}

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.mockImplementation((channel: string) => {
    if (channel === 'productos:list') return Promise.resolve([PRODUCTO])
    if (channel === 'metodos-pago:list') {
      return Promise.resolve([{ id: 1, clave: 'efectivo', nombre: 'Efectivo', icono: 'DollarSign', requiere_terminal: 0, activo: 1 }])
    }
    if (channel === 'clientes:list') return Promise.resolve([])
    if (channel === 'caja:status') return Promise.resolve({ abierta: true })
    if (channel === 'ventas:create') return Promise.resolve({ success: true, id: 50, numero_venta: 2325 })
    if (channel === 'ventas:getById') return Promise.resolve({ id: 50, numero_venta: 2325, numero_control: 'A-00002325', total: 116, subtotal: 100, impuesto: 16, descuento: 0, metodo_pago: 'efectivo', tipo_comprobante: 'factura', detalles: [] })
    if (channel === 'print:documento-venta') return Promise.resolve({ success: true, documento: DOCUMENTO })
    return Promise.resolve(null)
  })
})

describe('POSPage — impresión A4 del comprobante', () => {
  it('cobra, muestra el ticket y abre la vista A4 con el número configurado', async () => {
    render(<POSPage />)

    // Buscar el producto y agregarlo al carrito
    const buscador = screen.getByPlaceholderText('pos.searchPlaceholder')
    fireEvent.change(buscador, { target: { value: 'Harina' } })
    fireEvent.click(await screen.findByText('Harina 1kg'))

    // Cobro (openCobro precarga el monto y el método efectivo)
    fireEvent.click(screen.getByText('pos.checkoutShortcut'))
    fireEvent.click(await screen.findByText('pos.confirmPayment'))

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('ventas:create', expect.objectContaining({ metodo_pago: 'efectivo' })))
    // El modal del ticket ya está abierto
    expect(await screen.findByText('pos.saleRegistered')).toBeInTheDocument()

    fireEvent.click(screen.getByTitle('print.printA4'))

    await waitFor(() => expect(apiMock).toHaveBeenCalledWith('print:documento-venta', { venta_id: 50 }))
    const hoja = await screen.findByTestId('a4-layout')
    expect(hoja.textContent).toContain('2325')
    expect(hoja.textContent).toContain('A-00002325')
  })
})
