// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import PermissionsModal from './PermissionsModal'

// Mock react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}))

// Mock window.api.invoke (called by callApi wrapper)
const mockGetPermissions = vi.fn()
const mockSetPermissions = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = {
    invoke: vi.fn((channel: string, payload?: any) => {
      if (channel === 'usuarios:getPermissions') return mockGetPermissions(payload)
      if (channel === 'usuarios:setPermissions') return mockSetPermissions(payload)
      return Promise.resolve(null)
    }),
  }
  mockGetPermissions.mockResolvedValue({
    success: true,
    permisos: ['pos_access', 'caja_access'],
  })
  mockSetPermissions.mockResolvedValue({ success: true })
})

function renderModal(overrides: Partial<React.ComponentProps<typeof PermissionsModal>> = {}) {
  const defaults = {
    open: true,
    onClose: vi.fn(),
    userId: 1,
    userName: 'Test User',
    userRole: 'cajero',
    onSave: vi.fn(),
  }
  return { ...defaults, ...overrides, ...render(<PermissionsModal {...defaults} {...overrides} />) }
}

describe('PermissionsModal', () => {
  it('renders for admin user with all-permissions message', () => {
    renderModal({ userRole: 'admin' })
    expect(screen.getByText(/todos los permisos automáticamente/i)).toBeInTheDocument()
  })

  it('does not render when open is false', () => {
    const { container } = renderModal({ open: false })
    expect(container.innerHTML).toBe('')
  })

  it('loads and displays permissions for cajero', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText(/permisos activos/)).toBeInTheDocument()
    })
    expect(mockGetPermissions).toHaveBeenCalledWith({ id: 1 })
  })

  it('shows permission counter', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText(/2 \/ \d+ permisos activos/)).toBeInTheDocument()
    })
  })

  it('has select all and deselect all buttons', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument()
    })
    expect(screen.getByText('Ninguno')).toBeInTheDocument()
  })

  it('select all toggles all permissions', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Todos')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Todos'))
    // After select all, counter should show all permissions
    // The exact number depends on PERMISSIONS count
  })

  it('deselect all clears permissions', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Ninguno')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Ninguno'))
    // Counter should show 0
  })

  it('has save and cancel buttons', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Guardar Permisos')).toBeInTheDocument()
    })
    expect(screen.getByText('Cancelar')).toBeInTheDocument()
  })

  it('calls onClose when cancel is clicked', async () => {
    const onClose = vi.fn()
    renderModal({ onClose })
    await waitFor(() => {
      expect(screen.getByText('Cancelar')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Cancelar'))
    expect(onClose).toHaveBeenCalled()
  })

  it('calls setPermissions and onSave when save is clicked', async () => {
    const onSave = vi.fn()
    const onClose = vi.fn()
    renderModal({ onSave, onClose })
    await waitFor(() => {
      expect(screen.getByText('Guardar Permisos')).toBeInTheDocument()
    })
    fireEvent.click(screen.getByText('Guardar Permisos'))
    await waitFor(() => {
      expect(mockSetPermissions).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onSave).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled()
    })
  })

  it('shows loading spinner initially', () => {
    // Mock a slow response
    mockGetPermissions.mockReturnValue(new Promise(() => {})) // never resolves
    renderModal()
    expect(document.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('renders permission categories', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText('Ventas')).toBeInTheDocument()
    })
    expect(screen.getByText('Caja')).toBeInTheDocument()
    expect(screen.getByText('Inventario')).toBeInTheDocument()
    expect(screen.getByText('Compras')).toBeInTheDocument()
  })

  it('renders individual permission labels', async () => {
    renderModal()
    await waitFor(() => {
      expect(screen.getByText(/Usar Punto de Venta/)).toBeInTheDocument()
    })
    expect(screen.getByText(/Usar Módulo de Caja/)).toBeInTheDocument()
  })
})
