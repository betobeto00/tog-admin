// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { ErrorBoundary } from './ErrorBoundary'

// Mock window.api.crashReport
const mockSave = vi.fn()
const mockOpenFolder = vi.fn()
const mockClipboard = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  ;(window as any).api = {
    crashReport: {
      save: mockSave,
      openFolder: mockOpenFolder,
    },
  }
  ;(navigator as any).clipboard = { writeText: mockClipboard }
  mockSave.mockResolvedValue({ success: true, path: '/tmp/crash-test.txt' })
})

function ThrowingComponent() {
  throw new Error('Test error')
}

function WorkingComponent() {
  return <div>Working</div>
}

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <ErrorBoundary>
        <WorkingComponent />
      </ErrorBoundary>
    )
    expect(screen.getByText('Working')).toBeInTheDocument()
  })

  it('shows error UI when child throws', () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    expect(screen.getByText(/Error de la Aplicación|Application Error/)).toBeInTheDocument()
    expect(screen.getByText(/Test error/)).toBeInTheDocument()
    spy.mockRestore()
  })

  it('saves crash report on error', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    // Wait for async save
    await vi.waitFor(() => {
      expect(mockSave).toHaveBeenCalled()
    })

    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'renderer-error',
        message: 'Test error',
      })
    )
    spy.mockRestore()
  })

  it('shows report path after saving', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    await vi.waitFor(() => {
      expect(screen.getByText(/Informe generado|Report generated/)).toBeInTheDocument()
    })

    expect(screen.getByText('/tmp/crash-test.txt')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('has restart button', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    const restartBtn = screen.getByText(/Reiniciar|Restart/)
    expect(restartBtn).toBeInTheDocument()
    spy.mockRestore()
  })

  it('has open folder button', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>
    )

    await vi.waitFor(() => {
      const btn = screen.getByRole('button', { name: /Open|Abrir/i })
      expect(btn).toBeInTheDocument()
    })

    const btn = screen.getByRole('button', { name: /Open|Abrir/i })
    fireEvent.click(btn)
    expect(mockOpenFolder).toHaveBeenCalled()
    spy.mockRestore()
  })
})
