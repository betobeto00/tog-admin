import { useState } from 'react'
import { useAuthStore } from '../stores/auth.store'
import { Lock, User, Eye, EyeOff, ExternalLink } from 'lucide-react'
import Modal from '../components/ui/Modal'

export default function LoginPage() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [modalContent, setModalContent] = useState<null | 'copyright' | 'licenses' | 'privacy' | 'terms'>(null)
  const { login, isLoading, error, clearError } = useAuthStore()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!usuario.trim() || !contrasena.trim()) return
    await login(usuario.trim(), contrasena)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg">
            <span className="text-white text-3xl font-bold">T</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">TOG Admin</h1>
          <p className="text-gray-500 mt-1">Sistema de Punto de Venta</p>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 text-center">
            Iniciar Sesión
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Usuario */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Usuario
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
                  placeholder="Ingresa tu usuario"
                  autoFocus
                  autoComplete="username"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Contraseña
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
                  placeholder="Ingresa tu contraseña"
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
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </button>
          </form>

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-400">
            <p>Usuario por defecto: <strong>admin</strong> / <strong>admin123</strong></p>
          </div>
        </div>

        {/* Links legales */}
        <div className="flex items-center justify-center gap-4 mt-6 text-xs">
          <button onClick={() => setModalContent('copyright')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            Copyright
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('licenses')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            Licencias
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('privacy')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            Privacidad
          </button>
          <span className="text-gray-300">•</span>
          <button onClick={() => setModalContent('terms')} className="text-gray-400 hover:text-gray-600 transition-colors underline underline-offset-2">
            Términos
          </button>
        </div>

        {/* Version */}
        <p className="text-center text-xs text-gray-400 mt-4">
          TOG Admin v1.0.0 — © {new Date().getFullYear()} TOG Admin. Todos los derechos reservados.
        </p>

      {/* Modales legales */}
      <Modal open={modalContent === 'copyright'} onClose={() => setModalContent(null)} title="Copyright">
        <div className="space-y-4 text-sm text-gray-600">
          <p><strong>TOG Admin v1.0.0</strong></p>
          <p>© {new Date().getFullYear()} TOG Admin. Todos los derechos reservados.</p>
          <p>Este software es propiedad exclusiva de TOG Admin. Queda prohibida su reproducción, distribución o modificación sin autorización previa por escrito.</p>
          <p>El código fuente está protegido y no es de acceso público.</p>
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500">
            <p>Licencia de uso: Licencia propietaria</p>
            <p>Versión: 1.0.0</p>
            <p>Plataforma: Windows 10/11 (x64)</p>
          </div>
        </div>
      </Modal>

      <Modal open={modalContent === 'licenses'} onClose={() => setModalContent(null)} title="Licencias de Código Abierto">
        <div className="space-y-4 text-sm text-gray-600 max-h-96 overflow-y-auto">
          <p>Este software utiliza las siguientes librerías de código abierto:</p>
          <div className="space-y-3">
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">React</p>
              <p className="text-xs text-gray-500">Licencia: MIT — Facebook, Inc.</p>
              <p className="text-xs">Framework de UI para construir interfaces de usuario.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Electron</p>
              <p className="text-xs text-gray-500">Licencia: MIT — GitHub, Inc.</p>
              <p className="text-xs">Framework para aplicaciones de escritorio con web technologies.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">SQLite (better-sqlite3)</p>
              <p className="text-xs text-gray-500">Licencia: MIT</p>
              <p className="text-xs">Base de datos local de alta performance.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Tailwind CSS</p>
              <p className="text-xs text-gray-500">Licencia: MIT — Tailwind Labs</p>
              <p className="text-xs">Framework de utilidad CSS.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Zustand</p>
              <p className="text-xs text-gray-500">Licencia: MIT</p>
              <p className="text-xs">State management ligero para React.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Zod</p>
              <p className="text-xs text-gray-500">Licencia: MIT</p>
              <p className="text-xs">Validación de esquemas TypeScript-first.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Recharts</p>
              <p className="text-xs text-gray-500">Licencia: MIT</p>
              <p className="text-xs">Librería de gráficos para React.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">Lucide React</p>
              <p className="text-xs text-gray-500">Licencia: ISC</p>
              <p className="text-xs">Iconos SVG open source.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">bcryptjs</p>
              <p className="text-xs text-gray-500">Licencia: MIT</p>
              <p className="text-xs">Hash de contraseñas seguro.</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="font-semibold text-gray-800">SerialPort</p>
              <p className="text-xs text-gray-500">Licencia: MIT</p>
              <p className="text-xs">Comunicación serial para terminales de pago.</p>
            </div>
          </div>
          <p className="text-xs text-gray-400">Todas las licencias MIT/ISC permiten uso, modificación y distribución.</p>
        </div>
      </Modal>

      <Modal open={modalContent === 'privacy'} onClose={() => setModalContent(null)} title="Política de Privacidad">
        <div className="space-y-4 text-sm text-gray-600">
          <h4 className="font-semibold text-gray-800">1. Datos que recopila TOG Admin</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li><strong>Datos del negocio:</strong> Nombre, dirección, teléfono, EIN</li>
            <li><strong>Datos de usuarios:</strong> Nombres, usuario, contraseña hasheada, rol</li>
            <li><strong>Datos de productos:</strong> Nombres, precios, stock, categorías</li>
            <li><strong>Datos de ventas:</strong> Transacciones, montos, métodos de pago</li>
            <li><strong>Datos de proveedores:</strong> Nombres, contactos, dirección</li>
          </ul>

          <h4 className="font-semibold text-gray-800">2. Cómo se almacenan los datos</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Todos los datos se almacenan localmente en tu PC</li>
            <li>Base de datos SQLite cifrada en tu disco duro</li>
            <li>NO se envían datos a servidores externos</li>
            <li>NO se utilizan cookies ni tracking</li>
            <li>Las contraseñas se almacenan con hash bcrypt (irreversible)</li>
          </ul>

          <h4 className="font-semibold text-gray-800">3. Seguridad</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Comunicación segura entre procesos (contextIsolation)</li>
            <li>Sin acceso a internet de la aplicación</li>
            <li>Rate limiting en autenticación</li>
            <li>Sesión con timeout de inactividad</li>
          </ul>

          <h4 className="font-semibold text-gray-800">4. Tus derechos</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Puedes exportar todos tus datos (backup)</li>
            <li>Puedes eliminar tus datos (restaurar backup vacío)</li>
            <li>Tus datos nunca salen de tu computadora</li>
          </ul>
        </div>
      </Modal>

      <Modal open={modalContent === 'terms'} onClose={() => setModalContent(null)} title="Términos y Condiciones">
        <div className="space-y-4 text-sm text-gray-600 max-h-96 overflow-y-auto">
          <h4 className="font-semibold text-gray-800">1. Uso del Software</h4>
          <p className="text-xs">TOG Admin es un software de punto de venta diseñado para uso comercial en negocios de papelería, centros de copiado e impresión. El usuario es responsable del uso adecuado del software y de la exactitud de los datos ingresados.</p>

          <h4 className="font-semibold text-gray-800">2. Responsabilidad</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>El software se ofrece "tal cual" sin garantías de idoneidad para un propósito particular</li>
            <li>El usuario es responsable de hacer backups regulares de sus datos</li>
            <li>El desarrollador no es responsable por pérdidas de datos derivadas del mal uso</li>
            <li>El software no sustituye asesoría contable, fiscal o legal profesional</li>
          </ul>

          <h4 className="font-semibold text-gray-800">3. Licencia de Uso</h4>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>Se otorga una licencia de uso no exclusiva y no transferible</li>
            <li>El usuario puede usar el software en sus computadoras autorizadas</li>
            <li>Questa prohibido descompilar, redistribuir o modificar el software</li>
            <li>La licencia es perpetua mientras se cumplan estos términos</li>
          </ul>

          <h4 className="font-semibold text-gray-800">4. Actualizaciones</h4>
          <p className="text-xs">El desarrollador se reserva el derecho de actualizar el software en cualquier momento. Las actualizaciones pueden incluir correcciones de errores, mejoras de rendimiento y nuevas funcionalidades.</p>

          <h4 className="font-semibold text-gray-800">5. Soporte Técnico</h4>
          <p className="text-xs">El soporte técnico está disponible para usuarios con licencia válida. El tiempo de respuesta varía según la severidad del problema reportado.</p>

          <h4 className="font-semibold text-gray-800">6. Ley Aplicable</h4>
          <p className="text-xs">Estos términos se rigen por las leyes de la jurisdicción aplicable. Cualquier disputa será resuelta en los tribunales competentes.</p>
        </div>
      </Modal>
      </div>
    </div>
  )
}
