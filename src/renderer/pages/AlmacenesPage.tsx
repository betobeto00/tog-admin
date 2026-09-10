import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Warehouse, Trash2, Save, X, ArrowRightLeft } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { callApi } from '../lib/api-client'

interface Almacen { id: number; nombre: string; direccion: string | null; activo: number }
interface StockRow {
  producto_id: number; almacen_id: number; stock: number
  producto_nombre: string; unidad: string; almacen_nombre: string
}
interface Producto { id: number; nombre: string; unidad: string; stock: number; tipo: string }

export default function AlmacenesPage() {
  const { t, i18n } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()

  const [almacenes, setAlmacenes] = useState<Almacen[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [form, setForm] = useState({ nombre: '', direccion: '' })
  const [voidTarget, setVoidTarget] = useState<Almacen | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferForm, setTransferForm] = useState({ producto_id: 0, origen_id: 0, destino_id: 0, cantidad: '' })
  const [productos, setProductos] = useState<Producto[]>([])

  const load = async () => {
    const [as, ss] = await Promise.all([
      callApi<Almacen[]>('almacenes:list'),
      callApi<StockRow[]>('almacenes:stock'),
    ])
    setAlmacenes(as)
    setStock(ss)
  }

  useEffect(() => { load().catch(() => {}) }, [])

  const save = async () => {
    if (!form.nombre.trim()) return
    try {
      await callApi('almacenes:create', { nombre: form.nombre.trim(), direccion: form.direccion.trim() || undefined })
      setCreateOpen(false)
      setForm({ nombre: '', direccion: '' })
      await load()
      toast.success(t('common.save') + ' ✓')
    } catch (err: any) {
      toast.error(err?.message || 'Error')
    }
  }

  const remove = async (a: Almacen) => {
    try {
      const res: any = await callApi('almacenes:delete', { id: a.id })
      if (res?.success === false) { toast.error(res.error || 'Error'); return }
      setVoidTarget(null)
      await load()
    } catch (err: any) { toast.error(err?.message || 'Error') }
  }

  const stockPorAlmacen = (id: number) => stock.filter((s) => s.almacen_id === id)

  const openTransfer = async () => {
    const prods = await callApi<Producto[]>('productos:list')
    setProductos(prods)
    setTransferForm({ producto_id: 0, origen_id: 0, destino_id: 0, cantidad: '' })
    setTransferOpen(true)
  }

  const doTransfer = async () => {
    const { producto_id, origen_id, destino_id, cantidad } = transferForm
    if (!producto_id || !origen_id || !destino_id || !cantidad) return
    try {
      const res: any = await callApi('almacenes:transfer', { producto_id, origen_id, destino_id, cantidad: parseFloat(cantidad) })
      if (res?.success === false) { toast.error(res.error || 'Error'); return }
      setTransferOpen(false)
      await load()
      toast.success(i18n.language === 'en' ? 'Transfer completed ✓' : 'Transferencia completada ✓')
    } catch (err: any) { toast.error(err?.message || 'Error') }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('almacenes.title')}</h1>
          <p className="text-sm text-gray-500">{almacenes.length} {t('almacenes.registered')}</p>
        </div>
        {has('inventario_create') && (
          <div className="flex gap-2">
            <button onClick={openTransfer} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              <ArrowRightLeft className="w-4 h-4" /> {i18n.language === 'en' ? 'Transfer' : 'Transferir'}
            </button>
            <button onClick={() => setCreateOpen(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Plus className="w-4 h-4" /> {t('almacenes.new')}
            </button>
          </div>
        )}
      </div>

      {almacenes.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Warehouse className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('almacenes.empty')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {almacenes.map((a) => {
            const items = stockPorAlmacen(a.id)
            return (
              <div key={a.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{a.nombre}</h3>
                    {a.direccion && <p className="text-xs text-gray-500">{a.direccion}</p>}
                  </div>
                  {a.id !== 1 && has('inventario_delete') && (
                    <button onClick={() => setVoidTarget(a)} className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mb-2">{items.length} {t('almacenes.products')}</p>
                {items.length > 0 && (
                  <div className="max-h-40 overflow-y-auto divide-y divide-gray-100 text-sm">
                    {items.slice(0, 20).map((s) => (
                      <div key={`${s.producto_id}-${s.almacen_id}`} className="flex items-center justify-between py-1">
                        <span className="truncate">{s.producto_nombre}</span>
                        <span className="text-xs text-gray-500 ml-2">{s.stock} {s.unidad}</span>
                      </div>
                    ))}
                  </div>
                )}
                {a.id === 1 && (
                  <p className="text-xs text-gray-400 italic mt-2">{t('almacenes.principalHint')}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title={t('almacenes.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('almacenes.name')} *</label>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder={t('almacenes.namePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('almacenes.address')}</label>
            <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <p className="text-xs text-gray-500">
            {t('almacenes.hookHint')}
          </p>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setCreateOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">
              <X className="w-4 h-4 inline" /> {t('common.cancel')}
            </button>
            <button onClick={save} disabled={!form.nombre.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              <Save className="w-4 h-4 inline" /> {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={i18n.language === 'en' ? 'Transfer Stock' : 'Transferir Stock'}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Product' : 'Producto'} *</label>
            <select value={transferForm.producto_id} onChange={(e) => setTransferForm({ ...transferForm, producto_id: Number(e.target.value) })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value={0}>{i18n.language === 'en' ? 'Select product' : 'Seleccionar producto'}</option>
              {productos.filter((p) => p.tipo === 'producto').map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'From' : 'Origen'} *</label>
              <select value={transferForm.origen_id} onChange={(e) => setTransferForm({ ...transferForm, origen_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value={0}>{i18n.language === 'en' ? 'Select' : 'Seleccionar'}</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'To' : 'Destino'} *</label>
              <select value={transferForm.destino_id} onChange={(e) => setTransferForm({ ...transferForm, destino_id: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value={0}>{i18n.language === 'en' ? 'Select' : 'Seleccionar'}</option>
                {almacenes.map((a) => <option key={a.id} value={a.id}>{a.nombre}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{i18n.language === 'en' ? 'Quantity' : 'Cantidad'} *</label>
            <input type="number" min="0.01" step="0.01" value={transferForm.cantidad}
              onChange={(e) => setTransferForm({ ...transferForm, cantidad: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setTransferOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">
              <X className="w-4 h-4 inline" /> {t('common.cancel')}
            </button>
            <button onClick={doTransfer}
              disabled={!transferForm.producto_id || !transferForm.origen_id || !transferForm.destino_id || !transferForm.cantidad || transferForm.origen_id === transferForm.destino_id}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              <ArrowRightLeft className="w-4 h-4 inline" /> {i18n.language === 'en' ? 'Transfer' : 'Transferir'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => { if (voidTarget) remove(voidTarget) }}
        title={t('almacenes.deleteTitle')}
        message={t('almacenes.deleteMsg')}
        confirmText={t('common.delete')}
        danger
      />
    </div>
  )
}
