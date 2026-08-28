import { useAuthStore } from '../../stores/auth.store'
import { Search, Bell } from 'lucide-react'

export default function Header() {
  const usuario = useAuthStore((s) => s.usuario)

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      {/* Búsqueda global */}
      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos, ventas..."
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              bg-gray-50 placeholder-gray-400"
          />
        </div>
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-4 ml-4">
        {/* Hora actual */}
        <span className="text-sm text-gray-500 hidden md:block">
          {new Date().toLocaleDateString('es-VE', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </span>

        {/* Notificaciones */}
        <button className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
        </button>
      </div>
    </header>
  )
}
