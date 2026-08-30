import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth.store'
import { Lock, Eye, EyeOff, Shield } from 'lucide-react'

export default function ForcePasswordChange() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const changePassword = useAuthStore((s) => s.changePassword)
  const logout = useAuthStore((s) => s.logout)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (!usuario?.debe_cambiar_contrasena) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!currentPassword) {
      setError(t('forcePassword.errorCurrentRequired'))
      return
    }
    if (newPassword.length < 6) {
      setError(t('forcePassword.errorMinLength'))
      return
    }
    if (newPassword !== confirmPassword) {
      setError(t('forcePassword.errorMismatch'))
      return
    }
    if (newPassword === currentPassword) {
      setError(t('forcePassword.errorDifferent'))
      return
    }

    setLoading(true)
    const result = await changePassword(currentPassword, newPassword)
    setLoading(false)

    if (!result.success) {
      setError(result.error || t('errors.passwordChangeError'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-xl">
              <Shield className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold">{t('forcePassword.title')}</h2>
              <p className="text-sm text-white/80">{t('forcePassword.subtitle')}</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-orange-50 rounded-xl p-4 text-sm text-orange-700">
            <p>{t('forcePassword.warning')}</p>
          </div>

          {/* Current password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('forcePassword.currentPassword')}</label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder={t('forcePassword.currentPasswordPlaceholder')}
                autoFocus
              />
              <button type="button" onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* New password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('forcePassword.newPassword')}</label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-4 py-2.5 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                placeholder={t('forcePassword.newPasswordPlaceholder')}
              />
              <button type="button" onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            {newPassword && (
              <div className="mt-2 flex gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${
                    newPassword.length >= i * 3
                      ? newPassword.length >= 12 ? 'bg-green-500' : newPassword.length >= 8 ? 'bg-yellow-500' : 'bg-orange-400'
                      : 'bg-gray-200'
                  }`} />
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">
              {newPassword.length < 6 ? t('forcePassword.passwordLength', { count: newPassword.length }) : t('forcePassword.passwordOk')}
            </p>
          </div>

          {/* Confirm password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('forcePassword.confirmPassword')}</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={t('forcePassword.confirmPasswordPlaceholder')}
            />
            {confirmPassword && confirmPassword !== newPassword && (
              <p className="text-xs text-red-500 mt-1">{t('forcePassword.passwordMismatch')}</p>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 rounded-lg p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={logout}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.closeSession')}
            </button>
            <button type="submit"
              disabled={loading || !currentPassword || !newPassword || !confirmPassword}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2">
              <Lock className="w-4 h-4" />
              {loading ? t('forcePassword.changingButton') : t('forcePassword.changeButton')}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
