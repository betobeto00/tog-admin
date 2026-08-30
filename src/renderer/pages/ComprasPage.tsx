import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth.store'
import {
  Plus, Search, Trash2, Truck, Package, Calendar, Eye, ScanBarcode
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDateTime } from '../lib/utils'
import { useToast } from '../components/ui/Toast'

interface Producto {
  id: number; nombre: string; precio_compra: number; stock: number; unidad: string
}
interface Proveedor { id: number; nombre: string }
interface CompraItem {
  producto_id: number; nombre: string; cantidad: number; costo_unitario: number; subtotal: number
}
interface CompraRecord {
  id: number; numero_compra: number; fecha: string; proveedor_nombre: string | null
  usuario_nombre: string; subtotal: number; impuesto: number; total: number
  metodo_pago: string; notas: string | null; estado: string
}

export default function ComprasPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const [compras, setCompras] = useState<CompraRecord[]>([])
  const [productos, setProductos] = useState<Producto[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)

  // Nueva compra
  const [nuevaOpen, setNuevaOpen] = useState(false)
  const [proveedorId, setProveedorId] = useState<number>(0)
  const [items, setItems] = useState<CompraItem[]>([])
  const [searchProd, setSearchProd] = useState('')
  const [metodoPago, setMetodoPago] = useState('efectivo')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  // Escáner de código de barras
  const [scannerActive, setScannerActive] = useState(false)
  const scannerBufferRef = useRef('')
  const scannerTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const toast = useToast()

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0])

  useEffect(() => { loadData() }, [fechaInicio, fechaFin])

  // Handler de escaneo de código de barras
  const handleBarcodeScan = useCallback((barcode: string) => {
    if (!nuevaOpen) return
    const producto = productos.find((p) =>
      p.codigo_barras === barcode || p.sku === barcode
    )
    if (producto) {
      addItem(producto)
      toast.success(`${producto.nombre} - ${i18n.language === 'en' ? 'added' : 'agregado'}`)
    } else {
      toast.warning(`${i18n.language === 'en' ? 'Product not found' : 'Producto no encontrado'}: ${barcode}`)
    }
  }, [nuevaOpen, productos, addItem, toast, i18n.language])

  // Hook global de escaneo
  useEffect(() => {
    if (!scannerActive || !nuevaOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return

      if (scannerTimeoutRef.current) {
        clearTimeout(scannerTimeoutRef.current)
        scannerTimeoutRef.current = null
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const barcode = scannerBufferRef.current.trim()
        scannerBufferRef.current = ''
        if (barcode.length > 0) handleBarcodeScan(barcode)
        return
      }

      if (e.key === 'Backspace') {
        scannerBufferRef.current = scannerBufferRef.current.slice(0, -1)
        return
      }

      if (e.key.length > 1 && !e.key.startsWith('F')) return
      scannerBufferRef.current += e.key

      scannerTimeoutRef.current = setTimeout(() => {
        scannerBufferRef.current = ''
        scannerTimeoutRef.current = null
      }, 50)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (scannerTimeoutRef.current) clearTimeout(scannerTimeoutRef.current)
    }
  }, [scannerActive, nuevaOpen, handleBarcodeScan])

  const loadData = async () => {
    setLoading(true)
    const [comprasData, prods, provs] = await Promise.all([
      window.api.compras.list({ fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
      window.api.productos.list(),
      window.api.proveedores.list(),
    ])
    setCompras(comprasData)
    setProductos(prods)
    setProveedores(provs)
    setLoading(false)
  }

  // Buscar producto
  const prodsFiltrados = searchProd.trim()
    ? productos.filter((p) => p.nombre.toLowerCase().includes(searchProd.toLowerCase())).slice(0, 10)
    : []

  const addItem = (producto: Producto) => {
    const existente = items.find((i) => i.producto_id === producto.id)
    if (existente) {
      setItems(items.map((i) => i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1, subtotal: (i.cantidad + 1) * i.costo_unitario } : i))
    } else {
      setItems([...items, {
        producto_id: producto.id, nombre: producto.nombre,
        cantidad: 1, costo_unitario: producto.precio_compra || 0,
        subtotal: producto.precio_compra || 0,
      }])
    }
    setSearchProd('')
  }

  const updateItem = (idx: number, field: string, value: number) => {
    setItems(items.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: value }
      updated.subtotal = updated.cantidad * updated.costo_unitario
      return updated
    }))
  }

  const removeItem = (idx: number) => setItems(items.filter((_, i) => i !== idx))

  const subtotal = items.reduce((acc, i) => acc + i.subtotal, 0)
  const [taxRate, setTaxRate] = useState(0)
  useEffect(() => {
    window.api.config.get().then((cfg: any[]) => {
      const rate = cfg.find((c: any) => c.clave === 'sales_tax_rate')
      if (rate) setTaxRate(parseFloat(rate.valor) / 100)
    })
  }, [])
  const impuesto = subtotal * taxRate
  const total = subtotal + impuesto

  const saveCompra = async () => {
    if (items.length === 0 || saving) return
    setSaving(true)
    try {
      await window.api.compras.create({
        proveedor_id: proveedorId || undefined,
        usuario_id: usuario!.id,
        subtotal, impuesto, total,
        metodo_pago: metodoPago,
        notas: notas || undefined,
        detalles: items.map((i) => ({
          producto_id: i.producto_id,
          cantidad: i.cantidad,
          costo_unitario: i.costo_unitario,
          subtotal: i.subtotal,
        })),
      })
      setNuevaOpen(false)
      setItems([]); setProveedorId(0); setNotas(''); setSearchProd('')
      await loadData()
    } finally { setSaving(false) }
  }

  const metodoLabel: Record<string, string> = { efectivo: '💵 ' + t('compras.cash'), transferencia: '🏦 ' + t('compras.transfer'), pago_movil: '📱 ' + t('compras.mobile') }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('compras.title')}</h1>
          <p className="text-sm text-gray-500">{t('caja.purchasesInPeriod', { count: compras.length })}</p>
        </div>
        <button onClick={() => { setItems([]); setNuevaOpen(true) }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('compras.newPurchase')}
        </button>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('caja.from')}</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('caja.to')}</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.purchase')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.date')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.supplier')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('ventas.cashier')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.method')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.total')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : compras.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-gray-400">
                <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" /><p>{t('compras.noPurchases')}</p></td></tr>
            ) : compras.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm font-mono font-medium">#{String(c.numero_compra).padStart(6, '0')}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{formatDateTime(c.fecha)}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.proveedor_nombre || '—'}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{c.usuario_nombre}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{metodoLabel[c.metodo_pago] || c.metodo_pago}</td>
                <td className="px-4 py-3 text-sm font-bold text-right">{formatCurrency(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal Nueva Compra */}
      <Modal open={nuevaOpen} onClose={() => { setNuevaOpen(false); setScannerActive(false) }} title={t('compras.newPurchase')} wide>
        <div className="space-y-4">
          {/* Proveedor + Método */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('compras.supplier')}</label>
              <select value={proveedorId} onChange={(e) => setProveedorId(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value={0}>{t('compras.noSupplier')}</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('compras.paymentMethod')}</label>
              <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="efectivo">{t('compras.cash')}</option>
                <option value="transferencia">{t('compras.transfer')}</option>
                <option value="pago_movil">{t('compras.mobile')}</option>
              </select>
            </div>
          </div>

          {/* Escáner + Buscar producto */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">{t('compras.addProduct')}</label>
              <button
                type="button"
                onClick={() => setScannerActive(!scannerActive)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                  scannerActive
                    ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                }`}
              >
                <ScanBarcode className="w-4 h-4" />
                {scannerActive
                  ? (i18n.language === 'en' ? 'Scanner ON' : 'Escáner ACTIVO')
                  : (i18n.language === 'en' ? 'Scanner OFF' : 'Escáner INACTIVO')
                }
              </button>
            </div>
            {scannerActive && (
              <div className="flex items-center gap-2 mb-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-xs text-green-700 font-medium">
                  {i18n.language === 'en'
                    ? 'Ready to scan — scan a barcode to add product'
                    : 'Listo para escanear — escanea un código para agregar el producto'
                  }
                </span>
              </div>
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchProd} onChange={(e) => setSearchProd(e.target.value)}
                placeholder={t('compras.searchProduct')}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            {prodsFiltrados.length > 0 && (
              <div className="mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {prodsFiltrados.map((p) => (
                  <button key={p.id} onClick={() => addItem(p)}
                    className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                    <span>{p.nombre}</span>
                    <span className="text-gray-400">Stock: {p.stock}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Items */}
          {items.length > 0 && (
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t('inventario.productName')}</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-24">{t('common.quantity')}</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-28">{t('compras.unitCost')}</th>
                    <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500 w-28">{t('common.subtotal')}</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {items.map((item, idx) => (
                    <tr key={item.producto_id} className="bg-white">
                      <td className="px-3 py-2 font-medium">{item.nombre}</td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" min="1" value={item.cantidad}
                          onChange={(e) => updateItem(idx, 'cantidad', Number(e.target.value))}
                          className="w-16 text-center border border-gray-200 rounded px-1 py-1 text-sm" />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <input type="number" step="0.01" min="0" value={item.costo_unitario}
                          onChange={(e) => updateItem(idx, 'costo_unitario', Number(e.target.value))}
                          className="w-20 text-center border border-gray-200 rounded px-1 py-1 text-sm" />
                      </td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.subtotal)}</td>
                      <td className="px-3 py-2 text-center">
                        <button onClick={() => removeItem(idx)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Totales */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
            <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">Sales Tax ({(taxRate * 100).toFixed(1)}%)</span><span>{formatCurrency(impuesto)}</span></div>
            <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200"><span>Total</span><span>{formatCurrency(total)}</span></div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
            <input type="text" value={notas} onChange={(e) => setNotas(e.target.value)}
              placeholder={t('compras.optionalNote')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setNuevaOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('compras.cancel')}</button>
            <button onClick={saveCompra} disabled={saving || items.length === 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('compras.saving') : t('compras.register')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
