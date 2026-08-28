import { useEffect, useState } from 'react'
import { useAuthStore } from '../../stores/auth.store'
import { Search, Bell, AlertTriangle, X, ShoppingCart } from 'lucide-react'

interface Notificacion {
  id: string
  tipo: 'stock_bajo' | 'caja_cerrada'
  titulo: string
  mensaje: string
  leida: boolean
}

export default function Header() {
  const usuario = useAuthStore((s) => s.usuario)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  useEffect(() => {
    loadNotificaciones()
    const interval = setInterval(loadNotificaciones, 60000) // cada minuto
    return () => clearInterval(interval)
  }, [])

  const loadNotificaciones = async () => {
    const notifs: Notificacion[] = []

    // Verificar stock bajo
    try {
      const lowStock = await window.api.productos.lowStock()
      if (lowStock && lowStock.length > 0) {
        notifs.push({
          id: 'stock_bajo',
          tipo: 'stock_bajo',
          titulo: `${lowStock.length} producto(s) con stock bajo`,
          mensaje: lowStock.slice(0, 3).map((p: any) => `${p.nombre} (${p.stock} ${p.unidad})`).join(', ') + (lowStock.length > 3 ? '...' : ''),
          leida: false,
        })
      }
    } catch {}

    // Verificar caja
    try {
      const caja = await window.api.caja.status()
      if (!caja) {
        notifs.push({
          id: 'caja_cerrada',
          tipo: 'caja_cerrada',
          titulo: 'Caja cerrada',
          mensaje: 'No hay caja abierta. Abre la caja para iniciar ventas.',
          leida: false,
        })
      }
    } catch {}

    setNotificaciones(notifs)
  }

  const unreadCount = notificaciones.filter(n => !n.leida).length

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative">
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
        <div className="relative">
          <button
            onClick={() => setPanelOpen(!panelOpen)}
            className="relative p-2 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1">
                {unreadCount}
              </span>
            )}
          </button>

          {/* Panel de notificaciones */}
          {panelOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setPanelOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl border border-gray-200 shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <span className="font-semibold text-gray-900 text-sm">Notificaciones</span>
                  <button onClick={() => setPanelOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Sin notificaciones</p>
                    </div>
                  ) : (
                    notificaciones.map((n) => (
                      <div key={n.id} className="px-4 py-3 border-b border-gray-100 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <div className={`p-1.5 rounded-lg mt-0.5 ${
                            n.tipo === 'stock_bajo' ? 'bg-orange-100' : 'bg-red-100'
                          }`}>
                            {n.tipo === 'stock_bajo'
                              ? <AlertTriangle className="w-4 h-4 text-orange-600" />
                              : <ShoppingCart className="w-4 h-4 text-red-600" />
                            }
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">{n.titulo}</p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">{n.mensaje}</p>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
