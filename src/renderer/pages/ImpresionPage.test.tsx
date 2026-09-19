// @vitest-environment jsdom
// Numeración de comprobantes desde Impresión → Datos fiscales: el dueño fija
// la próxima factura y el próximo N° de control, y el cambio pide confirmación.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ImpresionPage from './ImpresionPage'

const { apiMock, toasts, auth } = vi.hoisted(() => ({
  apiMock: vi.fn(),
  toasts: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
  auth: { rol: 'admin' },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))

vi.mock('../lib/api-client', () => ({
  callApi: (channel: string, data?: unknown) => apiMock(channel, data),
}))

vi.mock('../hooks/usePermissions', () => ({
  usePermissions: () => ({ has: () => true, hasAny: () => true, hasAll: () => true, permissions: [], loading: false, reload: vi.fn() }),
}))

vi.mock('../components/ui/Toast', () => ({ useToast: () => toasts }))

vi.mock('@core/auth/store', () => ({
  useAuthStore: (selector: any) => selector({ usuario: { id: 1, rol: auth.rol } }),
}))

const CONFIG = {
  razon_social: 'Bodega OmniMargen',
  rif: 'J-40123456-7',
  direccion: 'Av. Principal 123',
  telefono: '0212-5555555',
  email: '',
  pie_ticket: 'Gracias por su compra',
  puerto_impresora: 'COM3',
  ancho_ticket: 80,
  abrir_cajon: false,
  copias: 1,
  serie: 'A',
  correlativo: 7,
  alicuota_iva: 16,
  proxima_factura: 2325,
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.rol = 'admin'
  apiMock.mockImplementation((channel: string) => {
    if (channel === 'print:config') return Promise.resolve({ ...CONFIG })
    if (channel === 'print:puertos') return Promise.resolve({ success: true, puertos: [] })
    if (channel === 'facturacion:set-numeracion') {
      return Promise.resolve({ success: true, numeracion: { proxima_factura: 2330, ultima_factura: 2324, serie: 'A', proximo_numero_control: 8, numero_control_formateado: 'A-00000008' } })
    }
    return Promise.resolve(null)
  })
})

const irAFiscal = async () => {
  fireEvent.click(await screen.findByText('print.tabFiscal'))
}

describe('ImpresionPage — numeración de comprobantes', () => {
  it('muestra la próxima factura y el próximo N° de control configurados', async () => {
    render(<ImpresionPage />)
    await irAFiscal()

    expect(screen.getByDisplayValue('2325')).toBeInTheDocument() // próxima factura
    expect(screen.getByDisplayValue('8')).toBeInTheDocument() // correlativo 7 → próximo 8
    // Vista previa formateada (también aparece en la vista previa del ticket)
    expect(screen.getAllByText('A-00000008').length).toBeGreaterThan(0)
  })

  it('la pestaña de impresora apunta a los datos fiscales (descubrimiento)', async () => {
    render(<ImpresionPage />)
    await screen.findByText('print.printerSection')

    fireEvent.click(screen.getByText('print.goToFiscal'))

    expect(await screen.findByDisplayValue('2325')).toBeInTheDocument()
  })

  it('pide confirmación antes de cambiar la numeración y la guarda', async () => {
    render(<ImpresionPage />)
    await irAFiscal()

    fireEvent.change(screen.getByDisplayValue('2325'), { target: { value: '2330' } })
    // El botón de la tarjeta y el del diálogo comparten etiqueta: se usa el de la tarjeta primero.
    fireEvent.click(screen.getAllByText('print.saveNumbering')[0])

    await waitFor(() => expect(screen.getByText('print.confirmNumberingTitle')).toBeInTheDocument())
    const dialogo = screen.getByText('print.confirmNumberingTitle').closest('div') as HTMLElement
    fireEvent.click(within(dialogo).getByText('print.saveNumbering'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('facturacion:set-numeracion', {
        serie: 'A',
        proximo_numero_control: 8,
        proxima_factura: 2330,
      }),
    )
    expect(toasts.success).toHaveBeenCalledWith('print.numberingSaved')
  })

  it('avisa (sin guardar) cuando no hay cambios', async () => {
    render(<ImpresionPage />)
    await irAFiscal()

    fireEvent.click(screen.getAllByText('print.saveNumbering')[0])

    await waitFor(() => expect(toasts.info).toHaveBeenCalledWith('print.numberingNoChanges'))
    expect(apiMock).not.toHaveBeenCalledWith('facturacion:set-numeracion', expect.anything())
  })

  it('para quien no es admin los campos y el guardado quedan deshabilitados', async () => {
    auth.rol = 'cajero'
    render(<ImpresionPage />)
    await irAFiscal()

    expect(screen.getByDisplayValue('2325')).toBeDisabled()
    expect(screen.getByDisplayValue('8')).toBeDisabled()
    expect(screen.getAllByText('print.saveNumbering')[0].closest('button')).toBeDisabled()
    expect(screen.getByText('print.numberingAdminOnly')).toBeInTheDocument()
  })
})
