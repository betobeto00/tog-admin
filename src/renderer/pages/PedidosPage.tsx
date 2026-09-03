import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ClipboardList, Trash2, Package } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { callApi } from '../lib/api-client'
import { useActiveModules } from '../hooks/useModules'

interface Pedido {
  id: number; numero: string; cliente_id: number; fecha: string; estado: string
  subtotal: number; impuesto: number; total: number; notas: string | null
  cliente_nombre: string; lineas: number
}
interface Cliente { id: number; nombre: string }
interface ProductoCatalogo { id: number; nombre: string; precio_venta: number; stock: number; unidad: string }
interface Linea { producto_id: number | null; nombre: string; cantidad: string; precio: string }

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  despachado: 'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
  anulado: 'bg-red-100 text-red-700',
}

export default function PedidosPage() {
  const { t } = useTranslation()
  const { isActive } = useActiveModules()
  const toast = useToast()

  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [catalogo, setCatalogo] = useState<ProductoCatalogo[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [notas, setNotas] = useState('')
  const [lineas, setLineas] = useState<Linea[]>([])
  const [voidTarget, setVoidTarget] = useState<Pedido | null>(null)
  const [busyPedido, setBusyPedido] = useState<number | null>(null)

  const loadData = async () => {
    setPedidos(await callApi<Pedido[]>('pedidos:list'))
  }

  useEffect(() => {
    loadData().catch(() => {})
    callApi<Cliente[]>('clientes:list').then(setClientes).catch(() => {})
    callApi<ProductoCatalogo[]>('pedidos:catalogo').then(setCatalogo).catch(() => {})
  }, [])

  const openCreate = () => {
    setClienteId(null)
    setNotas('')
    setLineas([])
    setModalOpen(true)
  }

  const addLinea = () => {
    setLineas((prev) => [...prev, { producto_id: null, nombre: '', cantidad: '1', precio: '' }])
  }

  const setLinea = (idx: number, patch: Partial<Linea>) => {
    setLineas((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)))
  }

  const elegirProducto = (idx: number, productoId: number) => {
    const prod = catalogo.find((p) => p.id === productoId)
    if (!prod) return
    // un solo renglón por producto: si ya existe, se reemplaza
    const yaExiste = lineas.findIndex((l, i) => i !== idx && l.producto_id === productoId)
    if (yaExiste >= 0) {
      setLineas((prev) => prev.filter((_, i) => i !== idx))
      toast.info(t('pedidos.sinProductos'))
      return
    }
    setLinea(idx, {
      producto_id: prod.id,
      nombre: prod.nombre,
      precio: String(prod.precio_venta ?? ''),
    })
  }

  const subtotalLinea = (l: Linea): number => {
    const cant = Number(l.cantidad) || 0
    const precio = Number(l.precio) || 0
    return cant * precio
  }

  const subtotalTotal = lineas.reduce((acc, l) => acc + subtotalLinea(l), 0)

  const save = async () => {
    const items = lineas
      .filter((l) => l.producto_id != null && Number(l.cantidad) > 0)
      .map((l) => ({ producto_id: l.producto_id as number, cantidad: Number(l.cantidad), precio: Number(l.precio) || 0 }))
    if (!clienteId) {
      toast.error(t('pedidos.selectCliente'))
      return
    }
    if (!items.length) {
      toast.error(t('pedidos.sinProductos'))
      return
    }
    setSaving(true)
    try {
      const res = await callApi<{ success: boolean; error?: string; numero?: number }>('pedidos:create', {
        cliente_id: clienteId,
        notas: notas || undefined,
        items,
      })
      if (!res.success) throw new Error(res.error)
      toast.success(`${t('pedidos.title')} #${res.numero} ${t('common.create').toLowerCase()} ✓`)
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error creando pedido')
    } finally {
      setSaving(false)
    }
  }

  const cambiarEstado = async (pedido: Pedido, estado: string, confirmado = false) => {
    if (estado === 'anulado' && !confirmado) {
      setVoidTarget(pedido)
      return
    }
    setBusyPedido(pedido.id)
    try {
      await callApi('pedidos:update', { id: pedido.id, estado })
      toast.success(`${t('pedidos.title')} #${pedido.numero} → ${t('pedidos.estado' + estado.charAt(0).toUpperCase() + estado.slice(1))}`)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error actualizando pedido')
    } finally {
      setBusyPedido(null)
    }
  }

  const fmt = (n: number) => n.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  if (!isActive('distribuidor')) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('pedidos.notActiveTitle')}</p>
        <p className="text-sm mt-1">{t('pedidos.notActiveHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('pedidos.title')}</h1>
          <p className="text-sm text-gray-500">{pedidos.length} {t('pedidos.registered')}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('pedidos.new')}
        </button>
      </div>

      {pedidos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <ClipboardList className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('pedidos.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">{t('pedidos.colPedido')}</th>
                <th className="px-4 py-3">{t('pedidos.colCliente')}</th>
                <th className="px-4 py-3">{t('pedidos.colFecha')}</th>
                <th className="px-4 py-3">{t('pedidos.colLineas')}</th>
                <th className="px-4 py-3 text-right">{t('pedidos.colTotal')}</th>
                <th className="px-4 py-3">{t('pedidos.colEstado')}</th>
                <th className="px-4 py-3 text-right">{t('pedidos.colAcciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pedidos.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{p.numero}</td>
                  <td className="px-4 py-3 text-gray-700">{p.cliente_nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{p.fecha.slice(0, 16)}</td>
                  <td className="px-4 py-3 text-gray-500">{p.lineas}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900">{fmt(p.total)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLES[p.estado] || 'bg-gray-100 text-gray-600'}`}>
                      {t(`pedidos.estado${p.estado.charAt(0).toUpperCase()}${p.estado.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {p.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={() => cambiarEstado(p, 'despachado')}
                            disabled={busyPedido === p.id}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {t('pedidos.despachar')}
                          </button>
                          <button
                            onClick={() => cambiarEstado(p, 'anulado')}
                            disabled={busyPedido === p.id}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-0.5" /> {t('pedidos.anular')}
                          </button>
                        </>
                      )}
                      {p.estado === 'despachado' && (
                        <button
                          onClick={() => cambiarEstado(p, 'entregado')}
                          disabled={busyPedido === p.id}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          {t('pedidos.entregar')}
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

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('pedidos.new')} wide>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('pedidos.clienteLabel')} *</label>
            <select
              value={clienteId ?? ''}
              onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="">{t('pedidos.selectCliente')}</option>
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">{t('pedidos.title')}</label>
              <button onClick={addLinea} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100">
                <Plus className="w-3.5 h-3.5" /> {t('pedidos.agregarProducto')}
              </button>
            </div>

            {lineas.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-400 flex flex-col items-center gap-1">
                <Package className="w-6 h-6 opacity-50" />
                {t('pedidos.sinProductos')}
              </div>
            ) : (
              <div className="space-y-2">
                {lineas.map((l, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg p-2">
                    <select
                      value={l.producto_id ?? ''}
                      onChange={(e) => elegirProducto(idx, Number(e.target.value))}
                      className="flex-1 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm bg-white"
                    >
                      <option value="">{t('pedidos.selectProducto')}</option>
                      {catalogo.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre} — {fmt(p.precio_venta)}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.cantidad}
                      onChange={(e) => setLinea(idx, { cantidad: e.target.value })}
                      title={t('pedidos.cantidad')}
                      className="w-20 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={l.precio}
                      onChange={(e) => setLinea(idx, { precio: e.target.value })}
                      title={t('pedidos.precio')}
                      className="w-24 px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm"
                    />
                    <span className="w-20 text-right text-sm font-medium text-gray-700">{fmt(subtotalLinea(l))}</span>
                    <button onClick={() => setLineas((prev) => prev.filter((_, i) => i !== idx))} className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 mt-1">{t('pedidos.nuevoPedidoHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')}</label>
            <textarea rows={2} value={notas} onChange={(e) => setNotas(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-100">
            <span className="text-sm text-gray-500 mr-auto">{t('pedidos.subtotal')}:</span>
            <span className="text-lg font-bold text-gray-900">{fmt(subtotalTotal)}</span>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving || !clienteId || !lineas.some((l) => l.producto_id && Number(l.cantidad) > 0)}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
              {saving ? t('common.saving') : t('common.create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!voidTarget}
        onClose={() => setVoidTarget(null)}
        onConfirm={() => {
          if (voidTarget) cambiarEstado(voidTarget, 'anulado', true)
          setVoidTarget(null)
        }}
        title={t('pedidos.anularTitle')}
        message={t('pedidos.anularMessage')}
        confirmText={t('pedidos.anular')}
        danger
      />
    </div>
  )
}
