import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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

export default function Sidebar() {
  const { t } = useTranslation()
  const { usuario, logout } = useAuthStore()

  const menuItems = [
    { to: '/', icon: LayoutDashboard, label: t('nav.dashboard') },
    { to: '/pos', icon: ShoppingCart, label: t('nav.pos') },
    { to: '/caja', icon: Lock, label: t('nav.cash') },
    { to: '/inventario', icon: Package, label: t('nav.inventory') },
    { to: '/ventas', icon: Receipt, label: t('nav.sales') },
    { to: '/compras', icon: Truck, label: t('nav.purchases') },
    { to: '/proveedores', icon: Users, label: t('nav.suppliers') },
    { to: '/cotizaciones', icon: FileText, label: t('nav.quotes') },
    { to: '/reportes', icon: BarChart3, label: t('nav.reports') },
    { to: '/configuracion', icon: Settings, label: t('nav.settings') },
    { to: '/ayuda', icon: HelpCircle, label: t('nav.help') },
  ]

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <img src="./logo.jpg" alt="TOG Admin" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <h1 className="text-lg font-bold leading-tight">{t('common.appName')}</h1>
            <p className="text-xs text-gray-400">{t('nav.pos')}</p>
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
              {usuario?.rol === 'admin' ? t('config.admin') : t('config.cashier')}
            </p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
            text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors"
        >
          <LogOut className="w-5 h-5" />
          {t('nav.logout')}
        </button>
      </div>
    </aside>
  )
}
