import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Truck, Trash2, CheckCircle2, PackageCheck } from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { callApi } from '../lib/api-client'
import { useActiveModules } from '../hooks/useModules'

interface Remito {
  id: number; numero: number; pedido_id: number | null; cliente_id: number; fecha: string; estado: string
  observaciones: string | null; cliente_nombre: string; pedido_numero: number | null
}
interface Pedido {
  id: number; numero: string; estado: string; total: number; cliente_nombre: string
}

const ESTADO_STYLES: Record<string, string> = {
  pendiente: 'bg-yellow-100 text-yellow-700',
  despachado: 'bg-blue-100 text-blue-700',
  entregado: 'bg-green-100 text-green-700',
  anulado: 'bg-red-100 text-red-700',
}

export default function RemitosPage() {
  const { t } = useTranslation()
  const { isActive } = useActiveModules()
  const toast = useToast()

  const [remitos, setRemitos] = useState<Remito[]>([])
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [pedidoId, setPedidoId] = useState<number | null>(null)
  const [observaciones, setObservaciones] = useState('')
  const [voidTarget, setVoidTarget] = useState<Remito | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const loadData = async () => {
    const [rs, ps] = await Promise.all([
      callApi<Remito[]>('remitos:list'),
      callApi<Pedido[]>('pedidos:list').catch(() => [] as Pedido[]),
    ])
    setRemitos(rs)
    setPedidos(ps)
  }

  useEffect(() => {
    loadData().catch(() => {})
  }, [])

  const openCreate = () => {
    setPedidoId(null)
    setObservaciones('')
    setModalOpen(true)
  }

  const pedidosDisponibles = pedidos.filter(
    (p) => p.estado !== 'anulado' && !remitos.some((r) => r.pedido_id === p.id && r.estado !== 'anulado')
  )

  const save = async () => {
    if (!pedidoId) {
      toast.error(t('remitos.pedidoRequerido'))
      return
    }
    setSaving(true)
    try {
      const res = await callApi<{ success: boolean; error?: string; numero?: number }>('remitos:create', {
        pedido_id: pedidoId,
        observaciones: observaciones || undefined,
      })
      if (!res.success) throw new Error(res.error)
      toast.success(`${t('remitos.title')} #${res.numero} ${t('common.create').toLowerCase()} ✓`)
      setModalOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error generando remito')
    } finally {
      setSaving(false)
    }
  }

  const cambiarEstado = async (remito: Remito, estado: string, confirmado = false) => {
    if (estado === 'anulado' && !confirmado) {
      setVoidTarget(remito)
      return
    }
    setBusyId(remito.id)
    try {
      await callApi('remitos:update', { id: remito.id, estado })
      toast.success(`${t('remitos.title')} #${remito.numero} → ${t(`remitos.estado${estado.charAt(0).toUpperCase()}${estado.slice(1)}`)}`)
      await loadData()
    } catch (err: any) {
      toast.error(err?.message || 'Error actualizando remito')
    } finally {
      setBusyId(null)
    }
  }

  if (!isActive('distribuidor')) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
        <Truck className="w-12 h-12 mx-auto mb-3 opacity-50" />
        <p className="font-medium text-gray-500">{t('remitos.notActiveTitle')}</p>
        <p className="text-sm mt-1">{t('remitos.notActiveHint')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('remitos.title')}</h1>
          <p className="text-sm text-gray-500">{remitos.length} {t('remitos.registered')}</p>
        </div>
        <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {t('remitos.new')}
        </button>
      </div>

      {remitos.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center text-gray-400">
          <Truck className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>{t('remitos.empty')}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-semibold text-gray-500 uppercase">
                <th className="px-4 py-3">{t('remitos.colNumero')}</th>
                <th className="px-4 py-3">{t('remitos.colPedido')}</th>
                <th className="px-4 py-3">{t('remitos.colCliente')}</th>
                <th className="px-4 py-3">{t('remitos.colFecha')}</th>
                <th className="px-4 py-3">{t('remitos.colEstado')}</th>
                <th className="px-4 py-3 text-right">{t('remitos.colAcciones')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {remitos.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">#{r.numero}</td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.pedido_numero != null ? `#${r.pedido_numero}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.cliente_nombre}</td>
                  <td className="px-4 py-3 text-gray-500">{r.fecha.slice(0, 16)}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_STYLES[r.estado] || 'bg-gray-100 text-gray-600'}`}>
                      {t(`remitos.estado${r.estado.charAt(0).toUpperCase()}${r.estado.slice(1)}`)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1.5">
                      {r.estado === 'pendiente' && (
                        <>
                          <button
                            onClick={() => cambiarEstado(r, 'despachado')}
                            disabled={busyId === r.id}
                            className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                          >
                            {t('remitos.despachar')}
                          </button>
                          <button
                            onClick={() => cambiarEstado(r, 'anulado')}
                            disabled={busyId === r.id}
                            className="px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 rounded-lg hover:bg-red-100 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5 inline mr-0.5" /> {t('remitos.anular')}
                          </button>
                        </>
                      )}
                      {r.estado === 'despachado' && (
                        <button
                          onClick={() => cambiarEstado(r, 'entregado')}
                          disabled={busyId === r.id}
                          className="px-2.5 py-1 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
                        >
                          <PackageCheck className="w-3.5 h-3.5 inline mr-0.5" /> {t('remitos.entregar')}
                        </button>
                      )}
                      {r.estado === 'entregado' && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={t('remitos.new')}>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('remitos.selectPedido')} *</label>
            {pedidosDisponibles.length === 0 ? (
              <div className="bg-gray-50 rounded-lg p-6 text-center text-sm text-gray-400">{t('remitos.noPedidos')}</div>
            ) : (
              <select
                value={pedidoId ?? ''}
                onChange={(e) => setPedidoId(e.target.value ? Number(e.target.value) : null)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
              >
                <option value="">{t('remitos.selectPedido')}</option>
                {pedidosDisponibles.map((p) => (
                  <option key={p.id} value={p.id}>
                    #{p.numero} — {p.cliente_nombre}
                  </option>
                ))}
              </select>
            )}
            <p className="text-xs text-gray-400 mt-1">{t('remitos.selectPedidoHint')}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('remitos.observaciones')}</label>
            <textarea rows={2} value={observaciones} onChange={(e) => setObservaciones(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button onClick={save} disabled={saving || !pedidoId || pedidosDisponibles.length === 0}
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
        title={t('remitos.anularTitle')}
        message={t('remitos.anularMessage')}
        confirmText={t('remitos.anular')}
        danger
      />
    </div>
  )
}
