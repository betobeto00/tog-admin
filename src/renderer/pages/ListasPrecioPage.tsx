import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Tag, Trash2, Pencil, Package, Users } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { callApi } from '../lib/api-client'
import { useActiveModules } from '../hooks/useModules'
import { formatCurrency } from '../lib/utils'

interface ListaPrecio {
  id: number; nombre: string; factor: number; activo: number
}
interface ProductoAsignado { id: number; lista_id: number; producto_id: number; precio_override: number | null; producto_nombre: string; precio_venta: number; unidad: string }
interface ProductoDisponible { id: number; nombre: string; precio_venta: number; unidad: string }
interface ClienteAsignado { lista_id: number; cliente_id: number; nombre: string; documento: string | null }
interface ClienteDisponible { id: number; nombre: string; documento: string | null }

type Tab = 'listas' | 'productos' | 'clientes'

export default function ListasPrecioPage() {
  const { t } = useTranslation()
  const { isActive } = useActiveModules()
  const toast = useToast()

  const [listas, setListas] = useState<ListaPrecio[]>([])
  const [tab, setTab] = useState<Tab>('listas')
  const [selectedListId, setSelectedListId] = useState<number | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<ListaPrecio | null>(null)
  const [saving, setSaving] = useState(false)
  const [nombre, setNombre] = useState('')
  const [factor, setFactor] = useState('1')
  const [deleteTarget, setDeleteTarget] = useState<ListaPrecio | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const [productos, setProductos] = useState<ProductoAsignado[]>([])
  const [todosProductos, setTodosProductos] = useState<ProductoDisponible[]>([])
  const [productoSearch, setProductoSearch] = useState('')
  const [productoPick, setProductoPick] = useState<ProductoDisponible | null>(null)
  const [precioOverride, setPrecioOverride] = useState('')

  const [clientesAsignados, setClientesAsignados] = useState<ClienteAsignado[]>([])
  const [todosClientes, setTodosClientes] = useState<ClienteDisponible[]>([])
  const [clienteSearch, setClienteSearch] = useState('')

  const loadData = async () => {
    setListas(await callApi<ListaPrecio[]>('listas-precio:list'))
  }

  const loadProductos = async (listaId: number) => {
    const [asignados, todos] = await Promise.all([
      callApi<ProductoAsignado[]>('listas-precio:productos', { lista_id: listaId }),
      callApi<ProductoDisponible[]>('productos:list'),
    ])
    setProductos(asignados)
    setTodosProductos(Array.isArray(todos) ? todos : [])
  }

  const loadClientes = async (listaId: number) => {
    const [asignados, todos] = await Promise.all([
      callApi<ClienteAsignado[]>('listas-precio:clientes', { lista_id: listaId }),
      callApi<ClienteDisponible[]>('clientes:list'),
    ])
    setClientesAsignados(asignados)
    setTodosClientes(Array.isArray(todos) ? todos : [])
  }

  useEffect(() => {
    loadData().catch(() => {})
  }, [])

  useEffect(() => {
    if (selectedListId) {
      if (tab === 'productos') loadProductos(selectedListId)
      if (tab === 'clientes') loadClientes(selectedListId)
    }
  }, [selectedListId, tab])

  const openCreate = () => {
    setEditing(null)
    setNombre('')
    setFactor('1')
    setModalOpen(true)
  }

  const openEdit = (l: ListaPrecio) => {
    setEditing(l)
    setNombre(l.nombre)
    setFactor(String(l.factor))
    setModalOpen(true)
  }

  const save = async () => {
    const factorNum = Number(factor)
    if (!nombre.trim()) {
      toast.error(t('listasPrecio.nameRequired'))
      return
    }
    if (!factorNum || factorNum <= 0) {
      toast.error(t('listasPrecio.factorRequired'))
      return
    }
    setSaving(true)
    try {
      const res = editing
        ? await callApi<{ success: boolean; error?: string }>('listas-precio:update', { id: editing.id, data: { nombre: nombre.trim(), factor: factorNum } })
        : await callApi<{ success: boolean; error?: string }>('listas-precio:create', { nombre: nombre.trim(), factor: factorNum })
      if (!res.success) throw new Error(res.error)
      toast.success(editing ? t('common.update') + ' ✓' : t('common.create') + ' ✓')
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error guardando lista')
    } finally {
      setSaving(false)
    }
  }

  const toggleActivo = async (l: ListaPrecio) => {
    setBusyId(l.id)
    try {
      await callApi('listas-precio:update', { id: l.id, data: { activo: l.activo ? 0 : 1 } })
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error actualizando lista')
    } finally {
      setBusyId(null)
    }
  }

  const eliminar = async () => {
    if (!deleteTarget) return
    setBusyId(deleteTarget.id)
    try {
      await callApi('listas-precio:delete', { id: deleteTarget.id })
      toast.success(t('common.delete') + ' ✓')
      if (selectedListId === deleteTarget.id) setSelectedListId(null)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error eliminando lista')
    } finally {
      setBusyId(null)
      setDeleteTarget(null)
    }
  }

  const setProducto = async () => {
    if (!selectedListId || !productoPick) return
    const precio = precioOverride === '' ? null : Number(precioOverride)
    if (precio !== null && (isNaN(precio) || precio < 0)) {
      toast.error('Precio inválido')
      return
    }
    await callApi('listas-precio:set-producto', { lista_id: selectedListId, producto_id: productoPick.id, precio_override: precio })
    setProductoPick(null)
    setPrecioOverride('')
    setProductoSearch('')
    await loadProductos(selectedListId)
  }

  const quitarProducto = async (prodId: number) => {
    if (!selectedListId) return
    await callApi('listas-precio:set-producto', { lista_id: selectedListId, producto_id: prodId, precio_override: null })
    await loadProductos(selectedListId)
  }

  const asignarCliente = async (clienteId: number) => {
    if (!selectedListId) return
    await callApi('listas-precio:set-cliente', { lista_id: selectedListId, cliente_id: clienteId })
    await loadClientes(selectedListId)
  }

  const quitarCliente = async (clienteId: number) => {
    if (!selectedListId) return
    await callApi('listas-precio:unset-cliente', { lista_id: selectedListId, cliente_id: clienteId })
    await loadClientes(selectedListId)
  }

  const fmtFactor = (f: number) => f.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const productosFiltrados = productoSearch.trim()
    ? todosProductos.filter((p) => p.nombre.toLowerCase().includes(productoSearch.toLowerCase()) && !productos.some((a) => a.producto_id === p.id)).slice(0, 8)
    : []
  const clientesFiltrados = clienteSearch.trim()
    ? todosClientes.filter((c) => (c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()) || (c.documento && c.documento.toLowerCase().includes(clienteSearch.toLowerCase()))) && !clientesAsignados.some((a) => a.cliente_id === c.id)).slice(0, 8)
    : []

  if (!isActive('distribuidor')) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <Tag className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('listasPrecio.notActiveTitle')}</p>
        <p className="text-sm mt-1">{t('listasPrecio.notActiveHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('listasPrecio.title')}</h1>
          <p className="text-sm text-gray-500">{listas.length} {t('listasPrecio.registered')}</p>
        </div>
        {tab === 'listas' && (
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> {t('listasPrecio.new')}
          </button>
        )}
      </div>

      <div className="flex border-b border-gray-200">
        <button onClick={() => setTab('listas')} className={`px-4 py-2 text-sm font-medium ${tab === 'listas' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`}>
          <Tag className="w-4 h-4 inline mr-1" /> Listas
        </button>
        <button onClick={() => setTab('productos')} className={`px-4 py-2 text-sm font-medium ${tab === 'productos' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`} disabled={listas.length === 0}>
          <Package className="w-4 h-4 inline mr-1" /> Productos
        </button>
        <button onClick={() => setTab('clientes')} className={`px-4 py-2 text-sm font-medium ${tab === 'clientes' ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500'}`} disabled={listas.length === 0}>
          <Users className="w-4 h-4 inline mr-1" /> Clientes
        </button>
      </div>

      {tab === 'listas' && (
        <>
          {listas.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
              <Tag className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{t('listasPrecio.empty')}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                    <th className="px-4 py-3">{t('listasPrecio.colNombre')}</th>
                    <th className="px-4 py-3">{t('listasPrecio.colFactor')}</th>
                    <th className="px-4 py-3">{t('listasPrecio.colEstado')}</th>
                    <th className="px-4 py-3 text-right">{t('listasPrecio.colAcciones')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {listas.map((l) => (
                    <tr key={l.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900">{l.nombre}</td>
                      <td className="px-4 py-3 text-gray-700">{fmtFactor(l.factor)}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                            l.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                          }`}
                          onClick={() => toggleActivo(l)}
                          title={l.activo ? t('listasPrecio.desactivar') : t('listasPrecio.activar')}
                        >
                          {l.activo ? t('listasPrecio.activo') : t('listasPrecio.inactivo')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => { setSelectedListId(l.id); setTab('productos') }}
                            disabled={busyId === l.id}
                            className="px-2.5 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                            title="Asignar productos"
                          >
                            <Package className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => { setSelectedListId(l.id); setTab('clientes') }}
                            disabled={busyId === l.id}
                            className="px-2.5 py-1 text-xs font-medium text-emerald-600 bg-emerald-50 rounded-lg hover:bg-emerald-100 disabled:opacity-50"
                            title="Asignar clientes"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => openEdit(l)}
                            disabled={busyId === l.id}
                            className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50"
                          >
                            <Pencil className="w-3.5 h-3.5 inline mr-0.5" /> {t('listasPrecio.edit')}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(l)}
                            disabled={busyId === l.id}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-0.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'productos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lista</label>
            <select value={selectedListId ?? ''} onChange={(e) => setSelectedListId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Selecciona una lista…</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre} (factor {fmtFactor(l.factor)})</option>)}
            </select>
          </div>
          {selectedListId && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-sm font-semibold text-gray-700">Asignar producto a esta lista</p>
                <div className="flex gap-2 items-end">
                  <div className="flex-1 relative">
                    <input value={productoSearch} onChange={(e) => setProductoSearch(e.target.value)}
                      placeholder="Buscar producto..."
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                    {productosFiltrados.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {productosFiltrados.map((p) => (
                          <button key={p.id} onClick={() => { setProductoPick(p); setPrecioOverride(String(p.precio_venta)) }}
                            className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                            <span className="truncate">{p.nombre}</span>
                            <span className="text-xs text-gray-400">{formatCurrency(p.precio_venta)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-500 mb-1">Precio override</label>
                    <input type="number" step="0.01" min="0" value={precioOverride} onChange={(e) => setPrecioOverride(e.target.value)}
                      placeholder="(vacío = usa base)" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  </div>
                  <button onClick={setProducto} disabled={!productoPick}
                    className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                    Asignar
                  </button>
                </div>
                {productoPick && <p className="text-xs text-gray-500">Producto seleccionado: {productoPick.nombre} (base {formatCurrency(productoPick.precio_venta)})</p>}
              </div>

              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3">Producto</th>
                      <th className="px-4 py-3 text-right">Precio base</th>
                      <th className="px-4 py-3 text-right">Precio en esta lista</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {productos.length === 0 ? (
                      <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">Sin productos asignados a esta lista.</td></tr>
                    ) : productos.map((p) => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{p.producto_nombre}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(p.precio_venta)}</td>
                        <td className="px-4 py-3 text-right font-medium text-blue-600">{p.precio_override != null ? formatCurrency(p.precio_override) : '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => quitarProducto(p.producto_id)}
                            className="px-2 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100">
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {tab === 'clientes' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-3">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Lista</label>
            <select value={selectedListId ?? ''} onChange={(e) => setSelectedListId(Number(e.target.value) || null)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm">
              <option value="">Selecciona una lista…</option>
              {listas.map((l) => <option key={l.id} value={l.id}>{l.nombre}</option>)}
            </select>
          </div>
          {selectedListId && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-3">
                <p className="text-sm font-semibold text-gray-700 mb-2">Asignar cliente a esta lista</p>
                <input value={clienteSearch} onChange={(e) => setClienteSearch(e.target.value)}
                  placeholder="Buscar cliente por nombre o documento..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                {clientesFiltrados.length > 0 && (
                  <div className="mt-2 border border-gray-200 rounded-lg max-h-48 overflow-y-auto">
                    {clientesFiltrados.map((c) => (
                      <button key={c.id} onClick={() => { asignarCliente(c.id); setClienteSearch('') }}
                        className="w-full flex items-center justify-between px-3 py-2 hover:bg-blue-50 text-left text-sm">
                        <span>{c.nombre}</span>
                        {c.documento && <span className="text-xs text-gray-400">{c.documento}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">Documento</th>
                      <th className="px-4 py-3 text-right">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {clientesAsignados.length === 0 ? (
                      <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-400">Sin clientes asignados.</td></tr>
                    ) : clientesAsignados.map((c) => (
                      <tr key={c.cliente_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">{c.nombre}</td>
                        <td className="px-4 py-3 text-gray-500">{c.documento || '—'}</td>
                        <td className="px-4 py-3 text-right">
                          <button onClick={() => quitarCliente(c.cliente_id)}
                            className="px-2 py-1 text-xs text-red-600 bg-red-50 rounded hover:bg-red-100">Quitar</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? `${t('listasPrecio.edit')} — ${editing.nombre}` : t('listasPrecio.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('listasPrecio.nameLabel')} *</label>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder={t('listasPrecio.nameLabel')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('listasPrecio.factorLabel')} *</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={factor}
              onChange={(e) => setFactor(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <p className="text-xs text-gray-400 mt-1">{t('listasPrecio.factorHint')}</p>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('common.saving') : editing ? t('common.update') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={eliminar}
        title={t('listasPrecio.deleteTitle')}
        message={`${t('listasPrecio.deleteMessage')} "${deleteTarget?.nombre}"`}
        confirmText={t('common.delete')}
        danger
      />
    </div>
  )
}
