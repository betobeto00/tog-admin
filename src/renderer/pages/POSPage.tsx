import { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@core/auth/store'
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X,
  DollarSign, CreditCard, Smartphone, Check, Printer,
  Package, AlertTriangle, ScanBarcode, Wallet, Banknote, Globe
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import CartItem from '../components/pos/CartItem'
import { formatCurrency, formatTicketNumber } from '../lib/utils'
import { useToast } from '../components/ui/Toast'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { callApi } from '../lib/api-client'

interface Producto {
  id: number; nombre: string; codigo_barras: string | null
  precio_venta: number; stock: number; unidad: string
  categoria_nombre: string | null
}

interface CartItem {
  producto_id: number; nombre: string; precio_unitario: number
  cantidad: number; stock: number; unidad: string
  descuento: number  // descuento por item (0-100 %)
}

interface MetodoPagoDB {
  id: number
  clave: string
  nombre: string
  icono: string
  requiere_terminal: number
  activo: number
}

const ICON_MAP: Record<string, any> = {
  DollarSign, CreditCard, Smartphone, Wallet, Banknote, Globe,
}

export default function POSPage() {
  const { t } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const toast = useToast()
  const [productos, setProductos] = useState<Producto[]>([])
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [focusSearch, setFocusSearch] = useState(true)
  const searchRef = useRef<HTMLInputElement>(null)
  const [cajaAbierta, setCajaAbierta] = useState<any>(null)
  const [cajaLoading, setCajaLoading] = useState(true)

  // Escaneo de codigo de barras
  const [scannerEnabled, setScannerEnabled] = useState(true)

  // Descuento global
  const [descuentoGlobal, setDescuentoGlobal] = useState(0)  // % global

  // Cobro
  const [cobrarOpen, setCobrarOpen] = useState(false)
  const [metodosPago, setMetodosPago] = useState<MetodoPagoDB[]>([])
  const [metodoPago, setMetodoPago] = useState<string>('efectivo')
  const [montoPagado, setMontoPagado] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [esperandoTarjeta, setEsperandoTarjeta] = useState(false)

  // Ticket
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ultimoTicket, setUltimoTicket] = useState<any>(null)

  useEffect(() => {
    loadProducts()
    checkCaja()
  }, [])

  const checkCaja = async () => {
    try {
      const caja = await callApi('caja:status')
      setCajaAbierta(caja)
    } catch { setCajaAbierta(null) }
    finally { setCajaLoading(false) }
  }

  // Auto-focus en búsqueda
  useEffect(() => {
    if (focusSearch && searchRef.current) {
      searchRef.current.focus()
    }
  }, [focusSearch])

  const loadProducts = async () => {
    const prods = await callApi<Producto[]>('productos:list')
    setProductos(prods.filter((p: Producto) => p.stock > 0 || p.unidad === 'servicio'))
  }

  const loadMetodosPago = async () => {
    try {
      const metodos = await callApi<MetodoPagoDB[]>('metodos-pago:list', { activoOnly: true })
      setMetodosPago(metodos || [])
      if (metodos && metodos.length > 0 && !metodos.find((m: any) => m.clave === metodoPago)) {
        setMetodoPago(metodos[0].clave)
      }
    } catch (err) {
      console.error('Error cargando métodos de pago:', err)
    }
  }

  useEffect(() => {
    loadProducts()
    loadMetodosPago()
  }, [])

  // Handler para escaneo de codigo de barras
  const handleBarcodeScan = async (barcode: string) => {
    try {
      const producto = await callApi<Producto | null>('productos:buscar-por-codigo', { codigo: barcode })
      if (producto && (producto.stock > 0 || producto.unidad === 'servicio')) {
        addToCart(producto)
        toast.success(`${producto.nombre} - ${formatCurrency(producto.precio_venta)}`)
      } else if (producto) {
        toast.warning(t('pos.productOutOfStock', { name: producto.nombre }))
      } else {
        toast.warning(t('pos.productNotFound'))
        setSearch(barcode)
        setFocusSearch(true)
      }
    } catch (err) {
      console.error('Error escaneando codigo:', err)
      toast.error(t('errors.barcodeScanError'))
    }
  }

  // Venta rápida sin producto (servicio por cobrar)
  const [quickSaleOpen, setQuickSaleOpen] = useState(false)
  const [quickSaleDesc, setQuickSaleDesc] = useState('')
  const [quickSaleMonto, setQuickSaleMonto] = useState('')

  // Hook de escaneo de codigos de barras
  useBarcodeScanner({
    onScan: handleBarcodeScan,
    timeout: 50,
    enabled: scannerEnabled && !cobrarOpen && !ticketOpen && !quickSaleOpen,
  })

  // Filtrado de productos
  const filtered = useMemo(() => {
    if (!search.trim()) return []
    const term = search.toLowerCase()
    return productos.filter((p) =>
      p.nombre.toLowerCase().includes(term) ||
      p.codigo_barras?.toLowerCase().includes(term)
    ).slice(0, 20)
  }, [search, productos])

  // Totales
  const subtotalBruto = cart.reduce((acc, item) => acc + item.precio_unitario * item.cantidad, 0)
  const descuentoItems = cart.reduce((acc, item) => acc + (item.precio_unitario * item.cantidad * item.descuento / 100), 0)
  const subtotal = subtotalBruto - descuentoItems
  const descuentoGlobalMonto = subtotal * descuentoGlobal / 100
  const subtotalConGlobal = subtotal - descuentoGlobalMonto
  const [taxRate, setTaxRate] = useState(0)
  useEffect(() => {
    callApi<any[]>('config:get').then((cfg: any[]) => {
      const rate = cfg.find((c: any) => c.clave === 'sales_tax_rate')
      if (rate && rate.valor) {
        const parsed = parseFloat(rate.valor)
        if (!isNaN(parsed)) setTaxRate(parsed / 100)
      }
    })
  }, [])
  const impuesto = subtotalConGlobal * taxRate
  const total = subtotalConGlobal + impuesto
  const cambio = metodoPago === 'efectivo' && montoPagado
    ? Math.max(0, parseFloat(montoPagado) - total)
    : 0

  // ======== CARRITO ========

  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === producto.id)
      if (existing) {
        if (existing.cantidad >= existing.stock && existing.unidad !== 'servicio') return prev
        return prev.map((i) =>
          i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i
        )
      }
      return [...prev, {
        producto_id: producto.id,
        nombre: producto.nombre,
        precio_unitario: producto.precio_venta,
        cantidad: 1,
        stock: producto.stock,
        unidad: producto.unidad,
        descuento: 0,
      }]
    })
    setSearch('')
    setFocusSearch(true)
  }

  const updateQuantity = (productoId: number, delta: number) => {
    setCart((prev) => prev.map((i) => {
      if (i.producto_id !== productoId) return i
      const newQty = i.cantidad + delta
      if (newQty <= 0) return i
      if (newQty > i.stock && i.unidad !== 'servicio') return i
      return { ...i, cantidad: newQty }
    }))
  }

  const updateItemDiscount = (productoId: number, descuento: number) => {
    setCart((prev) => prev.map((i) =>
      i.producto_id === productoId ? { ...i, descuento: Math.min(100, Math.max(0, descuento)) } : i
    ))
  }

  const updateItemPrice = (productoId: number, price: number) => {
    setCart((prev) => prev.map((i) =>
      i.producto_id === productoId ? { ...i, precio_unitario: price } : i
    ))
  }

  const removeFromCart = (productoId: number) => {
    setCart((prev) => prev.filter((i) => i.producto_id !== productoId))
  }

  const clearCart = () => setCart([])



  const addQuickSale = () => {
    if (!quickSaleDesc.trim() || !quickSaleMonto || parseFloat(quickSaleMonto) <= 0) return
    const id = Date.now() // ID temporal para servicio
    setCart((prev) => [...prev, {
      producto_id: id,
      nombre: quickSaleDesc,
      precio_unitario: parseFloat(quickSaleMonto),
      cantidad: 1,
      stock: 9999,
      unidad: 'servicio',
      descuento: 0,
    }])
    setQuickSaleOpen(false)
    setQuickSaleDesc('')
    setQuickSaleMonto('')
  }

  // ======== COBRO ========

  const openCobro = () => {
    if (cart.length === 0) return
    setMetodoPago('efectivo')
    setMontoPagado(String(Math.ceil(total)))
    setCobrarOpen(true)
  }

  const procesarVenta = async () => {
    if (procesando) return
    setProcesando(true)

    try {
      // Si el método requiere terminal (ej. tarjeta/VP800), procesar primero
      const metodo = metodosPago.find((m) => m.clave === metodoPago)
      let datosTarjeta: any = null
      if (metodo?.requiere_terminal) {
        setEsperandoTarjeta(true)
        const resp = await callApi<{ success: boolean; authCode?: string; refNum?: string; cardType?: string; maskedPan?: string; responseText?: string; error?: string }>('metodos-pago:procesar-tarjeta', { monto: total })
        setEsperandoTarjeta(false)
        if (!resp.success) {
          toast.error(resp.error || 'Error procesando pago con tarjeta')
          setProcesando(false)
          return
        }
        datosTarjeta = resp
        toast.success(`Pago aprobado${resp.maskedPan ? ` •••• ${resp.maskedPan}` : ''}`)
      }

      const result = await callApi<{ success: boolean; id?: number; numero_venta?: number; error?: string }>('ventas:create', {
        usuario_id: usuario!.id,
        subtotal: subtotalConGlobal,
        impuesto,
        descuento: descuentoItems + descuentoGlobalMonto,
        total,
        metodo_pago: metodoPago,
        monto_pagado: metodoPago === 'efectivo' ? parseFloat(montoPagado) : total,
        cambio: metodoPago === 'efectivo' ? cambio : 0,
        detalles: cart.map((item) => {
          const itemDiscount = item.precio_unitario * item.cantidad * item.descuento / 100
          return {
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio_unitario: item.precio_unitario,
            descuento: itemDiscount,
            subtotal: item.precio_unitario * item.cantidad - itemDiscount,
          }
        }),
      })

      if (result && !result.success && result.error) {
        toast.error(result.error)
        setProcesando(false)
        return
      }

      setUltimoTicket({ ...result, items: [...cart], total, metodo_pago: metodoPago, datosTarjeta })
      setCobrarOpen(false)
      setTicketOpen(true)
      setCart([])
      setMontoPagado('')
      await loadProducts()
    } catch (err) {
      console.error('Error procesando venta:', err)
      toast.error(t('errors.processSaleError'))
    } finally {
      setProcesando(false)
      setEsperandoTarjeta(false)
    }
  }

  // Atajos de teclado
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault()
        setFocusSearch(true)
      }
      if (e.key === 'F5') {
        e.preventDefault()
        openCobro()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [cart, total])

  // Bloquear POS si no hay caja abierta
  if (!cajaLoading && !cajaAbierta) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <div className="text-center bg-white rounded-2xl border border-gray-200 p-12 max-w-md">
          <AlertTriangle className="w-16 h-16 text-orange-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-900 mb-2">{t('pos.cashRegisterClosed')}</h2>
          <p className="text-gray-500 mb-6">
            {t('pos.cashRegisterClosedDesc')}
          </p>
          <button
            onClick={() => window.location.hash = '#/caja'}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl"
          >
            {t('pos.goToCash')}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      {/* Columna izquierda: Búsqueda + Productos */}
      <div className="flex-1 flex flex-col">
        {/* Búsqueda + Scanner status */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setScannerEnabled(!scannerEnabled)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                scannerEnabled
                  ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
              }`}
              title={scannerEnabled ? t('pos.scannerEnabled') : t('pos.scannerDisabled')}
            >
              <ScanBarcode className="w-4 h-4" />
              {scannerEnabled
                ? (t('pos.scannerActive') || 'Escáner activo')
                : (t('pos.scannerInactive') || 'Escáner inactivo')
              }
            </button>
            {scannerEnabled && (
              <span className="text-xs text-green-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                {t('pos.scannerReady') || 'Listo para escanear'}
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('pos.searchPlaceholder')}
              className="w-full pl-11 pr-4 py-3 border border-gray-200 rounded-xl text-base bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            {search && (
              <button onClick={() => { setSearch(''); setFocusSearch(true) }}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>

        {/* Resultados de búsqueda */}
        {search.trim() && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4 max-h-64 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">{t('pos.noProductsFound')}</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {filtered.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      <p className="text-xs text-gray-400">
                        {p.categoria_nombre || t('pos.noCategory')} • Stock: {p.stock} {p.unidad}
                      </p>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{formatCurrency(p.precio_venta)}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Productos destacados (cuando no hay búsqueda) */}
        {!search.trim() && (
          <div className="flex-1 flex items-center justify-center text-gray-300">
            <div className="text-center">
              <ShoppingCart className="w-16 h-16 mx-auto mb-3" />
              <p className="text-lg font-medium">{t('pos.searchPrompt')}</p>
              <p className="text-sm mt-1">{t('pos.searchHint')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Columna derecha: Carrito */}
      <div className="w-96 bg-white rounded-xl border border-gray-200 flex flex-col">
        {/* Header carrito */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">{t('pos.cart')}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {t('pos.itemCount', { count: cart.length, plural: cart.length === 1 ? 'item' : 'items' })}
            </span>
          </div>
          {cart.length > 0 && (
            <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">
              {t('pos.clearCart')}
            </button>
          )}
        </div>

        {/* Items del carrito */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-gray-300">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2" />
              <p className="text-sm">{t('pos.emptyCartShort')}</p>
            </div>
          ) : (
            cart.map((item) => (
              <CartItem
                key={item.producto_id}
                item={item}
                onUpdateQuantity={updateQuantity}
                onUpdateDiscount={updateItemDiscount}
                onUpdatePrice={updateItemPrice}
                onRemove={removeFromCart}
              />
            ))
          )}
        </div>

        {/* Totales + Botón cobrar */}
        <div className="border-t border-gray-200 p-4 space-y-3">
          <div className="space-y-1.5 text-sm">
            <div className="flex justify-between text-gray-600">                <span>{t('common.subtotal')}</span>
              <span>{formatCurrency(subtotalBruto)}</span>
            </div>
            {descuentoItems > 0 && (
              <div className="flex justify-between text-red-500">
                <span>{t('pos.itemDiscountShort')}</span>
                <span>-{formatCurrency(descuentoItems)}</span>
              </div>
            )}
            {/* Descuento global */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1">
                <span className="text-gray-600">{t('pos.globalDiscountShort')}</span>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={descuentoGlobal}
                  onChange={(e) => setDescuentoGlobal(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="w-14 text-center text-xs border border-gray-200 rounded px-1 py-0.5"
                />
                <span className="text-xs text-gray-400">%</span>
              </div>
              {descuentoGlobalMonto > 0 && (
                <span className="text-red-500">-{formatCurrency(descuentoGlobalMonto)}</span>
              )}
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('pos.netSubtotal')}</span>
              <span>{formatCurrency(subtotalConGlobal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('common.tax')} ({(taxRate * 100).toFixed(1)}%)</span>
              <span>{formatCurrency(impuesto)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>{t('common.total')}</span>
              <span>{formatCurrency(total)}</span>
            </div>
          </div>

          <button
            onClick={() => setQuickSaleOpen(true)}
            className="w-full py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-xl transition-colors flex items-center justify-center gap-2 border border-blue-200"
          >
            <Plus className="w-4 h-4" /> {t('pos.quickSaleService')}
          </button>
          <button
            onClick={openCobro}
            disabled={cart.length === 0}
            className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-200 disabled:text-gray-400
              text-white font-semibold rounded-xl text-base transition-colors flex items-center justify-center gap-2"
          >
            <DollarSign className="w-5 h-5" />
            {t('pos.checkoutShortcut')}
          </button>
        </div>
      </div>

      {/* ======== MODAL DE COBRO ======== */}
      <Modal open={cobrarOpen} onClose={() => !procesando && setCobrarOpen(false)} title={t('pos.processPayment')}>
        <div className="space-y-5">
          {/* Total a pagar */}
          <div className="text-center py-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">{t('pos.totalToPay')}</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(total)}</p>
          </div>

          {/* Métodos de pago */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('pos.paymentMethodLabel')}</label>
            <div className="grid grid-cols-2 gap-2">
              {metodosPago.length === 0 ? (
                <p className="col-span-2 text-sm text-gray-400 text-center py-2">
                  {t('config.noPaymentMethods') || 'Sin métodos de pago configurados'}
                </p>
              ) : Array.isArray(metodosPago) && metodosPago.map((m) => {
                const Icon = ICON_MAP[m.icono] || DollarSign
                return (
                  <button
                    key={m.id}
                    onClick={() => setMetodoPago(m.clave)}
                    className={`flex items-center gap-2 p-3 rounded-xl border-2 text-sm font-medium transition-colors ${
                      metodoPago === m.clave
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" /> {m.nombre}
                  </button>
                )
              })}
            </div>
            {metodosPago.find((m) => m.clave === metodoPago)?.requiere_terminal && esperandoTarjeta && (
              <p className="text-xs text-blue-600 mt-2 text-center animate-pulse">
                ⏳ {t('pos.waitingForCard') || 'Esperando tarjeta en VP800...'}
              </p>
            )}
          </div>

          {/* Monto pagado (solo efectivo) */}
          {metodoPago === 'efectivo' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.amountReceived')}</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={montoPagado}
                onChange={(e) => setMontoPagado(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
                autoFocus
              />
              {parseFloat(montoPagado) >= total && (
                <div className="mt-3 text-center p-3 bg-green-50 rounded-xl">
                  <p className="text-sm text-green-600">{t('pos.change')}</p>
                  <p className="text-2xl font-bold text-green-700">{formatCurrency(cambio)}</p>
                </div>
              )}
              {parseFloat(montoPagado) > 0 && parseFloat(montoPagado) < total && (
                <div className="mt-2 text-center text-sm text-red-500">
                  {t('pos.missing')} {formatCurrency(total - parseFloat(montoPagado))}
                </div>
              )}
            </div>
          )}

          {/* Resumen */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">{t('inventario.items') || 'Items'}</span><span>{cart.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('common.subtotal')}</span><span>{formatCurrency(subtotalBruto)}</span></div>
            {(descuentoItems + descuentoGlobalMonto) > 0 && (
              <div className="flex justify-between text-red-500"><span>{t('common.discount')}</span><span>-{formatCurrency(descuentoItems + descuentoGlobalMonto)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">{t('common.tax')}</span><span>{formatCurrency(impuesto)}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t border-gray-200"><span>{t('common.total')}</span><span>{formatCurrency(total)}</span></div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button onClick={() => setCobrarOpen(false)} disabled={procesando}
              className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button
              onClick={procesarVenta}
              disabled={procesando || (metodoPago === 'efectivo' && parseFloat(montoPagado) < total)}
              className="flex-1 py-3 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 disabled:bg-gray-300 flex items-center justify-center gap-2"
            >
              {procesando ? (
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <><Check className="w-5 h-5" /> {t('pos.confirmPayment')}</>
              )}
            </button>
          </div>
        </div>
      </Modal>

      {/* ======== MODAL TICKET ======== */}
      <Modal open={ticketOpen} onClose={() => setTicketOpen(false)} title={t('pos.saleRegistered')}>
        {ultimoTicket && (
          <div className="space-y-4">
            <div className="text-center py-4 bg-green-50 rounded-xl">
              <Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
              <p className="text-lg font-bold text-green-700">{t('pos.paymentProcessed')}</p>
              <p className="text-sm text-green-600 mt-1">
                Ticket {formatTicketNumber(ultimoTicket.numero_venta)}
              </p>
            </div>

            {/* Preview del ticket */}
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 font-mono text-xs space-y-1">
              <div className="text-center mb-3">
                <p className="font-bold text-sm">TOG Admin</p>
                <p className="text-gray-400">{t('ventas.ticket')} {formatTicketNumber(ultimoTicket.numero_venta)}</p>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2">
                {ultimoTicket.items?.map((item: any, i: number) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.nombre} x{item.cantidad}</span>
                    <span>{formatCurrency(item.precio_unitario * item.cantidad)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between"><span>{t('common.subtotal')}:</span><span>{formatCurrency(subtotalBruto)}</span></div>
                {(descuentoItems + descuentoGlobalMonto) > 0 && (
                  <div className="flex justify-between text-red-500"><span>{t('common.discount')}:</span><span>-{formatCurrency(descuentoItems + descuentoGlobalMonto)}</span></div>
                )}
                <div className="flex justify-between"><span>{t('common.tax')}:</span><span>{formatCurrency(impuesto)}</span></div>
                <div className="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>{formatCurrency(ultimoTicket.total)}</span></div>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2">
                <p>Pago: {ultimoTicket.metodo_pago}</p>
              </div>
              <div className="text-center pt-3 text-gray-400">
                <p>{t('pos.thankYou')}</p>
              </div>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setTicketOpen(false)}
                className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
                {t('pos.closeButton')}
              </button>
              <button onClick={() => { window.print(); setTicketOpen(false) }}
                className="flex-1 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 flex items-center justify-center gap-2">
                <Printer className="w-4 h-4" /> {t('pos.printButton')}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======== MODAL VENTA RÁPIDA ======== */}
      <Modal open={quickSaleOpen} onClose={() => setQuickSaleOpen(false)} title={t('pos.quickSaleService')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">
            {t('pos.quickSaleDescription')}
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.addDescription')}</label>
            <input type="text" value={quickSaleDesc}
              onChange={(e) => setQuickSaleDesc(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={t('pos.addDescriptionPlaceholder')} autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.addAmount')}</label>
            <input type="number" step="0.01" min="0.01" value={quickSaleMonto}
              onChange={(e) => setQuickSaleMonto(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
              placeholder="0.00" />
          </div>
          <div className="flex gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setQuickSaleOpen(false)}
              className="flex-1 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button onClick={addQuickSale}
              disabled={!quickSaleDesc.trim() || !quickSaleMonto || parseFloat(quickSaleMonto) <= 0}
              className="flex-1 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-700 disabled:bg-blue-300">
              {t('pos.addToCartButton')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
