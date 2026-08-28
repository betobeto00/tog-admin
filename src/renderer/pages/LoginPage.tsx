import { useState } from 'react'
import { useAuthStore } from '../stores/auth.store'
import { Lock, User, Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const [usuario, setUsuario] = useState('')
  const [contrasena, setContrasena] = useState('')
  const [showPassword, setShowPassword] = useState(false)
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

        {/* Version */}
        <p className="text-center text-xs text-gray-400 mt-6">
          TOG Admin v1.0.0
        </p>
      </div>
    </div>
  )
}
