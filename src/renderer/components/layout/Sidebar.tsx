import { useEffect, useMemo, useState } from 'react'
import { NavLink } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@core/auth/store'
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
  Contact,
  ClipboardList,
  Wallet,
  TruckIcon,
  Tag,
  Utensils,
  ChefHat,
  PieChart,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import type { ModuleId } from '@shared/modules'
import { usePermissions } from '../../hooks/usePermissions'
import { useActiveModules } from '../../hooks/useModules'

type MenuItem = { to: string; icon: any; label: string; permission: string | null; modulo?: ModuleId }

type MenuGroup = {
  id: ModuleId | 'core'
  labelKey: string
  color: string
  items: MenuItem[]
}

const STORAGE_KEY = 'tog.sidebar.collapsed'

function loadCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveCollapsed(value: Record<string, boolean>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
  } catch {
    // sin storage disponible (modo privado, etc.): ignorar
  }
}

export default function Sidebar() {
  const { t } = useTranslation()
  const { usuario, logout } = useAuthStore()
  const { has } = usePermissions()
  const { isActive } = useActiveModules()
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(() => loadCollapsed())

  const allGroups: MenuGroup[] = useMemo(() => {
    const items: MenuItem[] = [
      { to: '/', icon: LayoutDashboard, label: t('nav.dashboard'), permission: null as string | null },
      { to: '/pos', icon: ShoppingCart, label: t('nav.pos'), permission: 'pos_access' },
      { to: '/caja', icon: Lock, label: t('nav.cash'), permission: 'caja_access' },
      { to: '/inventario', icon: Package, label: t('nav.inventory'), permission: 'inventario_access' },
      { to: '/ventas', icon: Receipt, label: t('nav.sales'), permission: 'pos_access' },
      { to: '/creditos', icon: Wallet, label: t('nav.credits'), permission: 'creditos_view' },
      { to: '/compras', icon: Truck, label: t('nav.purchases'), permission: 'compras_access' },
      { to: '/proveedores', icon: Users, label: t('nav.suppliers'), permission: 'compras_suppliers' },
      { to: '/cotizaciones', icon: FileText, label: t('nav.quotes'), permission: 'quotes_access' },
      { to: '/reportes', icon: BarChart3, label: t('nav.reports'), permission: 'reportes_access' },
      { to: '/reportes-visuales', icon: PieChart, label: t('nav.visualReports'), permission: 'reportes_access' },
    ]
    const distribuidor: MenuItem[] = [
      { to: '/clientes', icon: Contact, label: t('nav.clients'), permission: 'distribuidor_clientes_view', modulo: 'distribuidor' },
      { to: '/pedidos', icon: ClipboardList, label: t('nav.orders'), permission: 'distribuidor_pedidos_view', modulo: 'distribuidor' },
      { to: '/remitos', icon: TruckIcon, label: t('nav.remitos'), permission: 'distribuidor_pedidos_view', modulo: 'distribuidor' },
      { to: '/listas-precio', icon: Tag, label: t('nav.priceLists'), permission: 'distribuidor_listas_precio_view', modulo: 'distribuidor' },
    ]
    const restaurant: MenuItem[] = [
      { to: '/restaurant-mesas', icon: Utensils, label: t('nav.restaurantTables'), permission: 'restaurant_mesas_view', modulo: 'restaurant' },
      { to: '/restaurant-cocina', icon: ChefHat, label: t('nav.restaurantKitchen'), permission: 'restaurant_comandas_view', modulo: 'restaurant' },
    ]

    return [
      { id: 'core', labelKey: 'nav.group.comercializador', color: 'text-blue-300', items },
      { id: 'distribuidor', labelKey: 'nav.group.distribuidor', color: 'text-emerald-300', items: distribuidor },
      { id: 'restaurant', labelKey: 'nav.group.restaurant', color: 'text-orange-300', items: restaurant },
    ]
  }, [t])

  // Filtrar: solo mostrar grupos cuyo módulo esté activo en la licencia (core siempre)
  // y dentro de cada grupo, filtrar items por permiso del usuario.
  const visibleGroups = useMemo(() => {
    return allGroups
      .filter((group) => {
        if (group.id === 'core') return true
        return isActive(group.id as ModuleId)
      })
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => {
          if (!item.permission) return true
          return has(item.permission as any)
        }),
      }))
      .filter((group) => group.items.length > 0)
  }, [allGroups, isActive, has])

  // Detectar qué módulo está activo según la ruta actual para auto-expand
  const [activeRoute, setActiveRoute] = useState<string>(() => typeof window !== 'undefined' ? window.location.pathname : '/')
  useEffect(() => {
    const onPop = () => setActiveRoute(window.location.pathname)
    window.addEventListener('popstate', onPop)
    window.addEventListener('tog:route-change', onPop as EventListener)
    return () => {
      window.removeEventListener('popstate', onPop)
      window.removeEventListener('tog:route-change', onPop as EventListener)
    }
  }, [])

  const activeGroupId = useMemo(() => {
    for (const group of visibleGroups) {
      if (group.items.some((it) => it.to === activeRoute || (it.to !== '/' && activeRoute.startsWith(it.to)))) {
        return group.id
      }
    }
    return null
  }, [visibleGroups, activeRoute])

  // Auto-expande el grupo activo; respeta colapsados manuales del resto
  const isExpanded = (groupId: string): boolean => {
    if (groupId === activeGroupId) return true
    return collapsed[groupId] !== true
  }

  const toggleGroup = (groupId: string): void => {
    if (groupId === activeGroupId) return
    setCollapsed((prev) => {
      const next = { ...prev, [groupId]: !prev[groupId] }
      saveCollapsed(next)
      return next
    })
  }

  return (
    <aside className="w-64 bg-gray-900 text-white flex flex-col h-screen">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <img src="./logo.jpg" alt="TOG Admin" className="w-10 h-10 rounded-xl object-cover" />
          <div>
            <h1 className="text-lg font-bold leading-tight">{t('common.appName')}</h1>
            <p className="text-xs text-gray-400">{t('nav.pos')}</p>
          </div>
        </div>
      </div>

      {/* Navegación con scroll */}
      <nav className="flex-1 px-3 py-4 space-y-4 overflow-y-auto sidebar-scroll">
        {visibleGroups.map((group) => {
          const expanded = isExpanded(group.id)
          return (
            <div key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                disabled={group.id === activeGroupId}
                className={`w-full flex items-center justify-between px-2 mb-1 text-xs font-semibold uppercase tracking-wider ${group.color} ${
                  group.id === activeGroupId ? 'cursor-default' : 'cursor-pointer hover:opacity-80'
                }`}
              >
                <span>{t(group.labelKey)}</span>
                {group.id === activeGroupId ? (
                  <ChevronDown className="w-3.5 h-3.5" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5" />
                )}
              </button>
              {expanded && (
                <div className="space-y-1">
                  {group.items.map((item) => (
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
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Usuario + Logout */}
      <div className="px-3 py-4 border-t border-gray-800 flex-shrink-0">
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
              {usuario?.rol === 'admin' ? t('config.admin') : usuario?.rol === 'manager' ? t('config.manager') : t('config.cashier')}
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
