import { NavLink } from 'react-router-dom'
import { useAuthStore } from '../../stores/auth.store'
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Lock,
  Truck,
  Users,
  BarChart3,
  FileText,
  Settings,
  LogOut,
  HelpCircle,
} from 'lucide-react'

const menuItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/pos', icon: ShoppingCart, label: 'Punto de Venta' },
  { to: '/caja', icon: Lock, label: 'Caja' },
  { to: '/inventario', icon: Package, label: 'Inventario' },
  { to: '/ventas', icon: Receipt, label: 'Ventas' },
  { to: '/compras', icon: Truck, label: 'Compras' },
  { to: '/proveedores', icon: Users, label: 'Proveedores' },
  { to: '/cotizaciones', icon: FileText, label: 'Quotes' },
  { to: '/reportes', icon: BarChart3, label: 'Reportes' },
  { to: '/configuracion', icon: Settings, label: 'Settings' },
  { to: '/ayuda', icon: HelpCircle, label: 'Ayuda' },
]

export default function Sidebar() {
  const { usuario, logout } = useAuthStore()

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <span className="text-white text-lg font-bold">T</span>
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">TOG Admin</h1>
            <p className="text-xs text-gray-400">Punto de Venta</p>
          </div>
        </div>
      </div>

      {/* Navegación */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {menuItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`
            }
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Usuario + Logout */}
      <div className="px-3 py-4 border-t border-gray-800">
        <div className="flex items-center gap-3 px-3 mb-3">
          <div className="w-8 h-8 bg-gray-700 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-white">
              {usuario?.nombre?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {usuario?.nombre}
            </p>
            <p className="text-xs text-gray-400 capitalize">
              {usuario?.rol}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          Cerrar Sesión
        </button>
      </div>
    </aside>
  )
}
