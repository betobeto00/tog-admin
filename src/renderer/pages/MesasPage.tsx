import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Plus, Search, Trash2, Utensils, ArrowRight, Send,
  CheckCircle, Minus, PlusCircle, Banknote, Smartphone, Printer
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { callApi } from '../lib/api-client'

interface Mesa {
  id: number
  nombre: string
  capacidad: number
  estado: string
  comanda_id: number | null
  total_actual: number
}
interface Producto { id: number; nombre: string; precio_venta: number; tipo: string }
interface ComandaItem {
  id: number
  producto_id: number | null
  producto_nombre?: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
  estado: string
  notas: string | null
}
interface Comanda {
  id: number
  mesa_id: number
  mesa_nombre: string
  estado: string
  total: number
  notas: string | null
  detalles: ComandaItem[]
}

const ITEM_ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  en_preparacion: 'bg-orange-100 text-orange-700',
  listo: 'bg-blue-100 text-blue-700',
  servido: 'bg-green-100 text-green-700',
  cancelado: 'bg-gray-100 text-gray-500',
}

export default function MesasPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()

  const [mesas, setMesas] = useState<Mesa[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [loading, setLoading] = useState(true)

  // Nueva mesa
  const [newTableOpen, setNewTableOpen] = useState(false)
  const [newTableForm, setNewTableForm] = useState({ nombre: '', capacidad: 4 })

  // Comanda modal
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [comandaLoading, setComandaLoading] = useState(false)
  const [searchProd, setSearchProd] = useState('')
  const [customItem, setCustomItem] = useState({ descripcion: '', precio: 0, cantidad: 1 })
  const [moveDestino, setMoveDestino] = useState('')

  // Checkout
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [checkoutForm, setCheckoutForm] = useState({ metodo_pago: 'efectivo', monto_pagado: 0, deudor_nombre: '' })
  const [checkingOut, setCheckingOut] = useState(false)
  const [metodosPagoActivos, setMetodosPagoActivos] = useState<Array<{ clave: string; nombre: string; icono?: string | null }>>([])

  const [deleteTable, setDeleteTable] = useState<Mesa | null>(null)

  // Modo touch + atajos de teclado (F2 buscar · F5 cobrar · F9 cocina)
  const [touchMode, setTouchMode] = useState(() => localStorage.getItem('restaurant_touch_mode') === '1')
  const actionsRef = useRef({ openCheckout: () => {}, sendKitchen: () => {} })

  const loadMesas = async () => {
    try {
      const list = await callApi<Mesa[]>('mesas:list')
      setMesas(Array.isArray(list) ? list : [])
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMesas()
    callApi<Producto[]>('productos:list').then((p) => setProductos(Array.isArray(p) ? p : [])).catch(() => {})
    callApi<Array<{ clave: string; nombre: string }>>('metodos-pago:list', { activoOnly: true })
      .then((m) => setMetodosPagoActivos(Array.isArray(m) ? m : []))
      .catch(() => setMetodosPagoActivos([]))
  }, [])

  // Polling automático del estado de mesas cada 5s cuando NO hay comanda abierta.
  // Cuando hay comanda abierta, refreshComanda() ya mantiene el detalle fresco
  // y el usuario está enfocado en ese modal.
  useEffect(() => {
    if (comanda) return
    const interval = setInterval(() => { loadMesas() }, 5000)
    return () => clearInterval(interval)
  }, [comanda])

  const openComanda = async (mesa: Mesa) => {
    setComandaLoading(true)
    try {
      let comandaId = mesa.comanda_id
      if (!comandaId) {
        const res = await callApi<{ comanda_id: number }>('comandas:open', { mesa_id: mesa.id })
        comandaId = res.comanda_id
      }
      await loadComanda(comandaId)
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    } finally {
      setComandaLoading(false)
    }
  }

  const loadComanda = async (comandaId: number) => {
    const list = await callApi<Comanda[]>('comandas:list', { activas: true })
    const found = list.find((c) => c.id === comandaId)
    if (found) {
      setComanda(found)
    } else {
      setComanda(null)
      await loadMesas()
    }
  }

  const refreshComanda = async () => {
    if (!comanda) return
    await loadComanda(comanda.id)
  }

  const saveNewTable = async () => {
    if (!newTableForm.nombre.trim()) return
    try {
      await callApi('mesas:create', { nombre: newTableForm.nombre.trim(), capacidad: newTableForm.capacidad || 4 })
      setNewTableOpen(false)
      setNewTableForm({ nombre: '', capacidad: 4 })
      await loadMesas()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  const removeTable = async (mesa: Mesa) => {
    try {
      await callApi('mesas:delete', { id: mesa.id })
      setDeleteTable(null)
      await loadMesas()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  const searchResults = searchProd.trim()
    ? productos.filter((p) => p.nombre.toLowerCase().includes(searchProd.toLowerCase())).slice(0, 8)
    : []

  const addProductItem = async (p: Producto) => {
    if (!comanda) return
    try {
      await callApi('comandas:add-item', { comanda_id: comanda.id, producto_id: p.id, cantidad: 1 })
      setSearchProd('')
      await refreshComanda()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  const addCustomItem = async () => {
    if (!comanda || !customItem.descripcion.trim() || customItem.cantidad <= 0) return
    try {
      await callApi('comandas:add-item', {
        comanda_id: comanda.id,
        cantidad: customItem.cantidad,
        descripcion: customItem.descripcion.trim(),
        precio_unitario: customItem.precio || 0,
      })
      setCustomItem({ descripcion: '', precio: 0, cantidad: 1 })
      await refreshComanda()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  const updateCantidad = async (item: ComandaItem, cantidad: number) => {
    if (!comanda || cantidad <= 0) return
    await callApi('comandas:update-item', { comanda_id: comanda.id, detalle_id: item.id, data: { cantidad } }).catch((err: any) => toast.error(err?.message || t('restaurant.error')))
    await refreshComanda()
  }

  const removeItem = async (item: ComandaItem) => {
    if (!comanda) return
    await callApi('comandas:remove-item', { comanda_id: comanda.id, detalle_id: item.id }).catch((err: any) => toast.error(err?.message || t('restaurant.error')))
    await refreshComanda()
  }

  const markItem = async (item: ComandaItem, estado: string) => {
    if (!comanda) return
    await callApi('comandas:mark-item', { comanda_id: comanda.id, detalle_id: item.id, estado }).catch((err: any) => toast.error(err?.message || t('restaurant.error')))
    await refreshComanda()
  }

  const sendKitchen = async () => {
    if (!comanda) return
    try {
      await callApi('comandas:send-kitchen', { comanda_id: comanda.id })
      toast.success(t('restaurant.sentToKitchen'))
      await printComanda()
      await refreshComanda()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  const moveOrMergeTable = async () => {
    if (!comanda || !moveDestino) return
    const destino = mesas.find((m) => m.id === Number(moveDestino))
    if (!destino) return
    try {
      const esFusion = destino.estado === 'ocupada'
      const res = await callApi<{ success?: boolean; error?: string }>(esFusion ? 'comandas:merge' : 'comandas:move', {
        comanda_id: comanda.id,
        mesa_destino_id: destino.id,
      })
      if (res?.success === false) {
        toast.error(res.error || t('restaurant.error'))
        return
      }
      toast.success(esFusion ? t('restaurant.tablesMerged') : t('restaurant.tableMoved'))
      setMoveDestino('')
      setComanda(null)
      await loadMesas()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    }
  }

  const openCheckout = () => {
    if (!comanda) return
    setCheckoutForm({ metodo_pago: 'efectivo', monto_pagado: comanda.total, deudor_nombre: '' })
    setCheckoutOpen(true)
  }

  const toggleTouchMode = () => {
    const next = !touchMode
    setTouchMode(next)
    localStorage.setItem('restaurant_touch_mode', next ? '1' : '0')
  }

  const printComanda = async () => {
    if (!comanda) return
    let bizName = '', bizAddr = '', bizPhone = ''
    try {
      const cfg = await callApi<any[]>('config:get')
      const get = (k: string) => cfg.find((c: any) => c.clave === k)?.valor || ''
      bizName = get('nombre_negocio')
      bizAddr = get('direccion')
      bizPhone = get('telefono')
    } catch {}
    const rows = comanda.detalles
      .filter((d) => d.estado !== 'cancelado')
      .map((d) => `<tr><td style="text-align:center">${d.cantidad}</td><td>${d.descripcion}${d.notas ? ` <span style="color:#888">(${d.notas})</span>` : ''}</td></tr>`)
      .join('')
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><style>
      body{font-family:monospace;font-size:11px;width:300px;margin:0 auto;padding:12px}
      h2{text-align:center;margin:4px 0;font-size:14px}
      table{width:100%;border-collapse:collapse;margin:6px 0}
      td{padding:2px 0;font-size:11px}
      .center{text-align:center}hr{border:none;border-top:1px dashed #000;margin:6px 0}
      .big{font-size:13px;font-weight:bold}
    </style></head><body>
      <div class="center big">${bizName || 'TOG Admin'}</div>
      ${bizAddr ? `<div class="center" style="font-size:9px">${bizAddr}</div>` : ''}
      ${bizPhone ? `<div class="center" style="font-size:9px">${bizPhone}</div>` : ''}
      <h2>${t('restaurant.comandaTicket')}</h2>
      <div class="center">${comanda.mesa_nombre} — #${comanda.id}</div>
      <div class="center" style="font-size:10px;color:#666">${formatDateTime(new Date().toISOString())}</div>
      <hr>
      <table>${rows || `<tr><td class="center">—</td></tr>`}</table>
      <hr>
      <div class="center" style="font-size:10px">${t('quotes.receiptThankYou')}</div>
    </body></html>`)
    win.document.close()
    win.print()
  }

  // Atajos: F2 busca · F5 cobra · F9 envía a cocina (siempre que haya comanda abierta)
  useEffect(() => {
    actionsRef.current = { openCheckout, sendKitchen }
  }, [openCheckout, sendKitchen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!comanda) return
      if (e.key === 'F2') {
        e.preventDefault()
        document.getElementById('restaurant-search')?.focus()
      } else if (e.key === 'F5') {
        e.preventDefault()
        actionsRef.current.openCheckout()
      } else if (e.key === 'F9') {
        e.preventDefault()
        actionsRef.current.sendKitchen()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [comanda])

  const doCheckout = async () => {
    if (!comanda || checkingOut) return
    setCheckingOut(true)
    try {
      const res = await callApi<{ success: boolean; numero_venta?: number; error?: string }>('comandas:checkout', {
        comanda_id: comanda.id,
        metodo_pago: checkoutForm.metodo_pago,
        monto_pagado: Number(checkoutForm.monto_pagado) || 0,
        deudor_nombre: checkoutForm.metodo_pago === 'fiado' ? checkoutForm.deudor_nombre.trim() || undefined : undefined,
      })
      if (res?.success === false) {
        toast.error(res.error || t('restaurant.error'))
        return
      }
      toast.success(t('restaurant.charged'))
      setCheckoutOpen(false)
      setComanda(null)
      await loadMesas()
    } catch (err: any) {
      toast.error(err?.message || t('restaurant.error'))
    } finally {
      setCheckingOut(false)
    }
  }

  const mesasDestino = mesas.filter((m) => m.id !== comanda?.mesa_id)
  const mesaDestinoSeleccionada = mesasDestino.find((m) => m.id === Number(moveDestino))
  const totalCobrar = comanda?.total || 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('restaurant.tablesTitle')}</h1>              <p className="text-sm text-gray-500">{mesas.length} {t('restaurant.tablesTitle').toLowerCase()}</p>
              <p className="text-xs text-gray-400">{t('restaurant.shortcutHint')}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={toggleTouchMode}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
              touchMode ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <Smartphone className="w-4 h-4" /> {t('restaurant.touchMode')}
          </button>
          {has('restaurant_mesas_edit') && (
            <button onClick={() => setNewTableOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> {t('restaurant.newTable')}
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
      ) : mesas.length === 0 ? (
        <div className="text-center py-16 text-gray-400"><Utensils className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>{t('restaurant.noTables')}</p></div>
      ) : (
        <div className={`grid gap-4 ${touchMode ? 'grid-cols-2 md:grid-cols-4 xl:grid-cols-6' : 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'}`}>
          {mesas.map((mesa) => {
            const libre = mesa.estado === 'libre'
            return (
              <div key={mesa.id}
                onClick={() => openComanda(mesa)}
                className={`rounded-xl border cursor-pointer transition-shadow hover:shadow-md ${touchMode ? 'p-6 min-h-[120px]' : 'p-5'} ${libre ? 'bg-white border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className={`font-bold text-gray-900 ${touchMode ? 'text-xl' : ''}`}>{mesa.nombre}</p>
                    <p className="text-xs text-gray-500">{mesa.capacidad} {t('restaurant.capacity').toLowerCase()}</p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${libre ? 'bg-green-100 text-green-700' : 'bg-blue-600 text-white'}`}>
                    {libre ? t('restaurant.free') : t('restaurant.occupied')}
                  </span>
                </div>
                {!libre && (
                  <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between">
                    <span className={`font-semibold text-gray-900 ${touchMode ? 'text-lg' : 'text-sm'}`}>{formatCurrency(mesa.total_actual || 0)}</span>
                    <span className="text-xs text-blue-600 flex items-center gap-1">
                      {t('restaurant.openTable')} <ArrowRight className="w-3 h-3" />
                    </span>
                  </div>
                )}
                {libre && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{t('restaurant.openOrder')}</span>
                    {has('restaurant_mesas_edit') && (
                      <button onClick={(e) => { e.stopPropagation(); setDeleteTable(mesa) }}
                        className="p-1 hover:bg-red-50 rounded-lg" title={t('restaurant.deleteTable')}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modal Nueva Mesa */}
      <Modal open={newTableOpen} onClose={() => setNewTableOpen(false)} title={t('restaurant.newTable')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('restaurant.tableName')} *</label>
            <input value={newTableForm.nombre} onChange={(e) => setNewTableForm({ ...newTableForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="Mesa 7" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('restaurant.capacity')}</label>
            <input type="number" min={1} value={newTableForm.capacidad}
              onChange={(e) => setNewTableForm({ ...newTableForm, capacidad: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setNewTableOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">{t('quotes.cancel')}</button>
            <button onClick={saveNewTable} disabled={!newTableForm.nombre.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {t('restaurant.newTable')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Comanda */}
      <Modal open={!!comanda} onClose={() => setComanda(null)} title={comanda ? `${t('restaurant.comanda')} — ${comanda.mesa_nombre}` : ''} wide>
        {comanda && (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${ITEM_ESTADO_STYLES[comanda.estado] || 'bg-gray-100 text-gray-600'}`}>
                  {comanda.estado}
                </span>
                <span className="font-bold text-gray-900">{formatCurrency(comanda.total || 0)}</span>
              </div>
              <div className="flex gap-2">
                <select value={moveDestino} onChange={(e) => setMoveDestino(e.target.value)}
                  className={`px-2 py-1.5 text-xs border border-gray-300 rounded-lg bg-white ${touchMode ? 'py-3 text-base' : ''}`}>
                  <option value="">{t('restaurant.moveOrMerge')}…</option>
                  {mesasDestino.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre} ({m.estado === 'libre' ? t('restaurant.free') : t('restaurant.occupied')})
                    </option>
                  ))}
                </select>
                {moveDestino && (
                  <button onClick={moveOrMergeTable}
                    className={`px-3 text-xs font-medium text-white rounded-lg flex items-center gap-1 ${touchMode ? 'py-3 text-base' : 'py-1.5'} ${
                      mesaDestinoSeleccionada?.estado === 'ocupada' ? 'bg-purple-600 hover:bg-purple-700' : 'bg-amber-500 hover:bg-amber-600'
                    }`}>
                    <ArrowRight className="w-3 h-3" /> {mesaDestinoSeleccionada?.estado === 'ocupada' ? t('restaurant.mergeAction') : t('restaurant.moveTable')}
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {comanda.estado === 'abierta' && (
                <button onClick={sendKitchen}
                  className={`flex-1 font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 flex items-center justify-center gap-2 ${touchMode ? 'py-4 text-lg' : 'py-2.5 text-sm'}`}>
                  <Send className="w-5 h-5" /> {t('restaurant.sendToKitchen')} <span className="text-xs opacity-70 hidden md:inline">F9</span>
                </button>
              )}
              <button onClick={printComanda}
                className={`px-4 font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 flex items-center justify-center gap-2 ${touchMode ? 'py-4 text-lg' : 'py-2.5 text-sm'}`}
                title={t('restaurant.printComanda')}>
                <Printer className="w-5 h-5" />
              </button>
            </div>

            {/* Agregar ítem */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input id="restaurant-search" value={searchProd}
                  onChange={(e) => setSearchProd(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && searchResults.length > 0) { e.preventDefault(); addProductItem(searchResults[0]) } }}
                  placeholder={`${t('restaurant.searchProduct')} ${touchMode ? '(F2)' : ''}`}
                  className={`w-full pl-10 pr-4 border border-gray-200 rounded-lg bg-white ${touchMode ? 'py-3 text-base' : 'py-2 text-sm'}`} />
                {searchResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {searchResults.map((p) => (
                      <button key={p.id} onClick={() => addProductItem(p)} className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                        <span>{p.nombre}</span><span className="text-gray-400">{formatCurrency(p.precio_venta)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('restaurant.addCustomItem')}</label>
                  <input value={customItem.descripcion} onChange={(e) => setCustomItem({ ...customItem, descripcion: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="w-24">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('restaurant.quantity')}</label>
                  <input type="number" min={1} value={customItem.cantidad} onChange={(e) => setCustomItem({ ...customItem, cantidad: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                </div>
                <div className="w-28">
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('restaurant.price')}</label>
                  <input type="number" step="0.01" min={0} value={customItem.precio} onChange={(e) => setCustomItem({ ...customItem, precio: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
                </div>
                <button onClick={addCustomItem} disabled={!customItem.descripcion.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-1">
                  <PlusCircle className="w-4 h-4" /> {t('restaurant.addItem')}
                </button>
              </div>
            </div>

            {/* Items */}
            {comanda.detalles.length === 0 ? (
              <p className="text-center py-8 text-gray-400 text-sm">{t('restaurant.noItems')}</p>
            ) : (
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t('restaurant.comanda')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">{t('restaurant.quantity')}</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 w-24">{t('restaurant.subtotal')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-28">{t('restaurant.title')}</th>
                      <th className="w-24"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {comanda.detalles.map((item) => (
                      <tr key={item.id} className="bg-white">
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.descripcion}</p>
                          {item.notas && <p className="text-xs text-gray-400">{item.notas}</p>}
                        </td>
                        <td className="px-3 py-2 text-center">
                          <div className="inline-flex items-center gap-1">
                            <button onClick={() => updateCantidad(item, item.cantidad - 1)} disabled={item.cantidad <= 1}
                              className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><Minus className="w-3 h-3" /></button>
                            <span className="w-8 text-center">{item.cantidad}</span>
                            <button onClick={() => updateCantidad(item, item.cantidad + 1)}
                              className="p-1 hover:bg-gray-100 rounded"><Plus className="w-3 h-3" /></button>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${ITEM_ESTADO_STYLES[item.estado] || ''}`}>
                            {t(`restaurant.item${item.estado === 'pendiente' ? 'Pending' : item.estado === 'en_preparacion' ? 'Preparing' : item.estado === 'listo' ? 'Ready' : item.estado === 'servido' ? 'Served' : 'Cancelled'}`)}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex justify-end gap-1">
                            {item.estado === 'listo' && (
                              <button onClick={() => markItem(item, 'servido')} className="p-1.5 hover:bg-green-50 rounded-lg" title={t('restaurant.markServed')}>
                                <CheckCircle className="w-4 h-4 text-green-600" />
                              </button>
                            )}
                            {item.estado !== 'servido' && item.estado !== 'cancelado' && (
                              <button onClick={() => removeItem(item)} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('restaurant.deleteTable')}>
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-gray-100">
              <button onClick={openCheckout} disabled={comanda.detalles.length === 0}
                className={`px-6 font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center gap-2 ${touchMode ? 'py-4 text-lg' : 'py-2.5 text-sm'}`}>
                <Banknote className="w-5 h-5" /> {t('restaurant.chargeTable')} — {formatCurrency(totalCobrar)} <span className="text-xs opacity-70 hidden md:inline">F5</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal Checkout */}
      <Modal open={checkoutOpen} onClose={() => setCheckoutOpen(false)} title={t('restaurant.checkoutTitle')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('restaurant.checkoutMsg')}</p>
          <div className="bg-gray-50 rounded-xl p-4 text-sm flex justify-between font-semibold">
            <span>{t('restaurant.totalToCharge')}</span><span>{formatCurrency(totalCobrar)}</span>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.paymentMethod')} *</label>
            <select value={checkoutForm.metodo_pago} onChange={(e) => setCheckoutForm({ ...checkoutForm, metodo_pago: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              {metodosPagoActivos.length > 0
                ? metodosPagoActivos.map((m) => (
                    <option key={m.clave} value={m.clave}>{m.nombre}</option>
                  ))
                : (
                  <>
                    <option value="efectivo">{t('pos.cash')}</option>
                    <option value="transferencia">{t('pos.transfer')}</option>
                    <option value="pago_movil">{t('pos.mobile')}</option>
                    <option value="mixto">{t('pos.mixed')}</option>
                    <option value="fiado">{t('caja.fiadoMethod')}</option>
                  </>
                )}
            </select>
          </div>
          {checkoutForm.metodo_pago === 'fiado' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('restaurant.deudorName')} *</label>
              <input value={checkoutForm.deudor_nombre} onChange={(e) => setCheckoutForm({ ...checkoutForm, deudor_nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('restaurant.deudorPlaceholder')} />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.amountReceived')}</label>
            <input type="number" step="0.01" min="0" value={checkoutForm.monto_pagado}
              onChange={(e) => setCheckoutForm({ ...checkoutForm, monto_pagado: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <p className="text-xs text-gray-400 mt-1">{t('pos.change')}: {formatCurrency(Math.max(0, (Number(checkoutForm.monto_pagado) || 0) - totalCobrar))}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setCheckoutOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">{t('quotes.cancel')}</button>
            <button onClick={doCheckout} disabled={checkingOut || (checkoutForm.metodo_pago === 'fiado' && !checkoutForm.deudor_nombre.trim())}
              className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300">
              {checkingOut ? t('restaurant.saving') : t('restaurant.charge')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteTable} onClose={() => setDeleteTable(null)}
        onConfirm={() => { if (deleteTable) removeTable(deleteTable) }}
        title={t('restaurant.deleteTable')} message={t('restaurant.deleteTableMsg')}
        confirmText={t('restaurant.deleteTable')} danger />
    </div>
  )
}