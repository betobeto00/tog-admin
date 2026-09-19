// @vitest-environment jsdom
// Configuración → Negocio → Numeración de comprobantes: el cliente que viene
// de otro sistema fija su próxima factura (y el N° de control) y el cambio
// requiere confirmación.

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import ConfigPage from './ConfigPage'

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

vi.mock('../components/Tutorial', () => ({ resetTutorial: vi.fn() }))

const NUMERACION = {
  proxima_factura: 2325,
  ultima_factura: 2324,
  serie: 'A',
  proximo_numero_control: 8,
  numero_control_formateado: 'A-00000008',
}

beforeEach(() => {
  vi.clearAllMocks()
  auth.rol = 'admin'
  apiMock.mockImplementation((channel: string) => {
    if (channel === 'config:get') {
      return Promise.resolve([
        { clave: 'nombre_negocio', valor: 'Bodega OmniMargen' },
        { clave: 'currency_symbol', valor: '$' },
        { clave: 'currency_name', valor: 'USD' },
      ])
    }
    if (channel === 'usuarios:list') return Promise.resolve([])
    if (channel === 'license:status') return Promise.resolve({ valida: true })
    if (channel === 'terminal:estado') return Promise.resolve({ conectado: false })
    if (channel === 'red:status') return Promise.resolve({ modo: 'local' })
    if (channel === 'metodos-pago:list') return Promise.resolve([])
    if (channel === 'facturacion:numeracion') return Promise.resolve({ success: true, numeracion: NUMERACION })
    if (channel === 'facturacion:set-numeracion') {
      return Promise.resolve({ success: true, numeracion: { ...NUMERACION, proxima_factura: 2326 } })
    }
    return Promise.resolve(null)
  })
})

const esperarNumeracion = async () => {
  await waitFor(() => expect(apiMock).toHaveBeenCalledWith('facturacion:numeracion', undefined))
  expect(await screen.findByDisplayValue('2325')).toBeInTheDocument()
}

describe('ConfigPage — numeración de comprobantes', () => {
  it('muestra la última factura emitida y los próximos números', async () => {
    render(<ConfigPage />)
    await esperarNumeracion()

    expect(screen.getByDisplayValue('2325')).toBeInTheDocument()
    expect(screen.getByDisplayValue('8')).toBeInTheDocument()
    expect(screen.getByText('config.lastInvoice')).toBeInTheDocument()
  })

  it('pide confirmación al dueño y guarda los dos correlativos', async () => {
    render(<ConfigPage />)
    await esperarNumeracion()

    fireEvent.change(screen.getByDisplayValue('2325'), { target: { value: '2400' } })
    fireEvent.click(screen.getByText('config.saveNumbering'))

    await waitFor(() => expect(screen.getByText('config.confirmNumberingTitle')).toBeInTheDocument())
    const dialogo = screen.getByText('config.confirmNumberingTitle').closest('div') as HTMLElement
    fireEvent.click(within(dialogo).getByText('config.saveNumbering'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('facturacion:set-numeracion', {
        proxima_factura: 2400,
        proximo_numero_control: 8,
      }),
    )
    expect(toasts.success).toHaveBeenCalledWith('config.numberingSaved')
  })

  it('muestra el error del backend si el número no es válido', async () => {
    apiMock.mockImplementation((channel: string) => {
      if (channel === 'config:get') return Promise.resolve([])
      if (channel === 'facturacion:numeracion') return Promise.resolve({ success: true, numeracion: NUMERACION })
      if (channel === 'facturacion:set-numeracion') {
        return Promise.resolve({ success: false, error: 'La próxima factura debe ser mayor que la última emitida (#2324)' })
      }
      return Promise.resolve(null)
    })
    render(<ConfigPage />)
    await esperarNumeracion()

    fireEvent.change(screen.getByDisplayValue('2325'), { target: { value: '100' } })
    fireEvent.click(screen.getByText('config.saveNumbering'))
    await waitFor(() => expect(screen.getByText('config.confirmNumberingTitle')).toBeInTheDocument())
    const dialogo = screen.getByText('config.confirmNumberingTitle').closest('div') as HTMLElement
    fireEvent.click(within(dialogo).getByText('config.saveNumbering'))

    await waitFor(() =>
      expect(toasts.error).toHaveBeenCalledWith('La próxima factura debe ser mayor que la última emitida (#2324)'),
    )
  })

  it('sin rol admin los campos quedan bloqueados con el aviso', async () => {
    auth.rol = 'cajero'
    render(<ConfigPage />)
    await esperarNumeracion()

    expect(screen.getByDisplayValue('2325')).toBeDisabled()
    expect(screen.getByDisplayValue('8')).toBeDisabled()
    expect(screen.getByText('config.invoiceNumberingAdminOnly')).toBeInTheDocument()
    expect(screen.getByText('config.saveNumbering').closest('button')).toBeDisabled()
  })
})
