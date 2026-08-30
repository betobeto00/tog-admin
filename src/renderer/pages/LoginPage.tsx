import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth.store'
import { Lock, User, Eye, EyeOff, Download, RefreshCw } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { changeLang } from '../i18n'

export default function LoginPage() {
  const { t, i18n } = useTranslation()
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [modalContent, setModalContent] = useState<null | 'copyright' | 'licenses' | 'privacy' | 'terms' | 'releases'>(null)
  const { login, isLoading, error, clearError } = useAuthStore()
  const [appVersion, setAppVersion] = useState('1.0.1')
  const [updateInfo, setUpdateInfo] = useState<{ available: boolean; version?: string } | null>(null)
  const [checkingUpdate, setCheckingUpdate] = useState(false)

  // Obtener versión al montar
  useEffect(() => {
    window.api.app.getVersion().then((v: string | null) => setAppVersion(v || '1.0.1')).catch(() => {})
  }, [])

  const handleCheckUpdate = async () => {
    setCheckingUpdate(true)
    try {
      const result = await window.api.updater.checkForUpdates()
      setUpdateInfo(result)
    } catch {}
    setCheckingUpdate(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario.trim() || !contrasena.trim()) return
    await login(usuario.trim(), contrasena)
  }

  // Release Notes ficticios para demo
  const releaseNotes = [
    {
      version: '1.0.1',
      date: '2026-08-30',
      changes: [
        'Corregido error "t is not defined" en la página de Inventario',
        'Icono de la empresa (logo TOG) en el instalador y ejecutable',
        'Sistema de actualizaciones automáticas (auto-updater)',
        'Release Notes visible desde la pantalla de login',
        'Fondo hero-bg.jpg en la pantalla de login',
      ],
    },
    {
      version: '1.0.0',
      date: '2026-08-28',
      changes: [
        'Sistema de Punto de Venta completo',
        'Gestión de inventario con categorías y unidades de medida',
        'Sistema de ventas con impresión de tickets',
        'Caja diaria con control de movimientos',
        'Reportes de ventas y productos más vendidos',
        'Sistema de cotizaciones',
        'Soporte para terminal de pago VP800',
        'Backup y restauración de base de datos',
        'Sistema de licenciamiento',
        'Soporte multi-idioma (ES/EN)',
      ],
    },
  ]

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat relative"
      style={{ backgroundImage: `url('./hero-bg.jpg')` }}
    >
      <div className="absolute inset-0 bg-white/30" />
      <div className="w-full max-w-md relative z-10">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <img src="./logo.jpg" alt="TOG Admin" className="mx-auto w-20 h-20 rounded-2xl mb-4 shadow-lg object-cover" />
          <h1 className="text-3xl font-bold text-gray-900">TOG Admin</h1>
          <p className="text-gray-500 mt-1">{t('nav.pos')}</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            {t('login.title')}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('login.username')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  value={usuario}
                  onChange={(e) => {
                    setUsuario(e.target.value)
                    clearError()
                  }}
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-300 rounded-lg
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    text-gray-900 placeholder-gray-400 transition-colors"
                  placeholder={t('login.username')}
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                {t('login.password')}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Lock className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => {
                    setContrasena(e.target.value)
                    clearError()
                  }}
                  className="block w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-lg
                    focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                    text-gray-900 placeholder-gray-400 transition-colors"
                  placeholder={t('login.password')}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={isLoading || !usuario.trim() || !contrasena.trim()}
              className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300
                text-white font-medium rounded-lg transition-colors
                focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
                flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('common.loading')}
                </>
              ) : (
                t('login.submit')
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            <p>admin / admin123</p>
          </div>

          {/* Update check */}
          <div className="mt-4 flex items-center justify-center gap-3">
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-600 transition-colors"
            >
              {checkingUpdate ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              {checkingUpdate ? (t('login.checking')) : (t('login.checkUpdates'))}
            </button>
            {updateInfo && (
              <span className="text-xs">
                {updateInfo.available ? (
                  <span className="text-green-600 font-medium">
                    {i18n.language === 'en' ? `v${updateInfo.version} available!` : `¡v${updateInfo.version} disponible!`}
                  </span>
                ) : (
                  <span className="text-gray-400">
                    {t('login.upToDate')}
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center justify-center gap-2 mt-4 text-xs">
          <button
            onClick={() => changeLang('es')}
            className={`px-2 py-1 rounded ${i18n.language === 'es' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            ES
          </button>
          <span className="text-gray-300">•</span>
          <button
            onClick={() => changeLang('en')}
            className={`px-2 py-1 rounded ${i18n.language === 'en' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
          >
            EN
          </button>
        </div>

        {/* Links legales */}
        <div className="flex items-center justify-center gap-3 mt-4 text-xs whitespace-nowrap">
          <button onClick={() => setModalContent('copyright')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            Copyright
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('licenses')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            {t('login.licenses')}
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('privacy')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            {t('login.privacy')}
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('terms')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            {t('login.terms')}
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('releases')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            Releases
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-xs text-gray-400 mt-4">
          {t('login.copyright')} — v{appVersion}
        </p>

      {/* Modal Release Notes */}
      <Modal open={modalContent === 'releases'} onClose={() => setModalContent(null)} title="Release Notes">
        <div className="space-y-4 text-sm text-gray-600 max-h-96 overflow-y-auto">
          {releaseNotes.map((release) => (
            <div key={release.version} className="bg-blue-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-gray-800">TOG Admin v{release.version}</h4>
                <span className="text-xs text-gray-500">{release.date}</span>
              </div>
              <ul className="space-y-1">
                {release.changes.map((change, i) => (
                  <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
                    <span className="text-blue-500 mt-0.5">•</span>
                    {change}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Modal>

      {/* Modales legales (textos legales intencionalmente fijos — son documentos contractuales) */}
      <Modal open={modalContent === 'copyright'} onClose={() => setModalContent(null)} title="Copyright">
        <div className="space-y-4 text-sm text-gray-600">
          <p><strong>TOG Admin v1.0.1</strong></p>
          <p>© {new Date().getFullYear()} TOG Admin. {t('login.allRights')}</p>
          <p>{t('login.proprietaryIntro')}</p>
          <p>{t('login.sourceProtected')}</p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <p>License: Proprietary</p>
            <p>Version: 1.0.1</p>
            <p>Platform: Windows 10/11 (x64)</p>
          </div>
        </div>
      </Modal>

      <Modal open={modalContent === 'licenses'} onClose={() => setModalContent(null)} title={t('login.licensesTitle')}>
        <div className="space-y-4 text-sm text-gray-600 max-h-96 overflow-y-auto">
          <p>{t('login.openSourceIntro')}</p>
          <div className="space-y-3">
            {['React', 'Electron', 'SQLite (better-sqlite3)', 'Tailwind CSS', 'Zustand', 'Zod', 'Recharts', 'Lucide React', 'bcryptjs', 'SerialPort'].map((lib) => (
              <div key={lib} className="bg-gray-50 rounded-lg p-3">
                <p className="font-semibold text-gray-800">{lib}</p>
                <p className="text-xs text-gray-500">License: MIT</p>
              </div>
            ))}
          </div>
        </div>
      </Modal>

      <Modal open={modalContent === 'privacy'} onClose={() => setModalContent(null)} title={t('login.privacyPolicy')}>
        <div className="space-y-4 text-sm text-gray-600">              <h4 className="font-semibold text-gray-800">{t('login.privacyDataCollected')}</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>{i18n.language === 'en' ? 'Business data:' : 'Datos del negocio:'}</strong> {i18n.language === 'en' ? 'Name, address, phone, Tax ID' : 'Nombre, dirección, teléfono, EIN'}</li>
            <li><strong>{i18n.language === 'en' ? 'User data:' : 'Datos de usuarios:'}</strong> {i18n.language === 'en' ? 'Names, username, hashed password, role' : 'Nombres, usuario, contraseña hasheada, rol'}</li>
            <li><strong>{i18n.language === 'en' ? 'Product data:' : 'Datos de productos:'}</strong> {i18n.language === 'en' ? 'Names, prices, stock, categories' : 'Nombres, precios, stock, categorías'}</li>
            <li><strong>{i18n.language === 'en' ? 'Sales data:' : 'Datos de ventas:'}</strong> {i18n.language === 'en' ? 'Transactions, amounts, payment methods' : 'Transacciones, montos, métodos de pago'}</li>
          </ul>              <h4 className="font-semibold text-gray-800">{t('login.privacyStorage')}</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>{i18n.language === 'en' ? 'All data is stored locally on your PC' : 'Todos los datos se almacenan localmente en tu PC'}</li>
            <li>{i18n.language === 'en' ? 'SQLite database on your hard drive' : 'Base de datos SQLite cifrada en tu disco duro'}</li>
            <li>{i18n.language === 'en' ? 'NO data is sent to external servers' : 'NO se envían datos a servidores externos'}</li>
            <li>{i18n.language === 'en' ? 'NO cookies or tracking' : 'NO se utilizan cookies ni tracking'}</li>
          </ul>
        </div>
      </Modal>

      <Modal open={modalContent === 'terms'} onClose={() => setModalContent(null)} title={t('login.termsTitle')}>
        <div className="space-y-4 text-sm text-gray-600 max-h-96 overflow-y-auto">              <h4 className="font-semibold text-gray-800">{t('login.termsUse')}</h4>
          <p className="text-xs">{i18n.language === 'en'
            ? 'TOG Admin is a point-of-sale software designed for commercial use in stationery stores, copy centers and printing shops. The user is responsible for proper use of the software and the accuracy of entered data.'
            : 'TOG Admin es un software de punto de venta diseñado para uso comercial en negocios de papelería, centros de copiado e impresión. El usuario es responsable del uso adecuado del software y de la exactitud de los datos ingresados.'}
          </p>              <h4 className="font-semibold text-gray-800">{t('login.termsLiability')}</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>{i18n.language === 'en' ? 'The software is provided "as is" without warranties' : 'El software se ofrece "tal cual" sin garantías de idoneidad para un propósito particular'}</li>                <li>{t('login.termsBackup')}</li>
                <li>{t('login.termsNotLiable')}</li>
          </ul>
        </div>
      </Modal>
      </div>
    </div>
  )
}
