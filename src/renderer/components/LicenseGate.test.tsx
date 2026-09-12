// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import React from 'react'

vi.mock('../components/ui/Toast', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}))
vi.mock('../components/LicenseSyncForm', () => ({
  default: ({ onSynced }: { onSynced?: () => void }) => (
    <div data-testid="license-sync-form">
      <button onClick={onSynced}>Sync</button>
    </div>
  ),
}))
vi.mock('../pages/SetupPage', () => ({
  default: ({ onLinked }: { onLinked: () => void }) => (
    <div data-testid="setup-page">
      <button onClick={onLinked}>Linked</button>
    </div>
  ),
}))

function Child() {
  return <div data-testid="child">App content</div>
}

function setupWindowApi(handler: (channel: string, ...args: unknown[]) => Promise<unknown>) {
  ;(window as any).api = { invoke: vi.fn(handler) }
}

beforeEach(() => {
  vi.clearAllMocks()
})

async function importLicenseGate() {
  const mod = await import('../components/LicenseGate')
  return mod.default
}

describe('LicenseGate', () => {
  it('shows loading spinner initially', async () => {
    setupWindowApi(() => new Promise(() => {}))
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    expect(screen.getByText(/Verificando licencia/)).toBeInTheDocument()
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('renders children when license is valid', async () => {
    setupWindowApi(async (channel: string) => {
      if (channel === 'red:status') return { modo: 'local' }
      if (channel === 'license:status')
        return { valid: true, cliente: 'Test', expira: '2027-01-01', diasRestantes: 365, error: null, machineId: 'abc123' }
      return null
    })
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
    expect(screen.queryByText(/Verificando licencia/)).not.toBeInTheDocument()
  })

  it('renders children without license check when PC is hija', async () => {
    setupWindowApi(async (channel: string) => {
      if (channel === 'red:status') return { modo: 'hija', baseUrl: 'http://192.168.1.10', pcNombre: 'Base' }
      return null
    })
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('child')).toBeInTheDocument()
    })
  })

  it('shows error UI when license is invalid', async () => {
    setupWindowApi(async (channel: string) => {
      if (channel === 'red:status') return { modo: 'local' }
      if (channel === 'license:status')
        return { valid: false, cliente: null, expira: null, diasRestantes: null, error: 'Licencia expirada', machineId: 'xyz' }
      return null
    })
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    await waitFor(() => {
      expect(screen.getByText('Licencia no válida')).toBeInTheDocument()
    })
    expect(screen.getByText('Licencia expirada')).toBeInTheDocument()
    expect(screen.getByText('xyz')).toBeInTheDocument()
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('shows warning banner when license expires in 30 days or less', async () => {
    setupWindowApi(async (channel: string) => {
      if (channel === 'red:status') return { modo: 'local' }
      if (channel === 'license:status')
        return { valid: true, cliente: 'Test', expira: '2026-10-01', diasRestantes: 15, error: null, machineId: 'abc' }
      return null
    })
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    await waitFor(() => {
      expect(screen.getByText(/15 día\(s\)/)).toBeInTheDocument()
      expect(screen.getByText(/Renovar licencia/)).toBeInTheDocument()
    })
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })

  it('shows error UI when API call throws', async () => {
    setupWindowApi(async () => {
      throw new Error('IPC failed')
    })
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    await waitFor(() => {
      expect(screen.getByText('Licencia no válida')).toBeInTheDocument()
    })
    expect(screen.queryByTestId('child')).not.toBeInTheDocument()
  })

  it('shows import and connect buttons when license is invalid', async () => {
    setupWindowApi(async (channel: string) => {
      if (channel === 'red:status') return { modo: 'local' }
      if (channel === 'license:status')
        return { valid: false, cliente: null, expira: null, diasRestantes: null, error: 'Sin licencia', machineId: 'm1' }
      return null
    })
    const LicenseGate = await importLicenseGate()
    render(
      <LicenseGate>
        <Child />
      </LicenseGate>,
    )
    await waitFor(() => {
      expect(screen.getByText(/Importar Licencia/)).toBeInTheDocument()
      expect(screen.getByText(/Conectar a una PC Base/)).toBeInTheDocument()
    })
  })
})
