import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth.store'
import {
  Plus, Search, Edit2, Trash2, Package, Tag,
  ChevronDown, AlertTriangle, Filter, Download, Upload, History, EyeOff
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency } from '../lib/utils'

interface Producto {
  id: number; codigo_barras: string | null; sku: string | null
  nombre: string; descripcion: string | null; categoria_id: number | null
  precio_compra: number; precio_venta: number; stock: number
  stock_minimo: number; unidad: string; activo: number
  categoria_nombre: string | null
}
interface Categoria { id: number; nombre: string; descripcion: string | null; activo: number }
interface UnidadMedida { id: number; nombre: string; abreviatura: string | null; activo: number }

const emptyProduct = {
  nombre: '', codigo_barras: '', sku: '', descripcion: '',
  categoria_id: 0, precio_compra: 0, precio_venta: 0,
  stock: 0, stock_minimo: 5, unidad: 'unidad',
}

export default function InventarioPage() {
  const { t, i18n } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const [productos, setProductos] = useState<Producto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [unidades, setUnidades] = useState<UnidadMedida[]>([])
  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState<number>(0)
  const [showCat, setShowCat] = useState(false)
  const [showUnid, setShowUnid] = useState(false)

  // Modal producto
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Producto | null>(null)
  const [form, setForm] = useState(emptyProduct)
  const [saving, setSaving] = useState(false)

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
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'producto' | 'categoria' | 'unidad'; id: number } | null>(null)

  // Import/Export CSV
  const [importing, setImporting] = useState(false)

  // Filtro sin stock
  const [filterSinStock, setFilterSinStock] = useState(false)

  // Historial de ajustes
  const [showAjustes, setShowAjustes] = useState(false)
  const [ajustesHistorial, setAjustesHistorial] = useState<any[]>([])

  useEffect(() => { loadData() }, [])

  const loadData = async () => {
    const [prods, cats, unids] = await Promise.all([
      window.api.productos.list(),
      window.api.categorias.list(),
      window.api.unidades.list(),
    ])
    setProductos(prods)
    setCategorias(cats)
    setUnidades(unids)
  }

  // Filtrar productos
  const filtered = productos.filter((p) => {
    const matchSearch = !search ||
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.codigo_barras?.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.toLowerCase().includes(search.toLowerCase())
    const matchCat = !filterCat || p.categoria_id === filterCat
    const matchStock = !filterSinStock || (p.stock <= p.stock_minimo)
    return matchSearch && matchCat && matchStock
  })

  // ======== IMPORT/EXPORT CSV ========
  const exportCsv = async () => {
    const result = await window.api.productos.exportCsv()
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
        const result = await window.api.productos.importCsv(file.path)
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
    const hist = await window.api.productos.ajustesHistorial({ limite: 50 })
    setAjustesHistorial(hist)
    setShowAjustes(true)
  }

  // ======== PRODUCTOS ========

  const openCreate = () => {
    setEditing(null)
    setForm(emptyProduct)
    setModalOpen(true)
  }

  const openEdit = (p: Producto) => {
    setEditing(p)
    setForm({
      nombre: p.nombre,
      codigo_barras: p.codigo_barras || '',
      sku: p.sku || '',
      descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || 0,
      precio_compra: p.precio_compra,
      precio_venta: p.precio_venta,
      stock: p.stock,
      stock_minimo: p.stock_minimo,
      unidad: p.unidad,
    })
    setModalOpen(true)
  }

  const saveProduct = async () => {
    if (!form.nombre.trim()) return
    setSaving(true)
    try {
      const data = {
        ...form,
        codigo_barras: form.codigo_barras || undefined,
        sku: form.sku || undefined,
        descripcion: form.descripcion || undefined,
        categoria_id: form.categoria_id || undefined,
      }
      if (editing) {
        await window.api.productos.update(editing.id, data)
      } else {
        await window.api.productos.create(data)
      }
      setModalOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  const deleteProduct = async (id: number) => {
    await window.api.productos.delete(id)
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
      const result = await window.api.productos.ajustar({
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
      await window.api.categorias.update(editingCat.id, catForm)
    } else {
      await window.api.categorias.create(catForm)
    }
    setCatModalOpen(false)
    await loadData()
  }

  const deleteCategory = async (id: number) => {
    await window.api.categorias.delete(id)
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
      await window.api.unidades.update(editingUnid.id, unidForm)
    } else {
      await window.api.unidades.create(unidForm)
    }
    setUnidModalOpen(false)
    await loadData()
  }

  const deleteUnidad = async (id: number) => {
    await window.api.unidades.delete(id)
    await loadData()
  }

  // Quick-add: crear unidad desde el dropdown del producto
  const quickAddUnidad = async () => {
    if (!quickUnidad.nombre.trim()) return
    const result = await window.api.unidades.create(quickUnidad)
    setQuickUnidad({ nombre: '', abreviatura: '' })
    setShowQuickUnidad(false)
    await loadData()
    // Seleccionar la unidad recién creada
    setForm({ ...form, unidad: quickUnidad.nombre })
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
            onClick={() => { setShowCat(!showCat); setShowUnid(false) }}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
              showCat ? 'bg-purple-50 border-purple-300 text-purple-700' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}>
            <Tag className="w-4 h-4" /> {i18n.language === 'en' ? 'Categories' : 'Categorías'}
          </button>
          <button
            onClick={() => { setShowUnid(!showUnid); setShowCat(false) }}
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
          <button
            onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" /> {t('inventario.newProduct')}
          </button>
        </div>
      </div>

      {/* Panel de categorías (toggle) */}
      {showCat && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-800">{i18n.language === 'en' ? 'Categories' : 'Categorías'}</h3>
            <button onClick={openCreateCat} className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
              <Plus className="w-4 h-4" /> {i18n.language === 'en' ? 'Add' : 'Agregar'}
            </button>
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
            <button onClick={openCreateUnid} className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <Plus className="w-4 h-4" /> {i18n.language === 'en' ? 'Add Unit' : 'Agregar Unidad'}
            </button>
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
          <EyeOff className="w-4 h-4" /> {i18n.language === 'en' ? 'Low Stock' : 'Stock Bajo'}
        </button>
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{i18n.language === 'en' ? 'Product' : 'Producto'}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{i18n.language === 'en' ? 'Category' : 'Categoría'}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{i18n.language === 'en' ? 'Cost' : 'Compra'}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{i18n.language === 'en' ? 'Sale' : 'Venta'}</th>
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
                    <div>
                      <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                      {p.codigo_barras && <p className="text-xs text-gray-400">CB: {p.codigo_barras}</p>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{p.categoria_nombre || '—'}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(p.precio_compra)}</td>
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
                      <button onClick={() => openAjuste(p)} className="p-1.5 hover:bg-blue-50 rounded-lg" title={i18n.language === 'en' ? 'Adjust stock' : 'Ajustar stock'}>
                        <Package className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('common.edit')}>
                        <Edit2 className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => setDeleteTarget({ type: 'producto', id: p.id })} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('common.delete')}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Producto */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('inventario.editProduct') : t('inventario.newProduct')} wide>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
              <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Barcode' : 'Código de barras'}</label>
              <input value={form.codigo_barras} onChange={(e) => setForm({ ...form, codigo_barras: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
              <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Category' : 'Categoría'}</label>
              <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500">
                <option value={0}>{i18n.language === 'en' ? 'No category' : 'Sin categoría'}</option>
                {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Cost Price' : 'Precio Compra'}</label>
              <input type="number" step="0.01" min="0" value={form.precio_compra}
                onChange={(e) => setForm({ ...form, precio_compra: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Sale Price' : 'Precio Venta'} *</label>
              <input type="number" step="0.01" min="0" value={form.precio_venta}
                onChange={(e) => setForm({ ...form, precio_venta: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
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
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')}</label>
              <textarea rows={2} value={form.descripcion}
                onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
            </div>
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

      {/* Modal Categoría */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? t('inventario.editProduct') + ' ' + (i18n.language === 'en' ? 'Category' : 'Categoría') : i18n.language === 'en' ? 'New Category' : 'Nueva Categoría'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nombre *</label>
            <input value={catForm.nombre} onChange={(e) => setCatForm({ ...catForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="Ej: Papelería" autoFocus />
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
      <Modal open={ajusteOpen} onClose={() => setAjusteOpen(false)} title={i18n.language === 'en' ? 'Adjust Stock' : 'Ajustar Stock'}>
        <div className="space-y-4">
          {ajusteTarget && (
            <div className="bg-blue-50 rounded-xl p-4">
              <p className="text-sm font-medium text-gray-900">{ajusteTarget.nombre}</p>
              <p className="text-xs text-gray-500 mt-1">Stock actual: <strong>{ajusteTarget.stock}</strong> {ajusteTarget.unidad}</p>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'New Stock' : 'Nuevo Stock'} *</label>
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
                 Number(ajusteStock) < ajusteTarget.stock ? `${Number(ajusteStock) - ajusteTarget.stock} unidades` : 'Sin cambio'}
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
              {ajustando ? (i18n.language === 'en' ? 'Adjusting...' : 'Ajustando...') : (i18n.language === 'en' ? 'Adjust Stock' : 'Ajustar Stock')}
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
          deleteTarget.type === 'producto' ? deleteProduct(deleteTarget.id) : deleteTarget.type === 'categoria' ? deleteCategory(deleteTarget.id) : deleteUnidad(deleteTarget.id)
        }}
        title={`${t('common.delete')} ${deleteTarget?.type === 'producto' ? (i18n.language === 'en' ? 'product' : 'producto') : deleteTarget?.type === 'categoria' ? (i18n.language === 'en' ? 'category' : 'categoría') : (i18n.language === 'en' ? 'unit of measure' : 'unidad de medida')}`}
        message={i18n.language === 'en' ? 'This action cannot be undone. The record will be permanently deleted.' : 'Esta acción no se puede deshacer. El registro será eliminado permanentemente.'}
        confirmText={t('common.delete')}
        danger
      />
    </div>
  )
}
