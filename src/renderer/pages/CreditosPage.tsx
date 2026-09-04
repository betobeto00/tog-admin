import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Wallet, Eye, User, Calendar, Hash, Plus, CheckCircle2, XCircle, Clock } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDateTime, formatTicketNumber } from '../lib/utils'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { callApi } from '../lib/api-client'

interface Credito {
  id: number
  venta_id: number
  cliente_id: number | null
  cliente_nombre: string | null
  deudor_nombre: string | null
  deudor_telefono: string | null
  deudor_documento: string | null
  monto_total: number
  saldo: number
  fecha: string
  estado: 'pendiente' | 'pagado' | 'anulado'
  numero_venta: number | null
}

interface CreditoDetalle extends Credito {
  venta_fecha: string | null
  abonos: { id: number; monto: number; fecha: string; usuario_nombre: string | null; notas: string | null }[]
  detalles: { id: number; producto_nombre: string | null; descripcion: string | null; cantidad: number; precio_unitario: number; subtotal: number }[]
}

const FILTERS = [
  { value: 'pendiente', key: 'pending' },
  { value: '', key: 'all' },
  { value: 'pagado', key: 'paid' },
  { value: 'anulado', key: 'voided' },
] as const

export default function CreditosPage() {
  const { t } = useTranslation()
  const { has } = usePermissions()
  const toast = useToast()
  const [creditos, setCreditos] = useState<Credito[]>([])
  const [loading, setLoading] = useState(true)
  const [estado, setEstado] = useState<string>('pendiente')
  const [search, setSearch] = useState('')
  const [detalle, setDetalle] = useState<CreditoDetalle | null>(null)
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [abonoTarget, setAbonoTarget] = useState<Credito | null>(null)
  const [abonoOpen, setAbonoOpen] = useState(false)
  const [abonoMonto, setAbonoMonto] = useState('')
  const [abonoNotas, setAbonoNotas] = useState('')
  const [registrando, setRegistrando] = useState(false)

  useEffect(() => { loadData() }, [estado, search])

  const loadData = async () => {
    setLoading(true)
    try {
      const data = await callApi<Credito[]>('creditos:list', {
        estado: estado || undefined,
        search: search.trim() || undefined,
      })
      setCreditos(data)
    } finally {
      setLoading(false)
    }
  }

  const estadoBadge = (e: string) => {
    if (e === 'pendiente') return 'bg-amber-100 text-amber-700'
    if (e === 'pagado') return 'bg-green-100 text-green-700'
    return 'bg-red-100 text-red-700'
  }

  const estadoLabel = (e: string) => {
    if (e === 'pendiente') return t('creditos.statePending')
    if (e === 'pagado') return t('creditos.statePaid')
    return t('creditos.stateVoided')
  }

  const deudorDe = (c: Credito) => c.cliente_nombre || c.deudor_nombre || '—'

  const saldoPendiente = creditos.reduce((acc, c) => acc + (c.estado === 'pendiente' ? c.saldo : 0), 0)

  const openDetalle = async (c: Credito) => {
    const completa = await callApi<CreditoDetalle>('creditos:getById', { id: c.id })
    setDetalle(completa)
    setDetalleOpen(true)
  }

  const openAbono = (c: Credito) => {
    setAbonoTarget(c)
    setAbonoMonto(String(c.saldo))
    setAbonoNotas('')
    setAbonoOpen(true)
  }

  const registrarAbono = async () => {
    if (!abonoTarget) return
    const monto = parseFloat(abonoMonto)
    if (!monto || monto <= 0 || monto > abonoTarget.saldo) return
    const targetId = abonoTarget.id
    setRegistrando(true)
    try {
      const result = await callApi<{ success: boolean; error?: string }>('creditos:abono', {
        credito_id: targetId,
        monto,
        notas: abonoNotas.trim() || undefined,
      })
      if (result && !result.success) {
        toast.error(result.error || 'Error registrando abono')
        return
      }
      toast.success(t('toast.saved'))
      setAbonoOpen(false)
      setAbonoTarget(null)
      await loadData()
      if (detalleOpen && detalle) {
        const completa = await callApi<CreditoDetalle>('creditos:getById', { id: targetId })
        setDetalle(completa)
      }
    } catch (err: any) {
      toast.error(err.message || 'Error registrando abono')
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('creditos.title')}</h1>
          <p className="text-sm text-gray-500">{t('creditos.subtitle')}</p>
        </div>
        {creditos.length > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 border border-amber-200 rounded-xl">
            <Wallet className="w-4 h-4 text-amber-600" />
            <span className="text-sm text-amber-700 font-medium">
              {t('creditos.remaining')}: {formatCurrency(saldoPendiente)}
            </span>
          </div>
        )}
      </div>

      {/* Filtros */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('creditos.searchPlaceholder')}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
          />
        </div>
        <div className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.value || 'all'}
              onClick={() => setEstado(f.value)}
              className={`px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                estado === f.value
                  ? 'bg-blue-600 border-blue-600 text-white'
                  : 'border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t(`creditos.${f.key}`)}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.debtor')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.sale')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.date')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.total')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.balance')}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.state')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('creditos.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">{t('common.loading')}</td>
              </tr>
            ) : creditos.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-400">
                  <Wallet className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>{t('creditos.empty')}</p>
                </td>
              </tr>
            ) : (
              creditos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{deudorDe(c)}</p>
                        {(c.deudor_telefono || c.deudor_documento) && (
                          <p className="text-xs text-gray-400 truncate">
                            {c.deudor_telefono || c.deudor_documento}
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {c.numero_venta ? `#${formatTicketNumber(c.numero_venta)}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDateTime(c.fecha)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700">{formatCurrency(c.monto_total)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`font-semibold ${c.estado === 'pendiente' ? 'text-amber-600' : c.estado === 'pagado' ? 'text-green-600' : 'text-gray-400'}`}>
                      {formatCurrency(c.estado === 'pendiente' ? c.saldo : 0)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${estadoBadge(c.estado)}`}>
                      {c.estado === 'pendiente' ? <Clock className="w-3 h-3" /> : c.estado === 'pagado' ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {estadoLabel(c.estado)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openDetalle(c)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('creditos.view')}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {c.estado === 'pendiente' && has('creditos_edit') && (
                        <button onClick={() => openAbono(c)} className="p-1.5 hover:bg-green-50 rounded-lg" title={t('creditos.registerPayment')}>
                          <Plus className="w-4 h-4 text-green-600" />
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

      {/* Modal detalle */}
      <Modal open={detalleOpen} onClose={() => setDetalleOpen(false)} title={t('creditos.detail')} wide>
        {detalle && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('creditos.debtor')}</p>
                  <p className="font-medium">{detalle.cliente_nombre || detalle.deudor_nombre}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <Hash className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('creditos.sale')}</p>
                  <p className="font-medium">{detalle.numero_venta ? `#${formatTicketNumber(detalle.numero_venta)}` : '—'}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-xs text-gray-500">{t('creditos.date')}</p>
                  <p className="font-medium">{formatDateTime(detalle.venta_fecha || detalle.fecha)}</p>
                </div>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{t('creditos.total')}</p>
                <p className="font-bold text-gray-900">{formatCurrency(detalle.monto_total)}</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">{t('creditos.paidTotal')}</p>
                <p className="font-bold text-green-600">{formatCurrency(detalle.monto_total - detalle.saldo)}</p>
              </div>
              <div className="bg-amber-50 rounded-xl p-3">
                <p className="text-xs text-amber-500">{t('creditos.remaining')}</p>
                <p className="font-bold text-amber-600">{formatCurrency(detalle.saldo)}</p>
              </div>
            </div>

            {detalle.detalles && detalle.detalles.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('creditos.saleItems')}</h3>
                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <tbody className="divide-y divide-gray-100">
                      {detalle.detalles.map((d) => (
                        <tr key={d.id}>
                          <td className="px-3 py-2 text-sm">{d.producto_nombre || d.descripcion || '—'}</td>
                          <td className="px-3 py-2 text-sm text-gray-500">{d.cantidad}</td>
                          <td className="px-3 py-2 text-sm text-right">{formatCurrency(d.precio_unitario)}</td>
                          <td className="px-3 py-2 text-sm text-right font-medium">{formatCurrency(d.subtotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-gray-800 mb-2">{t('creditos.paymentsHistory')}</h3>
              {detalle.abonos && detalle.abonos.length > 0 ? (
                <div className="space-y-2">
                  {detalle.abonos.map((a) => (
                    <div key={a.id} className="flex items-center justify-between bg-green-50 rounded-lg px-3 py-2 text-sm">
                      <div>
                        <p className="font-medium text-green-700">+{formatCurrency(a.monto)}</p>
                        <p className="text-xs text-gray-500">
                          {a.usuario_nombre || '—'} • {formatDateTime(a.fecha)}
                        </p>
                      </div>
                      {a.notas && <p className="text-xs text-gray-500">{a.notas}</p>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400">{t('creditos.noPayments')}</p>
              )}
            </div>

            {detalle.estado === 'pendiente' && has('creditos_edit') && (
              <div className="flex justify-end pt-2 border-t border-gray-100">
                <button onClick={() => openAbono(detalle)}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">
                  <Plus className="w-4 h-4" /> {t('creditos.registerPayment')}
                </button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal abono */}
      <Modal open={abonoOpen} onClose={() => { if (!registrando) setAbonoOpen(false) }} title={t('creditos.registerPayment')}>
        {abonoTarget && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-xl p-3 text-sm">
              <p className="font-medium text-gray-900">{deudorDe(abonoTarget)}</p>
              <div className="flex justify-between mt-1 text-gray-500">
                <span>{t('creditos.remaining')}:</span>
                <span className="font-bold text-amber-600">{formatCurrency(abonoTarget.saldo)}</span>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditos.paymentAmount')} *</label>
              <input
                type="number" step="0.01" min="0.01" max={abonoTarget.saldo}
                value={abonoMonto}
                onChange={(e) => setAbonoMonto(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-green-500"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('creditos.paymentNotes')}</label>
              <textarea rows={2} value={abonoNotas}
                onChange={(e) => setAbonoNotas(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
              <button onClick={() => setAbonoOpen(false)} disabled={registrando}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              <button onClick={registrarAbono}
                disabled={registrando || !parseFloat(abonoMonto) || parseFloat(abonoMonto) <= 0 || parseFloat(abonoMonto) > abonoTarget.saldo}
                className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center gap-2">
                {registrando ? t('common.loading') : t('creditos.savePayment')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
