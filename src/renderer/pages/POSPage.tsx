import { useEffect, useState, useRef, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@core/auth/store'
import {
  Search, ShoppingCart, Plus, Minus, Trash2, X,
  DollarSign, CreditCard, Smartphone, Check, Printer,
  Package, AlertTriangle, ScanBarcode, Wallet, Banknote, Globe, HandCoins
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import CartItem from '../components/pos/CartItem'
import ProductImage from '../components/ProductImage'
import { formatTicketNumber } from '../lib/utils'
import { formatMoney } from '../services/currency'
import { useToast } from '../components/ui/Toast'
import { useBarcodeScanner } from '../hooks/useBarcodeScanner'
import { callApi } from '../lib/api-client'
import type { Producto } from '@shared/types'

interface CartItem {
  producto_id: number; nombre: string; precio_unitario: number
  cantidad: number; stock: number; unidad: string; tipo: 'producto' | 'servicio'
  esVentaRapida?: boolean
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

interface Cliente {
  id: number
  nombre: string
  documento: string | null
  telefono: string | null
  limite_credito: number | null
}

const ICON_MAP: Record<string, any> = {
  DollarSign, CreditCard, Smartphone, Wallet, Banknote, Globe, HandCoins,
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

  // Fiado / crédito
  const [clientesFiado, setClientesFiado] = useState<Cliente[]>([])
  const [clienteFiadoId, setClienteFiadoId] = useState('')
  const [deudorNombre, setDeudorNombre] = useState('')
  const [deudorTelefono, setDeudorTelefono] = useState('')
  const [abonoInicial, setAbonoInicial] = useState('')

  // Cliente para factura (opcional, no solo fiado)
  const [clienteFacturaId, setClienteFacturaId] = useState<string>('')
  const [clienteFacturaQuery, setClienteFacturaQuery] = useState('')

  // Tipo de comprobante: 'factura' (default) o 'nota_entrega' (sin valor fiscal)
  const [tipoComprobante, setTipoComprobante] = useState<'factura' | 'nota_entrega'>('factura')

  // Borradores de venta (hold sale)
  const [borradorId, setBorradorId] = useState<number | null>(null)
  const [borradores, setBorradores] = useState<Array<{ id: number; cliente_nombre: string | null; item_count: number; total: number; actualizado_en: string; notas: string | null }>>([])
  const [borradoresOpen, setBorradoresOpen] = useState(false)

  // Ticket
  const [ticketOpen, setTicketOpen] = useState(false)
  const [ultimoTicket, setUltimoTicket] = useState<any>(null)

  useEffect(() => {
    loadProducts()
    checkCaja()
    callApi<Cliente[]>('clientes:list')
      .then((list) => setClientesFiado(list || []))
      .catch(() => setClientesFiado([]))
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
    setProductos(prods.filter((p: Producto) => p.tipo === 'servicio' || p.stock > 0))
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
      if (producto && (producto.tipo === 'servicio' || producto.stock > 0)) {
        addToCart(producto)
        toast.success(`${producto.nombre} - ${formatMoney(producto.precio_venta)}`)
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
  const esMetodoFiado = metodoPago === 'fiado'
  const abonoCobro = esMetodoFiado ? (parseFloat(abonoInicial) || 0) : 0
  const fiadoFaltaNombre = esMetodoFiado && !clienteFiadoId && !deudorNombre.trim()
  const clienteSelCobro = clientesFiado.find((c) => String(c.id) === clienteFiadoId)
  const nombreMetodo = (clave: string) => metodosPago.find((m) => m.clave === clave)?.nombre || clave

  // ======== CARRITO ========

  const addToCart = (producto: Producto) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.producto_id === producto.id)
      if (existing) {
        if (existing.cantidad >= existing.stock && existing.tipo !== 'servicio') return prev
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
        tipo: producto.tipo,
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
      if (newQty > i.stock && i.tipo !== 'servicio') return i
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

  const clearCart = () => {
    setCart([])
    setBorradorId(null)
    setClienteFacturaId('')
    setClienteFacturaQuery('')
    setTipoComprobante('factura')
  }

  // ======== BORRADORES (HOLD SALE) ========
  const loadBorradores = async () => {
    if (!usuario) return
    try {
      const list = await callApi<typeof borradores>('borradores:list', { usuario_id: usuario.id })
      setBorradores(Array.isArray(list) ? list : [])
    } catch {
      setBorradores([])
    }
  }

  const saveBorrador = async () => {
    if (!usuario) return
    if (cart.length === 0) {
      toast.warning(t('pos.draftEmpty') || 'El carrito está vacío')
      return
    }
    try {
      const clienteIdParaBorrador = clienteFacturaId ? Number(clienteFacturaId) : null
      const res = await callApi<{ success: boolean; id?: number; error?: string }>('borradores:save', {
        id: borradorId ?? undefined,
        usuario_id: usuario.id,
        items: cart,
        descuento_global: descuentoGlobal,
        cliente_id: clienteIdParaBorrador,
        notas: null,
      })
      if (res?.success && res.id) {
        setBorradorId(res.id)
        toast.success(borradorId ? (t('pos.draftUpdated') || 'Borrador actualizado') : (t('pos.draftSaved') || 'Venta guardada como borrador'))
        await loadBorradores()
      } else {
        toast.error(res?.error || t('errors.saveDraftError'))
      }
    } catch (err: any) {
      toast.error(err?.message || t('errors.saveDraftError'))
    }
  }

  const resumeBorrador = async (id: number) => {
    if (!usuario) return
    try {
      const res = await callApi<{ success: boolean; borrador?: any; error?: string }>('borradores:load', { id, usuario_id: usuario.id })
      if (!res?.success || !res.borrador) {
        toast.error(res?.error || t('errors.loadDraftError'))
        return
      }
      setCart(res.borrador.items || [])
      setDescuentoGlobal(res.borrador.descuento_global || 0)
      setClienteFacturaId(res.borrador.cliente_id ? String(res.borrador.cliente_id) : '')
      setBorradorId(id)
      setBorradoresOpen(false)
      toast.success(t('pos.draftResumed') || 'Borrador retomado')
    } catch (err: any) {
      toast.error(err?.message || t('errors.loadDraftError'))
    }
  }

  const deleteBorrador = async (id: number) => {
    if (!usuario) return
    try {
      await callApi('borradores:delete', { id, usuario_id: usuario.id })
      if (borradorId === id) setBorradorId(null)
      await loadBorradores()
    } catch (err: any) {
      toast.error(err?.message || t('errors.deleteDraftError'))
    }
  }

  useEffect(() => {
    if (usuario) loadBorradores()
  }, [usuario?.id])

  const clientesFiltradosFactura = useMemo(() => {
    const q = clienteFacturaQuery.trim().toLowerCase()
    if (!q) return clientesFiado.slice(0, 8)
    return clientesFiado.filter((c) => c.nombre.toLowerCase().includes(q) || (c.documento && c.documento.toLowerCase().includes(q))).slice(0, 8)
  }, [clienteFacturaQuery, clientesFiado])
  const clienteFacturaSel = clienteFacturaId ? clientesFiado.find((c) => String(c.id) === clienteFacturaId) : null



  const addQuickSale = () => {
    if (!quickSaleDesc.trim() || !quickSaleMonto || parseFloat(quickSaleMonto) <= 0) return
    const id = Date.now() // ID temporal para servicio
    setCart((prev) => [...prev, {
      producto_id: id,
      nombre: quickSaleDesc,
      precio_unitario: parseFloat(quickSaleMonto),
      cantidad: 1,
      stock: 9999,
      unidad: 'Servicio',
      tipo: 'servicio',
      esVentaRapida: true,
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
    setClienteFiadoId('')
    setDeudorNombre('')
    setDeudorTelefono('')
    setAbonoInicial('')
    setCobrarOpen(true)
  }

  const procesarVenta = async () => {
    if (procesando) return
    setProcesando(true)

    try {
      const esFiado = metodoPago === 'fiado'
      const abonoFiado = esFiado ? (parseFloat(abonoInicial) || 0) : 0
      const clienteSel = clientesFiado.find((c) => String(c.id) === clienteFiadoId)
      if (esFiado && !clienteSel && !deudorNombre.trim()) {
        toast.error(t('pos.fiadoDebtorRequired'))
        setProcesando(false)
        return
      }
      if (esFiado && abonoFiado > total) {
        toast.error(t('pos.fiadoAbonoExceedsTotal'))
        setProcesando(false)
        return
      }
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
        monto_pagado: esFiado ? abonoFiado : (metodoPago === 'efectivo' ? parseFloat(montoPagado) : total),
        cambio: metodoPago === 'efectivo' ? cambio : 0,
        cliente_id: esFiado && clienteSel
          ? clienteSel.id
          : (clienteFacturaId ? Number(clienteFacturaId) : undefined),
        deudor_nombre: esFiado && !clienteSel ? deudorNombre.trim() : undefined,
        deudor_telefono: esFiado && !clienteSel && deudorTelefono.trim() ? deudorTelefono.trim() : undefined,
        tipo_comprobante: tipoComprobante,
        detalles: cart.map((item) => {
          const itemDiscount = item.precio_unitario * item.cantidad * item.descuento / 100
          return {
            producto_id: item.esVentaRapida ? undefined : item.producto_id,
            descripcion: item.esVentaRapida ? item.nombre : undefined,
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

      // Si era un borrador retomado, eliminarlo al cobrar exitosamente
      if (borradorId) {
        try { await callApi('borradores:delete', { id: borradorId, usuario_id: usuario!.id }) } catch {}
        setBorradorId(null)
        await loadBorradores()
      }

      // Releer la venta guardada: devuelve totales reales + desglose de combos
      let ventaGuardada: any = null
      if (result?.id) {
        try {
          ventaGuardada = await callApi<any>('ventas:getById', { id: result.id })
        } catch { ventaGuardada = null }
      }
      setUltimoTicket({
        ...result,
        ventaGuardada,
        items: [...cart],
        total: ventaGuardada ? ventaGuardada.total : total,
        subtotal: ventaGuardada ? ventaGuardada.subtotal : subtotalConGlobal,
        impuesto: ventaGuardada ? ventaGuardada.impuesto : impuesto,
        descuento: ventaGuardada ? ventaGuardada.descuento : (descuentoItems + descuentoGlobalMonto),
        metodo_pago: metodoPago,
        datosTarjeta,
        esFiado,
        saldoFiado: esFiado ? Math.max(0, total - abonoFiado) : 0,
        deudorTicket: esFiado ? (clienteSel ? clienteSel.nombre : deudorNombre.trim()) : '',
      })
      setCobrarOpen(false)
      setTicketOpen(true)
      setCart([])
      setMontoPagado('')
      setClienteFacturaId('')
      setClienteFacturaQuery('')
      setBorradorId(null)
      setTipoComprobante('factura')
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
                    <div className="flex items-center gap-3 min-w-0">
                      <ProductImage productoId={p.id} className="w-10 h-10" />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                          {p.tipo === 'servicio' && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700 flex-shrink-0">
                              {t('pos.serviceTag') || 'Servicio'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400">
                          {p.categoria_nombre || t('pos.noCategory')}
                          {p.tipo !== 'servicio' ? ` • ${t('pos.stock') || 'Stock'}: ${p.stock} ${p.unidad}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-bold text-blue-600">{formatMoney(p.precio_venta)}</span>
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
        {/* Selector de cliente para factura (opcional) */}
        <div className="px-4 py-3 border-b border-gray-200">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
            {t('pos.invoiceClient') || 'Cliente (factura)'}
          </label>
          {clienteFacturaSel ? (
            <div className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{clienteFacturaSel.nombre}</p>
                {clienteFacturaSel.documento && <p className="text-xs text-gray-500">{clienteFacturaSel.documento}</p>}
              </div>
              <button onClick={() => { setClienteFacturaId(''); setClienteFacturaQuery('') }}
                className="text-xs text-red-500 hover:text-red-700 flex-shrink-0 ml-2">
                {t('common.remove') || 'Quitar'}
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="text"
                value={clienteFacturaQuery}
                onChange={(e) => setClienteFacturaQuery(e.target.value)}
                placeholder={t('pos.invoiceClientPlaceholder') || 'Buscar cliente...'}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              />
              {clientesFiltradosFactura.length > 0 && clienteFacturaQuery && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {clientesFiltradosFactura.map((c) => (
                    <button key={c.id} onClick={() => { setClienteFacturaId(String(c.id)); setClienteFacturaQuery('') }}
                      className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                      <span className="truncate">{c.nombre}</span>
                      {c.documento && <span className="text-xs text-gray-400 ml-2">{c.documento}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Header carrito */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">{t('pos.cart')}</span>
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {t('pos.itemCount', { count: cart.length, plural: cart.length === 1 ? 'item' : 'items' })}
            </span>
            {borradorId && (
              <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium" title={t('pos.draftActive') || 'Borrador activo'}>
                {t('pos.draftBadge') || 'borrador'}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => { setBorradoresOpen(true); loadBorradores() }}
              className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
              title={t('pos.openDrafts') || 'Borradores'}>
              📋 <span className="hidden md:inline">{t('pos.openDrafts') || 'Borradores'}</span>
              {borradores.length > 0 && <span className="bg-gray-200 text-gray-700 rounded-full px-1.5 text-[10px]">{borradores.length}</span>}
            </button>
            {cart.length > 0 && (
              <button onClick={clearCart} className="text-xs text-red-500 hover:text-red-700">
                {t('pos.clearCart')}
              </button>
            )}
          </div>
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
              <span>{formatMoney(subtotalBruto)}</span>
            </div>
            {descuentoItems > 0 && (
              <div className="flex justify-between text-red-500">
                <span>{t('pos.itemDiscountShort')}</span>
                <span>-{formatMoney(descuentoItems)}</span>
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
                <span className="text-red-500">-{formatMoney(descuentoGlobalMonto)}</span>
              )}
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('pos.netSubtotal')}</span>
              <span>{formatMoney(subtotalConGlobal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>{t('common.tax')} ({(taxRate * 100).toFixed(1)}%)</span>
              <span>{formatMoney(impuesto)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold text-gray-900 pt-1.5 border-t border-gray-200">
              <span>{t('common.total')}</span>
              <span>{formatMoney(total)}</span>
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
          <button
            onClick={saveBorrador}
            disabled={cart.length === 0}
            className="w-full py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors flex items-center justify-center gap-2 border border-amber-200 disabled:opacity-50"
          >
            💾 {borradorId ? (t('pos.updateDraft') || 'Actualizar borrador') : (t('pos.saveDraft') || 'Guardar venta (borrador)')}
          </button>
        </div>
      </div>

      {/* ======== MODAL DE COBRO ======== */}
      <Modal open={cobrarOpen} onClose={() => !procesando && setCobrarOpen(false)} title={t('pos.processPayment')}>
        <div className="space-y-5">
          {/* Total a pagar */}
          <div className="text-center py-4 bg-gray-50 rounded-xl">
            <p className="text-sm text-gray-500">{t('pos.totalToPay')}</p>
            <p className="text-3xl font-bold text-gray-900">{formatMoney(total)}</p>
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

          {/* Datos del crédito / fiado */}
          {esMetodoFiado && (
            <div className="space-y-4 border-t border-gray-100 pt-4">
              {clientesFiado.length > 0 && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.fiadoCliente')}</label>
                  <select
                    value={clienteFiadoId}
                    onChange={(e) => setClienteFiadoId(e.target.value)}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">{t('pos.fiadoFreeNameOption')}</option>
                    {clientesFiado.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}{c.documento ? ` (${c.documento})` : ''}
                      </option>
                    ))}
                  </select>
                  {clienteSelCobro && (clienteSelCobro.limite_credito ?? 0) > 0 && (
                    <p className="text-xs text-gray-500 mt-1">{t('pos.fiadoCreditLimit')}: {formatMoney(clienteSelCobro.limite_credito ?? 0)}</p>
                  )}
                </div>
              )}
              {!clienteFiadoId && (
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={deudorNombre}
                    onChange={(e) => setDeudorNombre(e.target.value)}
                    placeholder={t('pos.fiadoDebtorPlaceholder')}
                    className="col-span-2 w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={deudorTelefono}
                    onChange={(e) => setDeudorTelefono(e.target.value)}
                    placeholder={t('pos.fiadoPhone')}
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('pos.fiadoAbono')}</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={abonoInicial}
                  onChange={(e) => setAbonoInicial(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-xl font-bold text-center focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00"
                />
                <p className="text-xs text-gray-500 mt-1">
                  {t('pos.fiadoSaldoHint')}: {formatMoney(Math.max(0, total - abonoCobro))}
                </p>
              </div>
            </div>
          )}

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
                  <p className="text-2xl font-bold text-green-700">{formatMoney(cambio)}</p>
                </div>
              )}
              {parseFloat(montoPagado) > 0 && parseFloat(montoPagado) < total && (
                <div className="mt-2 text-center text-sm text-red-500">
                  {t('pos.missing')} {formatMoney(total - parseFloat(montoPagado))}
                </div>
              )}
            </div>
          )}

          {/* Tipo de comprobante */}
          <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <input
              id="chkNotaEntrega"
              type="checkbox"
              checked={tipoComprobante === 'nota_entrega'}
              onChange={(e) => setTipoComprobante(e.target.checked ? 'nota_entrega' : 'factura')}
              className="w-4 h-4 text-amber-600 rounded border-gray-300 focus:ring-amber-500"
            />
            <label htmlFor="chkNotaEntrega" className="text-sm text-gray-700 cursor-pointer select-none">
              {t('pos.deliveryNote') || 'Emitir como nota de entrega (sin valor fiscal)'}
            </label>
          </div>

          {/* Resumen */}
          <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">{t('inventario.items') || 'Items'}</span><span>{cart.length}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('common.subtotal')}</span><span>{formatMoney(subtotalBruto)}</span></div>
            {(descuentoItems + descuentoGlobalMonto) > 0 && (
              <div className="flex justify-between text-red-500"><span>{t('common.discount')}</span><span>-{formatMoney(descuentoItems + descuentoGlobalMonto)}</span></div>
            )}
            <div className="flex justify-between"><span className="text-gray-500">{t('common.tax')}</span><span>{formatMoney(impuesto)}</span></div>
            <div className="flex justify-between font-bold pt-1 border-t border-gray-200"><span>{t('common.total')}</span><span>{formatMoney(total)}</span></div>
          </div>

          {/* Botones */}
          <div className="flex gap-3">
            <button onClick={() => setCobrarOpen(false)} disabled={procesando}
              className="flex-1 py-3 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button
              onClick={procesarVenta}
              disabled={procesando || (metodoPago === 'efectivo' && parseFloat(montoPagado) < total) || (esMetodoFiado && (fiadoFaltaNombre || abonoCobro > total))}
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
                <p className="text-gray-400">
                  {ultimoTicket.ventaGuardada?.tipo_comprobante === 'nota_entrega'
                    ? (t('pos.deliveryNoteTitle') || 'NOTA DE ENTREGA')
                    : (t('ventas.ticket') || 'Ticket')}
                  {' '}{formatTicketNumber(ultimoTicket.numero_venta)}
                </p>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2">
                {(ultimoTicket.ventaGuardada?.detalles || ultimoTicket.items)?.map((item: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between">
                      <span>{item.producto_nombre || item.descripcion || item.nombre} x{item.cantidad}</span>
                      <span>{formatMoney(item.precio_unitario * item.cantidad)}</span>
                    </div>
                    {item.componentes?.map((c: any, j: number) => (
                      <div key={j} className="flex justify-between pl-3 text-gray-500">
                        <span>└ {c.nombre || c.descripcion} x{c.cantidad}</span>
                        <span />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2 space-y-1">
                <div className="flex justify-between"><span>{t('common.subtotal')}:</span><span>{formatMoney(ultimoTicket.subtotal ?? subtotalBruto)}</span></div>
                {(ultimoTicket.descuento ?? (descuentoItems + descuentoGlobalMonto)) > 0 && (
                  <div className="flex justify-between text-red-500"><span>{t('common.discount')}:</span><span>-{formatMoney(ultimoTicket.descuento ?? (descuentoItems + descuentoGlobalMonto))}</span></div>
                )}
                <div className="flex justify-between"><span>{t('common.tax')}:</span><span>{formatMoney(ultimoTicket.impuesto ?? impuesto)}</span></div>
                <div className="flex justify-between font-bold text-sm"><span>TOTAL:</span><span>{formatMoney(ultimoTicket.total)}</span></div>
              </div>
              <div className="border-t border-dashed border-gray-200 pt-2">
                <p>Pago: {nombreMetodo(ultimoTicket.metodo_pago)}</p>
                {ultimoTicket.esFiado && (
                  <>
                    {ultimoTicket.deudorTicket && <p>{t('pos.fiadoDebtor')}: {ultimoTicket.deudorTicket}</p>}
                    <p>{t('pos.fiadoSaldo')}: {formatMoney(ultimoTicket.saldoFiado)}</p>
                  </>
                )}
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

      {/* ======== MODAL BORRADORES ======== */}
      <Modal open={borradoresOpen} onClose={() => setBorradoresOpen(false)} title={t('pos.draftsTitle') || 'Ventas guardadas (borradores)'}>
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{t('pos.draftsHelp') || 'Borradores del usuario actual. Hacé click en uno para retomarlo en el carrito.'}</p>
          {borradores.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{t('pos.noDrafts') || 'Sin borradores guardados'}</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
              {borradores.map((b) => (
                <div key={b.id} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50">
                  <button onClick={() => resumeBorrador(b.id)} className="flex-1 text-left">
                    <p className="text-sm font-medium text-gray-900">
                      {b.cliente_nombre || (t('pos.noClient') || 'Sin cliente')}
                      <span className="ml-2 text-xs text-gray-500">{b.item_count} {(b.item_count === 1 ? 'ítem' : 'ítems')}</span>
                    </p>
                    <p className="text-xs text-gray-500">{formatMoney(b.total || 0)} · {new Date(b.actualizado_en + 'Z').toLocaleString()}</p>
                  </button>
                  <button onClick={() => deleteBorrador(b.id)}
                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                    title={t('common.delete')}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end pt-2 border-t border-gray-100">
            <button onClick={() => setBorradoresOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.close')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
