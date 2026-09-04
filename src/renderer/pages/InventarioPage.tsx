import { useEffect, useState, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@core/auth/store'
import {
  Plus, Search, Edit2, Trash2, Package, Tag,
  ChevronDown, AlertTriangle, Filter, Download, Upload, History, EyeOff, ScanBarcode, ListTree, X
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency } from '../lib/utils'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { callApi } from '../lib/api-client'

interface Producto {
  id: number; codigo_barras: string | null; sku: string | null
  nombre: string; descripcion: string | null; categoria_id: number | null
  subcategoria_id: number | null; marca: string | null; tipo: 'producto' | 'servicio'
  imagen: string | null
  precio_compra: number; precio_venta: number; stock: number
  stock_minimo: number;  unidad: string; activo: number
  categoria_nombre: string | null
  subcategoria_nombre?: string | null
  es_combo?: number
  costo_real?: number
}
interface LineaComponente {
  producto_id: number
  cantidad: string
}
interface Categoria { id: number; nombre: string; descripcion: string | null; activo: number }
interface UnidadMedida { id: number; nombre: string; abreviatura: string | null; activo: number }
interface Subcategoria { id: number; nombre: string; categoria_id: number; activo: number; categoria_nombre?: string }

const emptyProduct = {
  nombre: '', codigo_barras: '', sku: '', descripcion: '',
  categoria_id: 0, subcategoria_id: 0, marca: '', tipo: 'producto' as 'producto' | 'servicio',
  precio_compra: 0, precio_venta: 0,
  stock: 0, stock_minimo: 5, unidad: 'unidad', imagen: null as string | null,
}

export default function InventarioPage() {
  const { t, i18n } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const { has } = usePermissions()
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<number>(0)
  const [showCat, setShowCat] = useState(false)
  const [showUnid, setShowUnid] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [subCatFilter, setSubCatFilter] = useState<number>(0)

  // Modal subcategoría
  const [subModalOpen, setSubModalOpen] = useState(false)
  const [subForm, setSubForm] = useState({ nombre: '', categoria_id: 0 })
  const [editingSub, setEditingSub] = useState<Subcategoria | null>(null)

  // Modal producto
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [saving, setSaving] = useState(false)
  // Componentes del producto compuesto (combos)
  const [componentes, setComponentes] = useState<LineaComponente[]>([])
  const [comboMode, setComboMode] = useState(false)

  const esProductoCombo = comboMode || componentes.length > 0
  // Catálogo disponible para ser componente (productos físicos, no servicios, no el propio producto)
  const candidatosComponente = productos.filter(
    (p) => p.tipo === 'producto' && p.id !== (editing?.id ?? -1) && p.activo === 1,
  )
  const costoLineaComponente = (l: LineaComponente) => {
    const prod = productos.find((p) => p.id === l.producto_id)
    if (!prod) return 0
    const costoUnit = prod.es_combo === 1 ? (prod.costo_real ?? prod.precio_compra) : prod.precio_compra
    return (Number(l.cantidad) || 0) * costoUnit
  }
  const costoComboPreview = componentes.reduce((acc, l) => acc + costoLineaComponente(l), 0)

  // Modal categoría
  const [catModalOpen, setCatModalOpen] = useState(false)
  const [catForm, setCatForm] = useState({ nombre: '', descripcion: '' })
  const [editingCat, setEditingCat] = useState<Categoria | null>(null)

  // Modal unidad
  const [unidModalOpen, setUnidModalOpen] = useState(false)
  const [unidForm, setUnidForm] = useState({ nombre: '', abreviatura: '' })
  const [editingUnid, setEditingUnid] = useState<UnidadMedida | null>(null)

  // Quick-add unidad desde el dropdown
  const [showQuickUnidad, setShowQuickUnidad] = useState(false)
  const [quickUnidad, setQuickUnidad] = useState({ nombre: '', abreviatura: '' })

  // Ajuste de inventario
  const [ajusteOpen, setAjusteOpen] = useState(false)
  const [ajusteTarget, setAjusteTarget] = useState<Producto | null>(null)
  const [ajusteStock, setAjusteStock] = useState('')
  const [ajusteJustificacion, setAjusteJustificacion] = useState('')
  const [ajustando, setAjustando] = useState(false)

  // Confirm delete
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'producto' | 'categoria' | 'unidad' | 'subcategoria'; id: number } | null>(null)

  // Import/Export CSV
  const [importing, setImporting] = useState(false)

  // Escáner de código de barras para formulario
  const [barcodeMode, setBarcodeMode] = useState(false)
  const barcodeBufferRef = useRef('')
  const barcodeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const nombreRef = useRef<HTMLInputElement>(null)
  const toast = useToast()

  // Handler para escaneo de código en formulario de producto
  const handleFormBarcodeScan = useCallback((barcode: string) => {
    if (!modalOpen) return
    // Llenar el campo de código de barras
    setForm((prev) => ({ ...prev, codigo_barras: barcode }))
    // Focus al campo de nombre para escribir el resto
    setTimeout(() => nombreRef.current?.focus(), 50)
    toast.success(`${i18n.language === 'en' ? 'Barcode scanned' : 'Código escaneado'}: ${barcode}`)
  }, [modalOpen, toast, i18n.language])

  // Hook global de escaneo para formulario
  useEffect(() => {
    if (!barcodeMode || !modalOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      // Ignorar si está en un input excepto el de código de barras
      if (target.tagName === 'INPUT' && target !== nombreRef.current) return

      if (barcodeTimeoutRef.current) {
        clearTimeout(barcodeTimeoutRef.current)
        barcodeTimeoutRef.current = null
      }

      if (e.key === 'Enter') {
        e.preventDefault()
        const barcode = barcodeBufferRef.current.trim()
        barcodeBufferRef.current = ''
        if (barcode.length > 0) handleFormBarcodeScan(barcode)
        return
      }

      if (e.key === 'Backspace') {
        barcodeBufferRef.current = barcodeBufferRef.current.slice(0, -1)
        return
      }

      if (e.key.length > 1 && !e.key.startsWith('F')) return
      barcodeBufferRef.current += e.key

      barcodeTimeoutRef.current = setTimeout(() => {
        barcodeBufferRef.current = ''
        barcodeTimeoutRef.current = null
      }, 50)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (barcodeTimeoutRef.current) clearTimeout(barcodeTimeoutRef.current)
    }
  }, [barcodeMode, modalOpen, handleFormBarcodeScan])

  // Filtro sin stock
  const [filterSinStock, setFilterSinStock] = useState(false)

  // Historial de ajustes
  const [showAjustes, setShowAjustes] = useState(false)
  const [ajustesHistorial, setAjustesHistorial] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [prods, cats, unids, subs] = await Promise.all([
      callApi<Producto[]>('productos:list'),
      callApi<Categoria[]>('categorias:list'),
      callApi<UnidadMedida[]>('unidades:list'),
      callApi<Subcategoria[]>('subcategorias:list'),
    ])
    setProductos(prods)
    setCategorias(cats)
    setUnidades(unids)
    setSubcategorias(subs)
  }

  // Filtrar productos
  const filtered = productos.filter((p) => {
    const term = search.toLowerCase()
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(term) ||
      p.codigo_barras?.toLowerCase().includes(term) ||
      p.sku?.toLowerCase().includes(term) ||
      p.marca?.toLowerCase().includes(term)
    const matchCat = !filterCat || p.categoria_id === filterCat
    const matchStock = !filterSinStock || (p.stock <= p.stock_minimo)
    return matchSearch && matchCat && matchStock
  })

  // ======== IMPORT/EXPORT CSV ========
  const exportCsv = async () => {
    const result = await callApi<{ success: boolean; path?: string; count?: number; error?: string }>('productos:export-csv')
    if (result?.success) {
      alert(`Exportados ${result.count} productos a:\n${result.path}`)
    } else if (result?.error !== 'Cancelado') {
      alert('Error: ' + result?.error)
    }
  }

  const importCsv = async () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.csv'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      setImporting(true)
      try {
        const result = await callApi<{ success: boolean; imported?: number; skipped?: number; total?: number; error?: string }>('productos:import-csv', file.path)
        if (result?.success) {
          alert(`Importados: ${result.imported}, Omitidos: ${result.skipped} de ${result.total} filas`)
          await loadData()
        } else {
          alert('Error: ' + result?.error)
        }
      } finally { setImporting(false) }
    }
    input.click()
  }

  // ======== HISTORIAL DE AJUSTES ========
  const loadAjustes = async () => {
    const hist = await callApi<any[]>('productos:ajustes-historial', { limite: 50 })
    setAjustesHistorial(hist)
    setShowAjustes(true)
  }

  // ======== PRODUCTOS ========

  const openCreate = () => {
    setEditing(null)
    setForm(emptyProduct)
    setComponentes([])
    setComboMode(false)
    setBarcodeMode(true)
    setModalOpen(true)
  }

  const openEdit = async (p: Producto) => {
    setEditing(p)
    setComponentes([])
    setComboMode(p.es_combo === 1)
    setForm({
      nombre: p.nombre,
      codigo_barras: p.codigo_barras || '',
      sku: p.sku || '',
      descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || 0,
      subcategoria_id: p.subcategoria_id || 0,
      marca: p.marca || '',
      tipo: p.tipo || 'producto',
      precio_compra: p.precio_compra,
      precio_venta: p.precio_venta,
      stock: p.stock,
      stock_minimo: p.stock_minimo,
      unidad: p.unidad,
      imagen: p.imagen || null,
    })
    setBarcodeMode(false)
    // Si el producto es compuesto, cargar sus componentes para editarlos
    if (p.es_combo) {
      try {
        const detalle = await callApi<{ success: boolean; componentes: { componente_id: number; cantidad: number }[] }>('combos:get', { producto_id: p.id })
        if (detalle?.success) {
          setComponentes((detalle.componentes || []).map((c) => ({ producto_id: c.componente_id, cantidad: String(c.cantidad) })))
        }
      } catch { /* sin componentes que cargar */ }
    }
    setModalOpen(true)
  }

  const saveProduct = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const esComboFinal = form.tipo === 'producto' && comboMode
      const data = {
        ...form,
        codigo_barras: form.codigo_barras || undefined,
        sku: form.sku || undefined,
        descripcion: form.descripcion || undefined,
        categoria_id: form.categoria_id || undefined,
        subcategoria_id: form.subcategoria_id || null,
        marca: form.marca.trim(),
        tipo: form.tipo,
        imagen: form.imagen || '',
        // Los combos no tienen stock propio: se calcula desde componentes
        ...(esComboFinal ? { stock: 0, stock_minimo: 0 } : {}),
      }
      let productoId: number | null = editing?.id ?? null
      if (editing) {
        await callApi('productos:update', { id: editing.id, data })
      } else {
        const creado = await callApi<{ id: number }>('productos:create', data)
        productoId = creado.id
      }
      // Guardar componentes del combo (solo productos, no servicios)
      if (productoId != null && form.tipo === 'producto') {
        const items = componentes
          .filter((c) => c.producto_id)
          .map((c) => ({ componente_id: c.producto_id, cantidad: Math.max(0.01, Number(c.cantidad) || 1) }))
        const res = await callApi<{ success: boolean; error?: string; costo_real?: number }>('combos:guardar', {
          producto_id: productoId,
          componentes: esComboFinal ? items : [],
        })
        if (res && res.success === false) throw new Error(res.error)
        if (esComboFinal && res?.success && typeof res.costo_real === 'number') {
          const margen = form.precio_venta - res.costo_real
          toast.success(
            `${i18n.language === 'en' ? 'Real cost' : 'Costo real'}: ${formatCurrency(res.costo_real)} · ` +
            `${i18n.language === 'en' ? 'Margin' : 'Margen'}: ${formatCurrency(margen)}`,
          )
        }
      }
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || (i18n.language === 'en' ? 'Error saving product' : 'Error guardando producto'))
    } finally {
      setSaving(false)
    }
  }

  const deleteProduct = async (id: number) => {
    await callApi('productos:delete', { id })
    await loadData()
  }

  // ======== AJUSTE DE INVENTARIO ========

  const openAjuste = (p: Producto) => {
    setAjusteTarget(p)
    setAjusteStock(String(p.stock))
    setAjusteJustificacion('')
    setAjusteOpen(true)
  }

  const ajustarStock = async () => {
    if (!ajusteTarget || !ajusteJustificacion.trim() || ajustando) return
    setAjustando(true)
    try {
      const result = await callApi<{ success: boolean; error?: string }>('productos:ajustar', {
        producto_id: ajusteTarget.id,
        stock_nuevo: Number(ajusteStock),
        justificacion: ajusteJustificacion,
        usuario_id: usuario?.id || 1,
      })
      if (result?.success) {
        setAjusteOpen(false)
        await loadData()
      } else {
        alert(result?.error || 'Error al ajustar stock')
      }
    } finally {
      setAjustando(false)
    }
  }

  // ======== CATEGORÍAS ========

  const openCreateCat = () => {
    setEditingCat(null)
    setCatForm({ nombre: '', descripcion: '' })
    setCatModalOpen(true)
  }

  const openEditCat = (c: Categoria) => {
    setEditingCat(c)
    setCatForm({ nombre: c.nombre, descripcion: c.descripcion || '' })
    setCatModalOpen(true)
  }

  const saveCategory = async () => {
    if (!catForm.nombre.trim()) return
    if (editingCat) {
      await callApi('categorias:update', { id: editingCat.id, data: catForm })
    } else {
      await callApi('categorias:create', catForm)
    }
    setCatModalOpen(false)
    await loadData()
  }

  const deleteCategory = async (id: number) => {
    await callApi('categorias:delete', { id })
    await loadData()
  }

  // ======== UNIDADES DE MEDIDA ========

  const openCreateUnid = () => {
    setEditingUnid(null)
    setUnidForm({ nombre: '', abreviatura: '' })
    setUnidModalOpen(true)
  }

  const openEditUnid = (u: UnidadMedida) => {
    setEditingUnid(u)
    setUnidForm({ nombre: u.nombre, abreviatura: u.abreviatura || '' })
    setUnidModalOpen(true)
  }

  const saveUnidad = async () => {
    if (!unidForm.nombre.trim()) return
    if (editingUnid) {
      await callApi('unidades:update', { id: editingUnid.id, data: unidForm })
    } else {
      await callApi('unidades:create', unidForm)
    }
    setUnidModalOpen(false)
    await loadData()
  }

  const deleteUnidad = async (id: number) => {
    await callApi('unidades:delete', { id })
    await loadData()
  }

  // Quick-add: crear unidad desde el dropdown del producto
  const quickAddUnidad = async () => {
    if (!quickUnidad.nombre.trim()) return
    const result = await callApi('unidades:create', quickUnidad)
    setQuickUnidad({ nombre: '', abreviatura: '' })
    setShowQuickUnidad(false)
    await loadData()
    // Seleccionar la unidad recién creada
    setForm({ ...form, unidad: quickUnidad.nombre })
  }

  // ======== SUBCATEGORÍAS ========

  const openCreateSub = () => {
    setEditingSub(null)
    setSubForm({ nombre: '', categoria_id: subCatFilter || 0 })
    setSubModalOpen(true)
  }

  const openEditSub = (s: Subcategoria) => {
    setEditingSub(s)
    setSubForm({ nombre: s.nombre, categoria_id: s.categoria_id })
    setSubModalOpen(true)
  }

  const saveSubcategoria = async () => {
    if (!subForm.nombre.trim() || !subForm.categoria_id) return
    if (editingSub) {
      await callApi('subcategorias:update', { id: editingSub.id, data: subForm })
    } else {
      await callApi('subcategorias:create', subForm)
    }
    setSubModalOpen(false)
    await loadData()
  }

  const deleteSubcategoria = async (id: number) => {
    await callApi('subcategorias:delete', { id })
    await loadData()
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('inventario.title')}</h1>
          <p className="text-sm text-gray-500">{productos.length} {i18n.language === 'en' ? 'registered products' : 'productos registrados'}</p>
        </div>        <div className="flex gap-2">
          <button
            onClick={() => { setShowCat(!showCat); setShowUnid(false); setShowSub(false) }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showCat ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            <Tag className="w-4 h-4" /> {t('inventario.categories')}
          </button>
          <button
            onClick={() => { setShowSub(!showSub); setShowCat(false); setShowUnid(false) }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showSub ? 'bg-sky-50 border-sky-300 text-sky-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            <ListTree className="w-4 h-4" /> {i18n.language === 'en' ? 'Subcategories' : 'Subcategorías'}
          </button>
          <button
            onClick={() => { setShowUnid(!showUnid); setShowCat(false); setShowSub(false) }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showUnid ? 'bg-emerald-50 border-emerald-300 text-emerald-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            <Package className="w-4 h-4" /> {i18n.language === 'en' ? 'Units' : 'Unidades'}
          </button>
          <button onClick={loadAjustes}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            <History className="w-4 h-4" /> {i18n.language === 'en' ? 'Adjustments' : 'Ajustes'}
          </button>
          <button onClick={exportCsv}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50">
            <Download className="w-4 h-4" /> {t('common.export')}
          </button>
          <button onClick={importCsv} disabled={importing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Upload className="w-4 h-4" /> {importing ? t('common.loading') : t('common.import')}
          </button>
          {has('inventario_create') && (
            <button
              onClick={openCreate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" /> {t('inventario.newProduct')}
            </button>
          )}
        </div>
      </div>

      {/* Panel de categorías (toggle) */}
      {showCat && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">{t('inventario.categories')}</h3>
            {has('inventario_categories') && (
              <button onClick={openCreateCat} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
                <Plus className="w-4 h-4" /> {i18n.language === 'en' ? 'Add' : 'Agregar'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {categorias.map((c) => (
              <div key={c.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group">
                <span className="text-sm text-gray-700 truncate">{c.nombre}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditCat(c)} className="p-1 hover:bg-gray-200 rounded">
                    <Edit2 className="w-3 h-3 text-gray-500" />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'categoria', id: c.id })} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel de unidades de medida */}
      {showUnid && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">{i18n.language === 'en' ? 'Units of Measure' : 'Unidades de Medida'}</h3>
            {has('inventario_units') && (
              <button onClick={openCreateUnid} className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
                <Plus className="w-4 h-4" /> {i18n.language === 'en' ? 'Add Unit' : 'Agregar Unidad'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {unidades.map((u) => (
              <div key={u.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group">
                <div>
                  <span className="text-sm text-gray-700">{u.nombre}</span>
                  {u.abreviatura && <span className="text-xs text-gray-400 ml-1">({u.abreviatura})</span>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditUnid(u)} className="p-1 hover:bg-gray-200 rounded">
                    <Edit2 className="w-3 h-3 text-gray-500" />
                  </button>
                  <button onClick={() => setDeleteTarget({ type: 'unidad', id: u.id })} className="p-1 hover:bg-red-100 rounded">
                    <Trash2 className="w-3 h-3 text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Panel de subcategorías (toggle) */}
      {showSub && (
        <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">{i18n.language === 'en' ? 'Subcategories' : 'Subcategorías'}</h3>
            {has('inventario_categories') && (
              <button onClick={openCreateSub} className="text-sm text-sky-600 hover:text-sky-700 flex items-center gap-1">
                <Plus className="w-4 h-4" /> {i18n.language === 'en' ? 'Add' : 'Agregar'}
              </button>
            )}
          </div>
          <select
            value={subCatFilter}
            onChange={(e) => setSubCatFilter(Number(e.target.value))}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
          >
            <option value={0}>{i18n.language === 'en' ? 'All categories' : 'Todas las categorías'}</option>
            {categorias.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </select>
          {subcategorias.filter((s) => !subCatFilter || s.categoria_id === subCatFilter).length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">{i18n.language === 'en' ? 'No subcategories in this category yet' : 'Esta categoría aún no tiene subcategorías'}</p>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {subcategorias.filter((s) => !subCatFilter || s.categoria_id === subCatFilter).map((s) => (
                <div key={s.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg group">
                  <div className="min-w-0">
                    <p className="text-sm text-gray-700 truncate">{s.nombre}</p>
                    <p className="text-xs text-gray-400 truncate">{s.categoria_nombre || ''}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEditSub(s)} className="p-1 hover:bg-gray-200 rounded">
                      <Edit2 className="w-3 h-3 text-gray-500" />
                    </button>
                    <button onClick={() => setDeleteTarget({ type: 'subcategoria', id: s.id })} className="p-1 hover:bg-red-100 rounded">
                      <Trash2 className="w-3 h-3 text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Barra de búsqueda y filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={i18n.language === 'en' ? 'Search by name, barcode or SKU...' : 'Buscar por nombre, código de barras o SKU...'}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>
        <select
          value={filterCat}
          onChange={(e) => setFilterCat(Number(e.target.value))}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500"
        >
          <option value={0}>{i18n.language === 'en' ? 'All categories' : 'Todas las categorías'}</option>
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
        <button
          onClick={() => setFilterSinStock(!filterSinStock)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
            filterSinStock ? 'bg-orange-50 border-orange-300 text-orange-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <EyeOff className="w-4 h-4" /> {t('inventario.lowStock')}
        </button>
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{i18n.language === 'en' ? 'Product' : 'Producto'}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('inventario.category')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('inventario.cost')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('inventario.sale')}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('inventario.currentStock')}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{i18n.language === 'en' ? 'Unit' : 'Unidad'}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{i18n.language === 'en' ? 'No products found' : 'No se encontraron productos'}</p>
                </td>
              </tr>
            ) : (
              filtered.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.imagen && <img src={p.imagen} alt={p.nombre} className="w-10 h-10 rounded-lg object-cover border border-gray-100 flex-shrink-0" />}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-gray-900 truncate">{p.nombre}</p>
                          {p.tipo === 'servicio' && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{i18n.language === 'en' ? 'Service' : 'Servicio'}</span>
                          )}
                          {p.es_combo === 1 && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700" title={i18n.language === 'en' ? 'Composite product / combo. Real cost from components.' : 'Producto compuesto / combo. Costo real desde componentes.'}>
                              {i18n.language === 'en' ? 'Combo' : 'Combo'}
                            </span>
                          )}
                        </div>
                        {p.codigo_barras && <p className="text-xs text-gray-400">CB: {p.codigo_barras}</p>}
                        {p.marca && <p className="text-xs text-gray-500">{p.marca}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{p.categoria_nombre || '—'}</div>
                    {p.subcategoria_nombre && <div className="text-xs text-gray-400">{p.subcategoria_nombre}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right" title={p.es_combo === 1 ? (i18n.language === 'en' ? 'Real cost from components' : 'Costo real desde componentes') : undefined}>
                    {formatCurrency(p.es_combo === 1 ? (p.costo_real ?? p.precio_compra) : p.precio_compra)}
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 text-right">{formatCurrency(p.precio_venta)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                      p.stock <= p.stock_minimo ? 'text-red-600' : 'text-gray-900'
                    }`}>
                      {p.stock <= p.stock_minimo && <AlertTriangle className="w-3.5 h-3.5" />}
                      {p.stock}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 text-center capitalize">{p.unidad}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {has('inventario_adjust') && p.es_combo !== 1 && (
                        <button onClick={() => openAjuste(p)} className="p-1.5 hover:bg-blue-50 rounded-lg" title={i18n.language === 'en' ? 'Adjust stock' : 'Ajustar stock'}>
                          <Package className="w-4 h-4 text-blue-500" />
                        </button>
                      )}
                      {has('inventario_edit') && (
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('common.edit')}>
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                      )}
                      {has('inventario_delete') && (
                        <button onClick={() => setDeleteTarget({ type: 'producto', id: p.id })} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('common.delete')}>
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Producto */}
      <Modal open={modalOpen} onClose={() => { setModalOpen(false); setBarcodeMode(false) }} title={editing ? t('inventario.editProduct') : t('inventario.newProduct')} wide>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Product Type' : 'Tipo de producto'}</label>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => setForm({ ...form, tipo: 'producto' })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                  form.tipo === 'producto' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <Package className="w-4 h-4" /> {i18n.language === 'en' ? 'Product' : 'Producto'}
              </button>
              <button type="button" onClick={() => setForm({ ...form, tipo: 'servicio' })}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg border-2 transition-colors ${
                  form.tipo === 'servicio' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}>
                <ListTree className="w-4 h-4" /> {i18n.language === 'en' ? 'Service' : 'Servicio'}
              </button>
            </div>
            {form.tipo === 'servicio' && (
              <p className="text-xs text-sky-600 mt-1">{i18n.language === 'en' ? 'Services are sold without stock control.' : 'Los servicios se venden sin control de stock.'}</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
              <input ref={nombreRef} value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1">
                {i18n.language === 'en' ? 'Barcode' : 'Código de barras'}
                {barcodeMode && !editing && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
                    <ScanBarcode className="w-3 h-3" />
                    {i18n.language === 'en' ? 'Scan now' : 'Escanea ahora'}
                  </span>
                )}
              </label>
              <input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                placeholder={barcodeMode && !editing ? (i18n.language === 'en' ? 'Scan barcode or type...' : 'Escanea o escribe el código...') : ''}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.category')}</label>
              <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: Number(e.target.value), subcategoria_id: 0 })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value={0}>{i18n.language === 'en' ? 'No category' : 'Sin categoría'}</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Subcategory' : 'Subcategoría'}</label>
              <select
                value={form.subcategoria_id}
                onChange={(e) => setForm({ ...form, subcategoria_id: Number(e.target.value) })}
                disabled={!form.categoria_id}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400">
                <option value={0}>{i18n.language === 'en' ? 'None' : 'Ninguna'}</option>
                {subcategorias.filter((s) => s.categoria_id === form.categoria_id).map((s) => (
                  <option key={s.id} value={s.id}>{s.nombre}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Unit of Measure' : 'Unidad de Medida'}</label>
              <div className="flex gap-1">
                <select value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                  {unidades.map((u) => (
                    <option key={u.id} value={u.nombre}>{u.nombre}{u.abreviatura ? ` (${u.abreviatura})` : ''}</option>
                  ))}
                  {unidades.length === 0 && <option value="">{i18n.language === 'en' ? 'No units yet' : 'Sin unidades'}</option>}
                </select>
                <button type="button" onClick={() => setShowQuickUnidad(true)}
                  className="px-2 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-emerald-600"
                  title="Add new unit">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {showQuickUnidad && (
                <div className="mt-2 p-3 bg-emerald-50 rounded-lg border border-emerald-200 space-y-2">
                  <p className="text-xs font-medium text-emerald-700">{i18n.language === 'en' ? 'New Unit of Measure' : 'Nueva Unidad de Medida'}</p>
                  <div className="flex gap-2">
                    <input value={quickUnidad.nombre} onChange={(e) => setQuickUnidad({ ...quickUnidad, nombre: e.target.value })}
                      placeholder="Name (e.g. Gallon)" autoFocus
                      className="flex-1 px-2 py-1.5 border border-emerald-300 rounded text-sm focus:ring-2 focus:ring-emerald-500" />
                    <input value={quickUnidad.abreviatura} onChange={(e) => setQuickUnidad({ ...quickUnidad, abreviatura: e.target.value })}
                      placeholder="Abbr (gal)" className="w-20 px-2 py-1.5 border border-emerald-300 rounded text-sm focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setShowQuickUnidad(false)} className="text-xs text-gray-500 hover:text-gray-700">Cancel</button>
                    <button type="button" onClick={quickAddUnidad} disabled={!quickUnidad.nombre.trim()}
                      className="text-xs font-medium text-white bg-emerald-600 px-3 py-1 rounded hover:bg-emerald-700 disabled:bg-emerald-300">Add</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Brand' : 'Marca'}</label>
              <input type="text" value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })}
                placeholder={i18n.language === 'en' ? 'Optional brand' : 'Marca (opcional)'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            {form.tipo === 'producto' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.costPrice')}</label>
                <input type="number" step="0.01" min="0" value={form.precio_compra}
                  onChange={(e) => setForm({ ...form, precio_compra: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
            ) : null}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.salePrice')} *</label>
              <input type="number" step="0.01" min="0" value={form.precio_venta}
                onChange={(e) => setForm({ ...form, precio_venta: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            {form.tipo === 'producto' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.currentStock')}</label>
                  <input type="number" min="0" value={form.stock}
                    onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.minStock')}</label>
                  <input type="number" min="0" value={form.stock_minimo}
                    onChange={(e) => setForm({ ...form, stock_minimo: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
              </>
            )}
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
              <textarea rows={2} value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Image' : 'Imagen'}</label>
              <div className="flex items-start gap-3">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const allowed = ['image/png', 'image/jpeg', 'image/webp']
                    if (!allowed.includes(file.type)) {
                      toast.error(i18n.language === 'en' ? 'Format not allowed. Use PNG, JPG or WebP.' : 'Formato no permitido. Use PNG, JPG o WebP.')
                      e.target.value = ''
                      return
                    }
                    if (file.size > 1024 * 1024) {
                      toast.error(i18n.language === 'en' ? 'Image too large. Maximum: 1 MB.' : 'La imagen es demasiado grande. Máximo: 1 MB.')
                      e.target.value = ''
                      return
                    }
                    const reader = new FileReader()
                    reader.onloadend = () => setForm((prev) => ({ ...prev, imagen: reader.result as string }))
                    reader.readAsDataURL(file)
                  }}
                  className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sky-50 file:text-sky-700 hover:file:bg-sky-100"
                />
                {form.imagen && (
                  <div className="relative flex-shrink-0">
                    <img src={form.imagen} alt="" className="w-16 h-16 rounded-lg object-cover border border-gray-200" />
                    <button type="button" onClick={() => setForm((prev) => ({ ...prev, imagen: null }))}
                      className="absolute -top-1.5 -right-1.5 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* ===== Producto compuesto / combo ===== */}
            {form.tipo === 'producto' && (
              <div className="col-span-2 border border-emerald-200 rounded-xl p-4 bg-emerald-50/40">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">
                      {i18n.language === 'en' ? 'Composite product / combo' : 'Producto compuesto / combo'}
                    </p>
                    <p className="text-xs text-gray-500">
                      {i18n.language === 'en'
                        ? 'Builds from other products. Real cost and stock come from its components.'
                        : 'Se arma con otros productos. El costo real y el stock vienen de sus componentes.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setComboMode(!comboMode)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${esProductoCombo ? 'bg-emerald-500' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${esProductoCombo ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                </div>

                {esProductoCombo && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      {componentes.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2 bg-white/60 rounded-lg">
                          {i18n.language === 'en' ? 'No components yet. Add the first one.' : 'Todavía sin componentes. Agrega el primero.'}
                        </p>
                      )}
                      {componentes.map((c, idx) => (
                        <div key={idx} className="flex items-center gap-2 bg-white rounded-lg p-2 border border-emerald-100">
                          <select
                            value={c.producto_id}
                            onChange={(e) => {
                              const nuevo = [...componentes]
                              nuevo[idx] = { ...c, producto_id: Number(e.target.value) }
                              setComponentes(nuevo)
                            }}
                            className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                          >
                            <option value="">{i18n.language === 'en' ? 'Choose a product' : 'Elige un producto'}</option>
                            {candidatosComponente.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.nombre} · {formatCurrency(p.es_combo === 1 ? (p.costo_real ?? p.precio_compra) : p.precio_compra)} c/u
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={c.cantidad}
                            onChange={(e) => {
                              const nuevo = [...componentes]
                              nuevo[idx] = { ...c, cantidad: e.target.value }
                              setComponentes(nuevo)
                            }}
                            title={i18n.language === 'en' ? 'Quantity' : 'Cantidad'}
                            className="w-20 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm text-center"
                          />
                          <span className="w-16 text-right text-xs text-gray-500 whitespace-nowrap">
                            {formatCurrency(costoLineaComponente(c))}
                          </span>
                          <button
                            type="button"
                            onClick={() => setComponentes(componentes.filter((_, i) => i !== idx))}
                            className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={() => setComponentes([...componentes, { producto_id: 0, cantidad: '1' }])}
                      disabled={candidatosComponente.length === 0}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-100 rounded-lg hover:bg-emerald-200 disabled:opacity-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> {i18n.language === 'en' ? 'Add component' : 'Agregar componente'}
                    </button>
                    <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm pt-2 border-t border-emerald-100">
                      <span className="text-gray-600">
                        {i18n.language === 'en' ? 'Real cost' : 'Costo real'}: <strong className="text-gray-900">{formatCurrency(costoComboPreview)}</strong>
                      </span>
                      <span className="text-gray-600">
                        {i18n.language === 'en' ? 'Sale price' : 'Precio venta'}: <strong className="text-gray-900">{formatCurrency(form.precio_venta || 0)}</strong>
                      </span>
                      <span className="text-gray-600">
                        {i18n.language === 'en' ? 'Margin' : 'Margen'}:{' '}
                        <strong className={(form.precio_venta || 0) - costoComboPreview >= 0 ? 'text-emerald-700' : 'text-red-600'}>
                          {formatCurrency((form.precio_venta || 0) - costoComboPreview)}
                        </strong>
                      </span>
                    </div>
                    {editing && (
                      <p className="text-xs text-amber-600">
                        {i18n.language === 'en'
                          ? 'Note: the saved margin is recalculated from the components and their current cost.'
                          : 'Nota: al guardar, el margen se recalcula con los componentes y su costo actual.'}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
            <button onClick={saveProduct} disabled={saving || !form.nombre.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('common.saving') : editing ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Subcategoría */}
      <Modal open={subModalOpen} onClose={() => setSubModalOpen(false)} title={editingSub ? (i18n.language === 'en' ? 'Edit Subcategory' : 'Editar Subcategoría') : (i18n.language === 'en' ? 'New Subcategory' : 'Nueva Subcategoría')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={subForm.nombre} onChange={(e) => setSubForm({ ...subForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.category')} *</label>
            <select
              value={subForm.categoria_id}
              onChange={(e) => setSubForm({ ...subForm, categoria_id: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
              <option value={0}>{i18n.language === 'en' ? 'Select a category' : 'Selecciona una categoría'}</option>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setSubModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
            <button onClick={saveSubcategoria} disabled={!subForm.nombre.trim() || !subForm.categoria_id}
              className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 disabled:bg-sky-300">
              {editingSub ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Categoría */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? t('inventario.editProduct') + ' ' + (t('inventario.category')) : t('inventario.newCategory')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Alimentos" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descripción</label>
            <textarea rows={2} value={catForm.descripcion}
              onChange={(e) => setCatForm({ ...catForm, descripcion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setCatModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
            <button onClick={saveCategory} disabled={!catForm.nombre.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {editingCat ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Unidad de Medida */}
      <Modal open={unidModalOpen} onClose={() => setUnidModalOpen(false)} title={editingUnid ? (i18n.language === 'en' ? 'Edit Unit' : 'Editar Unidad') : (i18n.language === 'en' ? 'New Unit of Measure' : 'Nueva Unidad de Medida')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={unidForm.nombre} onChange={(e) => setUnidForm({ ...unidForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Galón, Paleta, Litro" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Abreviatura</label>
            <input value={unidForm.abreviatura} onChange={(e) => setUnidForm({ ...unidForm, abreviatura: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: gal, L, paq" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setUnidModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
            <button onClick={saveUnidad} disabled={!unidForm.nombre.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:bg-emerald-300">
              {editingUnid ? t('common.save') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Ajuste de Inventario */}
      <Modal open={ajusteOpen} onClose={() => setAjusteOpen(false)} title={t('inventario.adjustStock')}>
        <div className="space-y-4">
          {ajusteTarget && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-900">{ajusteTarget.nombre}</p>
              <p className="text-xs text-gray-500 mt-1">{t('inventario.currentStockInfo')} <strong>{ajusteTarget.stock}</strong> {ajusteTarget.unidad}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('inventario.newStock')} *</label>
            <input type="number" min="0" value={ajusteStock}
              onChange={(e) => setAjusteStock(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
              autoFocus />
            {ajusteTarget && ajusteStock && (
              <p className={`text-sm text-center mt-2 ${
                Number(ajusteStock) > ajusteTarget.stock ? 'text-blue-600' :
                Number(ajusteStock) < ajusteTarget.stock ? 'text-red-600' : 'text-gray-500'
              }`}>
                {Number(ajusteStock) > ajusteTarget.stock ? `+${Number(ajusteStock) - ajusteTarget.stock} unidades` :
                 Number(ajusteStock) < ajusteTarget.stock ? `${Number(ajusteStock) - ajusteTarget.stock} unidades` : t('inventario.noChange')}
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Reason * (required)' : 'Justificación * (obligatoria)'}</label>
            <textarea rows={2} value={ajusteJustificacion}
              onChange={(e) => setAjusteJustificacion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Conteo físico, producto dañado, merma..." />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setAjusteOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
            <button onClick={ajustarStock}
              disabled={!ajusteJustificacion.trim() || ajustando || ajusteStock === '' || Number(ajusteStock) < 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
              {ajustando ? (t('inventario.adjusting')) : (t('inventario.adjustStock'))}
            </button>
          </div>
        </div>
      </Modal>

      {/* ======== HISTORIAL DE AJUSTES ======== */}
      <Modal open={showAjustes} onClose={() => setShowAjustes(false)} title={i18n.language === 'en' ? 'Adjustment History' : 'Historial de Ajustes de Inventario'}>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {ajustesHistorial.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-4">{i18n.language === 'en' ? 'No adjustments recorded' : 'No hay ajustes registrados'}</p>
          ) : (
            ajustesHistorial.map((a: any) => (
              <div key={a.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-medium text-gray-900">{a.producto_nombre}</span>
                  <span className={`font-bold ${a.diferencia > 0 ? 'text-green-600' : a.diferencia < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                    {a.diferencia > 0 ? '+' : ''}{a.diferencia}
                  </span>
                </div>
                <p className="text-xs text-gray-500">{a.justificacion}</p>
                <div className="flex justify-between text-xs text-gray-400 mt-1">
                  <span>Stock: {a.stock_anterior} → {a.stock_nuevo}</span>
                  <span>{a.usuario_nombre} • {new Date(a.fecha).toLocaleString()}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (!deleteTarget) return
          deleteTarget.type === 'producto' ? deleteProduct(deleteTarget.id) : deleteTarget.type === 'categoria' ? deleteCategory(deleteTarget.id) : deleteTarget.type === 'unidad' ? deleteUnidad(deleteTarget.id) : deleteSubcategoria(deleteTarget.id)
        }}
        title={`${t('common.delete')} ${deleteTarget?.type === 'producto' ? (i18n.language === 'en' ? 'product' : 'producto') : deleteTarget?.type === 'categoria' ? (i18n.language === 'en' ? 'category' : 'categoría') : deleteTarget?.type === 'subcategoria' ? (i18n.language === 'en' ? 'subcategory' : 'subcategoría') : (i18n.language === 'en' ? 'unit of measure' : 'unidad de medida')}`}
        message={i18n.language === 'en' ? 'This action cannot be undone. The record will be permanently deleted.' : 'Esta acción no se puede deshacer. El registro será eliminado permanentemente.'}
        confirmText={t('common.delete')}
        danger
      />
    </div>
  )
}
