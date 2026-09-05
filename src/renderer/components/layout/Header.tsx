import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@core/auth/store'
import { Search, Bell, AlertTriangle, X, ShoppingCart, Package, Contact, Receipt } from 'lucide-react'
import { callApi } from '../../lib/api-client'

interface Notificacion {
  id: string
  tipo: 'stock_bajo' | 'caja_cerrada'
  titulo: string
  mensaje: string
  leida: boolean
}

interface CajaHeaderStatus {
  id: number
  estado: string
}

interface ProductHit { id: number; nombre: string; codigo_barras?: string | null; precio_venta: number; stock: number }
interface ClientHit { id: number; nombre: string; documento?: string | null }
interface SaleHit { id: number; numero_venta: number; total: number; fecha: string }

type SearchHit =
  | { kind: 'producto'; data: ProductHit }
  | { kind: 'cliente'; data: ClientHit }
  | { kind: 'venta'; data: SaleHit }

export default function Header() {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const usuario = useAuthStore((s) => s.usuario)
  const [notificaciones, setNotificaciones] = useState<Notificacion[]>([])
  const [panelOpen, setPanelOpen] = useState(false)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchHits, setSearchHits] = useState<SearchHit[]>([])
  const [searching, setSearching] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    loadNotificaciones()
    const interval = setInterval(loadNotificaciones, 60000) // cada minuto
    return () => clearInterval(interval)
  }, [i18n.language])

  const loadNotificaciones = async () => {
    const notifs: Notificacion[] = []

    // Verificar stock bajo
    try {
      const lowStock = await callApi<any[]>('productos:low-stock')
      if (lowStock && lowStock.length > 0) {
        notifs.push({
          id: 'stock_bajo',
          tipo: 'stock_bajo',
          titulo: t('dashboard.productsLow', { count: lowStock.length }),
          mensaje: lowStock.slice(0, 3).map((p: any) => `${p.nombre} (${p.stock} ${p.unidad})`).join(', ') + (lowStock.length > 3 ? '...' : ''),
          leida: false,
        })
      }
    } catch {}

    // Verificar caja
    try {
      const caja = await callApi<CajaHeaderStatus | null>('caja:status')
      if (!caja) {
        notifs.push({
          id: 'caja_cerrada',
          tipo: 'caja_cerrada',
          titulo: t('caja.closed'),
          mensaje: t('caja.mustOpenToSell'),
          leida: false,
        })
      }
    } catch {}

    setNotificaciones(notifs)
  }

  // Búsqueda global con debounce
  useEffect(() => {
    const q = searchQuery.trim()
    if (q.length < 2) {
      setSearchHits([])
      setSearching(false)
      return
    }
    setSearching(true)
    const handle = setTimeout(async () => {
      const hits: SearchHit[] = []
      try {
        const productos = await callApi<ProductHit[]>('productos:list')
        if (Array.isArray(productos)) {
          for (const p of productos) {
            if (
              p.nombre.toLowerCase().includes(q.toLowerCase()) ||
              (p.codigo_barras && String(p.codigo_barras).includes(q))
            ) {
              hits.push({ kind: 'producto', data: p })
            }
            if (hits.length >= 5) break
          }
        }
      } catch {}
      try {
        const clientes = await callApi<ClientHit[]>('clientes:list')
        if (Array.isArray(clientes)) {
          for (const c of clientes) {
            if (
              c.nombre.toLowerCase().includes(q.toLowerCase()) ||
              (c.documento && c.documento.toLowerCase().includes(q.toLowerCase()))
            ) {
              hits.push({ kind: 'cliente', data: c })
            }
            if (hits.length >= 8) break
          }
        }
      } catch {}
      try {
        const ventas = await callApi<any[]>('ventas:list', { limite: 50 })
        if (Array.isArray(ventas)) {
          for (const v of ventas) {
            if (String(v.numero_venta).includes(q)) {
              hits.push({ kind: 'venta', data: { id: v.id, numero_venta: v.numero_venta, total: v.total, fecha: v.fecha } })
            }
            if (hits.length >= 10) break
          }
        }
      } catch {}
      setSearchHits(hits)
      setSearching(false)
    }, 250)
    return () => clearTimeout(handle)
  }, [searchQuery])

  // Atajo Ctrl+K para abrir la búsqueda
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
        setSearchQuery('')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [searchOpen])

  // Cerrar el dropdown al hacer click fuera
  useEffect(() => {
    if (!searchOpen) return
    const onClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [searchOpen])

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const q = searchQuery.trim()
      if (!q) return
      // Si hay un hit de producto y es código de barras exacto, navegar al POS con él
      const exactBarcode = searchHits.find((h) => h.kind === 'producto' && (h.data as ProductHit).codigo_barras && (h.data as ProductHit).codigo_barras === q) as { kind: 'producto'; data: ProductHit } | undefined
      if (exactBarcode) {
        navigate('/pos', { state: { focusBarcode: exactBarcode.data.codigo_barras } })
        setSearchOpen(false)
        setSearchQuery('')
        return
      }
      navigate('/inventario', { state: { query: q } })
      setSearchOpen(false)
      setSearchQuery('')
    }
  }

  const onHitClick = (hit: SearchHit) => {
    if (hit.kind === 'producto') {
      navigate('/inventario', { state: { query: hit.data.nombre, focusId: hit.data.id } })
    } else if (hit.kind === 'cliente') {
      navigate('/clientes', { state: { query: hit.data.nombre, focusId: hit.data.id } })
    } else {
      navigate('/ventas', { state: { focusId: hit.data.id } })
    }
    setSearchOpen(false)
    setSearchQuery('')
  }

  const showDropdown = searchOpen && searchQuery.trim().length >= 2

  const unreadCount = notificaciones.filter(n => !n.leida).length
  const localeForDate = i18n.language === 'en' ? 'en-US' : 'es-VE'

  return (
    <header className="h-14 bg-white border-b border-gray-200 flex items-center justify-between px-6 relative">
      {/* Búsqueda global */}
      <div className="flex-1 max-w-md" ref={searchWrapRef}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchOpen ? searchQuery : ''}
            onChange={(e) => { setSearchQuery(e.target.value); if (!searchOpen) setSearchOpen(true) }}
            onFocus={() => setSearchOpen(true)}
            onKeyDown={onSearchKeyDown}
            placeholder={t('common.searchGlobalPlaceholder') + ' (Ctrl+K)'}
            className="w-full pl-10 pr-16 py-2 border border-gray-200 rounded-lg text-sm
              focus:ring-2 focus:ring-blue-500 focus:border-blue-500
              bg-gray-50 placeholder-gray-400"
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); searchInputRef.current?.focus() }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Dropdown de resultados */}
        {showDropdown && (
          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-xl z-50 max-h-96 overflow-y-auto">
            {searching ? (
              <div className="p-3 text-sm text-gray-400">{t('common.loading')}</div>
            ) : searchHits.length === 0 ? (
              <div className="p-3 text-sm text-gray-400">{t('common.searchGlobalEmpty')}</div>
            ) : (
              <ul className="divide-y divide-gray-100">
                {searchHits.map((hit, idx) => {
                  if (hit.kind === 'producto') {
                    return (
                      <li key={`p-${hit.data.id}-${idx}`}>
                        <button onClick={() => onHitClick(hit)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left text-sm">
                          <Package className="w-4 h-4 text-gray-400" />
                          <span className="flex-1 truncate">{hit.data.nombre}</span>
                          <span className="text-xs text-gray-400">stock {hit.data.stock}</span>
                        </button>
                      </li>
                    )
                  }
                  if (hit.kind === 'cliente') {
                    return (
                      <li key={`c-${hit.data.id}-${idx}`}>
                        <button onClick={() => onHitClick(hit)}
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left text-sm">
                          <Contact className="w-4 h-4 text-gray-400" />
                          <span className="flex-1 truncate">{hit.data.nombre}</span>
                          {hit.data.documento && <span className="text-xs text-gray-400">{hit.data.documento}</span>}
                        </button>
                      </li>
                    )
                  }
                  return (
                    <li key={`v-${hit.data.id}-${idx}`}>
                      <button onClick={() => onHitClick(hit)}
                        className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 text-left text-sm">
                        <Receipt className="w-4 h-4 text-gray-400" />
                        <span className="flex-1 truncate">#{hit.data.numero_venta}</span>
                        <span className="text-xs text-gray-400">${hit.data.total.toFixed(2)}</span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <div className="border-t border-gray-100 px-3 py-2 bg-gray-50">
              <button onClick={() => { navigate('/inventario', { state: { query: searchQuery.trim() } }); setSearchOpen(false); setSearchQuery('') }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700">
                {t('common.searchGlobalGoToInventory')} →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Acciones */}
      <div className="flex items-center gap-4 ml-4">
        {/* Hora actual */}
        <span className="text-sm text-gray-500 hidden md:block">
          {new Date().toLocaleDateString(localeForDate, {
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
                  <span className="font-semibold text-gray-900 text-sm">{t('nav.help')}</span>
                  <button onClick={() => setPanelOpen(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {notificaciones.length === 0 ? (
                    <div className="p-6 text-center text-gray-400">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">{t('common.noData')}</p>
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
