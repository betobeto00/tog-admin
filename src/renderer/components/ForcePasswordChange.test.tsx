// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import ForcePasswordChange from './ForcePasswordChange'
import { useAuthStore } from '../stores/auth.store'

// Mock the auth store
vi.mock('../stores/auth.store', () => ({
  useAuthStore: vi.fn(),
}))

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: any) => {
      const translations: Record<string, string> = {
        'forcePassword.title': 'Password Change Required',
        'forcePassword.subtitle': 'You must change your password to continue',
        'forcePassword.warning': 'Your current password is temporary.',
        'forcePassword.currentPassword': 'Current Password *',
        'forcePassword.newPassword': 'New Password *',
        'forcePassword.confirmPassword': 'Confirm New Password *',
        'forcePassword.changeButton': 'Change Password',
        'forcePassword.changingButton': 'Changing...',
        'forcePassword.errorCurrentRequired': 'Enter your current password',
        'forcePassword.errorMinLength': 'New password must be at least 6 characters',
        'forcePassword.errorMismatch': 'Passwords do not match',
        'forcePassword.errorDifferent': 'New password must be different from current',
        'forcePassword.passwordMismatch': 'Passwords do not match',
        'forcePassword.passwordLength': `${opts?.count || 0}/6 minimum characters`,
        'forcePassword.passwordOk': '✓ Length OK',
        'forcePassword.currentPasswordPlaceholder': 'Enter your current password',
        'forcePassword.newPasswordPlaceholder': 'Min 6 characters',
        'forcePassword.confirmPasswordPlaceholder': 'Repeat the new password',
        'common.closeSession': 'Log Out',
      }
      return translations[key] || key
    },
  }),
}))

describe('ForcePasswordChange', () => {
  const mockChangePassword = vi.fn()
  const mockLogout = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    ;(useAuthStore as any).mockImplementation((selector: any) => {
      const state = {
        usuario: { id: 1, nombre: 'Admin', debe_cambiar_contrasena: 1 },
        changePassword: mockChangePassword,
        logout: mockLogout,
      }
      return selector(state)
    })
  })

  it('renders when user must change password', () => {
    render(<ForcePasswordChange />)
    expect(screen.getByText('Password Change Required')).toBeInTheDocument()
    expect(screen.getByText('You must change your password to continue')).toBeInTheDocument()
  })

  it('does not render when user does not need to change password', () => {
    ;(useAuthStore as any).mockImplementation((selector: any) => {
      return selector({
        usuario: { id: 1, nombre: 'Admin', debe_cambiar_contrasena: 0 },
        changePassword: mockChangePassword,
        logout: mockLogout,
      })
    })

    const { container } = render(<ForcePasswordChange />)
    expect(container.innerHTML).toBe('')
  })

  it('shows error when current password is empty', async () => {
    const { container } = render(<ForcePasswordChange />)
    const form = container.querySelector('form')!
    fireEvent.submit(form)
    expect(screen.getByText('Enter your current password')).toBeInTheDocument()
  })

  it('shows error when new password is too short', async () => {
    const { container } = render(<ForcePasswordChange />)
    const currentInput = screen.getByPlaceholderText('Enter your current password')
    const newInput = screen.getByPlaceholderText('Min 6 characters')

    fireEvent.change(currentInput, { target: { value: 'old123' } })
    fireEvent.change(newInput, { target: { value: '12345' } })
    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(screen.getByText('New password must be at least 6 characters')).toBeInTheDocument()
  })

  it('shows error when passwords do not match', async () => {
    const { container } = render(<ForcePasswordChange />)
    const currentInput = screen.getByPlaceholderText('Enter your current password')
    const newInput = screen.getByPlaceholderText('Min 6 characters')
    const confirmInput = screen.getByPlaceholderText('Repeat the new password')

    fireEvent.change(currentInput, { target: { value: 'old123' } })
    fireEvent.change(newInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmInput, { target: { value: 'different123' } })
    const form = container.querySelector('form')!
    fireEvent.submit(form)

    expect(screen.getAllByText('Passwords do not match').length).toBeGreaterThanOrEqual(1)
  })

  it('calls changePassword with correct args', async () => {
    mockChangePassword.mockResolvedValue({ success: true })

    render(<ForcePasswordChange />)
    const currentInput = screen.getByPlaceholderText('Enter your current password')
    const newInput = screen.getByPlaceholderText('Min 6 characters')
    const confirmInput = screen.getByPlaceholderText('Repeat the new password')

    fireEvent.change(currentInput, { target: { value: 'old123' } })
    fireEvent.change(newInput, { target: { value: 'newpass123' } })
    fireEvent.change(confirmInput, { target: { value: 'newpass123' } })
    fireEvent.click(screen.getByText('Change Password'))

    await waitFor(() => {
      expect(mockChangePassword).toHaveBeenCalledWith('old123', 'newpass123')
    })
  })

  it('calls logout when logout button clicked', () => {
    render(<ForcePasswordChange />)
    fireEvent.click(screen.getByText('Log Out'))
    expect(mockLogout).toHaveBeenCalled()
  })
})
