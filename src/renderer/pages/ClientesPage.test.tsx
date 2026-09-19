// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ClientesPage from './ClientesPage'

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

vi.mock('../hooks/useModules', () => ({
  useActiveModules: () => ({ isActive: () => true, activeModules: ['comercializador'] }),
}))

vi.mock('../components/ui/Toast', () => ({ useToast: () => toasts }))

vi.mock('../services/currency', () => ({
  formatMoney: (n: number | null | undefined) => `$${Number(n || 0).toFixed(2)}`,
}))

const CLIENTES = [
  {
    id: 1, nombre: 'Ana Pérez', documento: 'V-123', telefono: '555-111', email: null,
    direccion: null, limite_credito: 500, notas: null, activo: 1, creado_en: '2026-09-01', deuda: 40,
  },
  {
    id: 2, nombre: 'Luis Gómez', documento: null, telefono: null, email: null,
    direccion: null, limite_credito: 0, notas: null, activo: 1, creado_en: '2026-09-02', deuda: 0,
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  apiMock.mockImplementation((channel: string) => {
    if (channel === 'clientes:list') return Promise.resolve(CLIENTES)
    if (channel === 'clientes:create' || channel === 'clientes:update') return Promise.resolve({ success: true, id: 3 })
    if (channel === 'clientes:delete') return Promise.resolve({ success: true, creditosPendientes: 0, saldoPendiente: 0 })
    return Promise.resolve(null)
  })
})

describe('ClientesPage', () => {
  it('lista los clientes y muestra la deuda pendiente', async () => {
    render(<ClientesPage />)
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument()
    expect(screen.getByText('Luis Gómez')).toBeInTheDocument()
    // Solo el cliente con deuda muestra el importe.
    expect(screen.getByText(/clientes\.debt/)).toBeInTheDocument()
    expect(screen.getByText('$40.00')).toBeInTheDocument()
  })

  it('muestra el error del backend al guardar y no cierra el modal', async () => {
    apiMock.mockImplementation((channel: string) => {
      if (channel === 'clientes:list') return Promise.resolve(CLIENTES)
      if (channel === 'clientes:create') {
        return Promise.reject(new Error('IPC Error (clientes:create): Ya existe un cliente activo con el documento V-123'))
      }
      return Promise.resolve(null)
    })
    render(<ClientesPage />)
    await screen.findByText('Ana Pérez')

    fireEvent.click(screen.getAllByText('clientes.new')[0]) // botón "Nuevo" (el título del modal usa la misma clave)
    // [0] es el buscador de la página; [1] el nombre del formulario.
    fireEvent.change(screen.getAllByRole('textbox')[1], { target: { value: 'Duplicado' } })
    fireEvent.click(screen.getByText('common.create'))

    await waitFor(() => expect(toasts.error).toHaveBeenCalledWith(expect.stringContaining('Ya existe un cliente activo')))
    // El modal sigue abierto para poder corregir el dato.
    expect(screen.getByText('common.create')).toBeInTheDocument()
  })

  it('envía null al borrar un dato opcional al editar', async () => {
    render(<ClientesPage />)
    await screen.findByText('Ana Pérez')

    // Botón de edición de la primera tarjeta.
    fireEvent.click(screen.getAllByRole('button').find((b) => !b.textContent?.trim())!)
    fireEvent.change(await screen.findByDisplayValue('555-111'), { target: { value: '' } })
    fireEvent.click(screen.getByText('common.save'))

    await waitFor(() =>
      expect(apiMock).toHaveBeenCalledWith('clientes:update', {
        id: 1,
        data: expect.objectContaining({ telefono: null, nombre: 'Ana Pérez' }),
      }),
    )
    expect(toasts.success).toHaveBeenCalledWith('clientes.saved')
  })

  it('avisa si el cliente eliminado todavía debe plata', async () => {
    apiMock.mockImplementation((channel: string) => {
      if (channel === 'clientes:list') return Promise.resolve(CLIENTES)
      if (channel === 'clientes:delete') return Promise.resolve({ success: true, creditosPendientes: 1, saldoPendiente: 40 })
      return Promise.resolve(null)
    })
    render(<ClientesPage />)
    await screen.findByText('Ana Pérez')

    // El segundo botón de la tarjeta es el de borrar.
    const botones = screen.getAllByRole('button').filter((b) => !b.textContent?.trim())
    fireEvent.click(botones[1])
    fireEvent.click(await screen.findByText('common.delete'))

    await waitFor(() =>
      expect(toasts.warning).toHaveBeenCalledWith(expect.stringContaining('clientes.debtPending')),
    )
    expect(apiMock).toHaveBeenCalledWith('clientes:delete', { id: 1 })
  })
})
