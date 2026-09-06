import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LifeBuoy, Plus, RotateCcw, ShieldCheck } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'
import type { IpcChannel } from '@shared/ipc-channels'

type Tab = 'tickets' | 'devoluciones' | 'garantias'

interface Ticket {
  id: number
  numero: string
  venta_id: number | null
  cliente_nombre: string
  asunto: string
  estado: string
  prioridad: string
  mensajes: number
  devoluciones: number
  garantias: number
  creado_en: string
}

interface Devolucion {
  id: number
  numero_venta: number | null
  producto_nombre: string | null
  cantidad: number
  monto: number
  motivo: string
  tipo: string
  creado_en: string
}

interface Garantia {
  id: number
  numero_venta: number | null
  producto_nombre: string | null
  vence_en: string | null
  estado: string
  resolucion: string | null
  creado_en: string
}

const ESTADOS: string[] = ['abierto', 'en_proceso', 'resuelto', 'cerrado']
const PRIORIDADES: string[] = ['baja', 'media', 'alta']

export default function PostventaPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<Tab>('tickets')
  const [filtroEstado, setFiltroEstado] = useState('')
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([])
  const [garantias, setGarantias] = useState<Garantia[]>([])
  const [loading, setLoading] = useState(false)

  const [modalTicket, setModalTicket] = useState(false)
  const [modalMensaje, setModalMensaje] = useState<Ticket | null>(null)
  const [modalDevolucion, setModalDevolucion] = useState(false)

  const puedeEditar = has('postventa_edit')

  const load = async () => {
    setLoading(true)
    try {
      const [tk, dv, gr] = await Promise.all([
        callApi<any[]>('postventa:tickets-list', filtroEstado ? { estado: filtroEstado } : {}),
        callApi<any[]>('postventa:devoluciones-list', {}),
        callApi<any[]>('postventa:garantias-list', {}),
      ])
      setTickets(tk || [])
      setDevoluciones(dv || [])
      setGarantias(gr || [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filtroEstado])

  const cambiarEstado = async (ticket: Ticket, estado: string) => {
    try {
      await callApi('postventa:ticket-update', { id: ticket.id, data: { estado } })
      await load()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const resolverGarantia = async (garantia: Garantia, resolucion: string) => {
    try {
      await callApi('postventa:garantia-resolver', { id: garantia.id, resolucion })
      toast.success(t('postventa.garantiaResolved'))
      await load()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      abierto: 'bg-orange-100 text-orange-700',
      en_proceso: 'bg-blue-100 text-blue-700',
      resuelto: 'bg-green-100 text-green-700',
      cerrado: 'bg-gray-100 text-gray-500',
      vigente: 'bg-purple-100 text-purple-700',
      rechazada: 'bg-red-100 text-red-600',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || 'bg-gray-100 text-gray-600'}`}>
        {t(`postventa.estado.${estado}`, { defaultValue: estado })}
      </span>
    )
  }

  const abiertos = tickets.filter((x) => x.estado === 'abierto').length
  const montoDevoluciones = devoluciones.reduce((acc, d) => acc + (d.monto || 0), 0)
  const garantiasVigentes = garantias.filter((g) => g.estado === 'vigente').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('postventa.title')}</h1>
          <p className="text-sm text-gray-500">{t('postventa.subtitle')}</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            <button onClick={() => setModalTicket(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700">
              <Plus className="w-4 h-4" /> {t('postventa.newTicket')}
            </button>
            {tab === 'devoluciones' && (
              <button onClick={() => setModalDevolucion(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600">
                <RotateCcw className="w-4 h-4" /> {t('postventa.newDevolucion')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card icon={LifeBuoy} label={t('postventa.openTickets')} value={String(abiertos)} color="orange" />
        <Card icon={RotateCcw} label={t('postventa.returnsTotal')} value={formatMoney(montoDevoluciones)} detail={`${devoluciones.length} ${t('contable.ops')}`} color="blue" />
        <Card icon={ShieldCheck} label={t('postventa.activeWarranties')} value={String(garantiasVigentes)} color="purple" />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['tickets', 'devoluciones', 'garantias'] as Tab[]).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-purple-500 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t(`postventa.tab.${id}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-purple-500 border-t-transparent rounded-full" />
        </div>
      ) : tab === 'tickets' ? (
        <>
          <div className="flex gap-2">
            <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
              <option value="">{t('postventa.allStatuses')}</option>
              {ESTADOS.map((e) => <option key={e} value={e}>{t(`postventa.estado.${e}`)}</option>)}
            </select>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>{t('postventa.colNumber')}</Th>
                  <Th>{t('postventa.client')}</Th>
                  <Th>{t('postventa.subject')}</Th>
                  <Th>{t('postventa.priority')}</Th>
                  <Th>{t('contable.colStatus')}</Th>
                  <Th right>{t('postventa.messages')}</Th>
                  {puedeEditar && <Th right>{t('common.actions')}</Th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tickets.length === 0 ? (
                  <tr><td colSpan={puedeEditar ? 7 : 6} className="text-center py-10 text-gray-400">{t('postventa.noTickets')}</td></tr>
                ) : tickets.map((tk) => (
                  <tr key={tk.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-mono text-xs">{tk.numero}</td>
                    <td className="px-3 py-2">{tk.cliente_nombre}</td>
                    <td className="px-3 py-2">{tk.asunto}</td>
                    <td className="px-3 py-2">
                      <span className={`text-xs font-medium ${tk.prioridad === 'alta' ? 'text-red-600' : tk.prioridad === 'baja' ? 'text-gray-400' : 'text-blue-600'}`}>
                        {t(`postventa.prioridad.${tk.prioridad}`)}
                      </span>
                    </td>
                    <td className="px-3 py-2">{estadoBadge(tk.estado)}</td>
                    <td className="px-3 py-2 text-right text-gray-500">{tk.mensajes}</td>
                    {puedeEditar && (
                      <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                        <button onClick={() => setModalMensaje(tk)} className="text-blue-600 hover:underline text-sm">{t('postventa.reply')}</button>
                        {tk.estado !== 'resuelto' && tk.estado !== 'cerrado' && (
                          <button onClick={() => cambiarEstado(tk, 'resuelto')} className="text-green-600 hover:underline text-sm">{t('postventa.resolve')}</button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : tab === 'devoluciones' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('common.date')}</Th>
                <Th>{t('postventa.sale')}</Th>
                <Th>{t('contable.colProduct')}</Th>
                <Th right>{t('contable.colQty')}</Th>
                <Th right>{t('common.total')}</Th>
                <Th>{t('postventa.reason')}</Th>
                <Th>{t('postventa.type')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {devoluciones.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">{t('postventa.noDevoluciones')}</td></tr>
              ) : devoluciones.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{d.creado_en?.slice(0, 10)}</td>
                  <td className="px-3 py-2">{d.numero_venta ? `#${d.numero_venta}` : '—'}</td>
                  <td className="px-3 py-2">{d.producto_nombre || '—'}</td>
                  <td className="px-3 py-2 text-right">{d.cantidad}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(d.monto)}</td>
                  <td className="px-3 py-2 text-gray-500">{d.motivo}</td>
                  <td className="px-3 py-2">{t(`postventa.tipo.${d.tipo}`)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('common.date')}</Th>
                <Th>{t('postventa.sale')}</Th>
                <Th>{t('contable.colProduct')}</Th>
                <Th>{t('postventa.expires')}</Th>
                <Th>{t('contable.colStatus')}</Th>
                <Th>{t('postventa.resolution')}</Th>
                {puedeEditar && <Th right>{t('common.actions')}</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {garantias.length === 0 ? (
                <tr><td colSpan={puedeEditar ? 7 : 6} className="text-center py-10 text-gray-400">{t('postventa.noGarantias')}</td></tr>
              ) : garantias.map((g) => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{g.creado_en?.slice(0, 10)}</td>
                  <td className="px-3 py-2">{g.numero_venta ? `#${g.numero_venta}` : '—'}</td>
                  <td className="px-3 py-2">{g.producto_nombre || '—'}</td>
                  <td className="px-3 py-2">{g.vence_en?.slice(0, 10) || '—'}</td>
                  <td className="px-3 py-2">{estadoBadge(g.estado)}</td>
                  <td className="px-3 py-2 text-gray-500">{g.resolucion || '—'}</td>
                  {puedeEditar && (
                    <td className="px-3 py-2 text-right space-x-2 whitespace-nowrap">
                      {g.estado === 'vigente' && (
                        <>
                          <button onClick={() => resolverGarantia(g, 'repuesto')} className="text-green-600 hover:underline text-sm">{t('postventa.reemplazo')}</button>
                          <button onClick={() => resolverGarantia(g, 'rechazado')} className="text-red-600 hover:underline text-sm">{t('postventa.rechazar')}</button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalTicket && <ModalTicket onClose={() => setModalTicket(false)} onSaved={async () => { setModalTicket(false); await load() }} />}
      {modalMensaje && <ModalMensaje ticket={modalMensaje} onClose={() => setModalMensaje(null)} onSaved={async () => { setModalMensaje(null); await load() }} />}
      {modalDevolucion && <ModalDevolucion onClose={() => setModalDevolucion(false)} onSaved={async () => { setModalDevolucion(false); await load() }} />}
    </div>
  )
}

function ModalTicket({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [cliente, setCliente] = useState('')
  const [telefono, setTelefono] = useState('')
  const [asunto, setAsunto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [prioridad, setPrioridad] = useState('media')
  const [ventaId, setVentaId] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('postventa:ticket-create', {
        cliente_nombre: cliente, cliente_telefono: telefono || undefined, asunto,
        descripcion: descripcion || undefined, prioridad,
        venta_id: ventaId ? Number(ventaId) : undefined,
      })
      toast.success(t('postventa.ticketCreated'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('postventa.newTicket')}</h2>
        <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder={t('postventa.client')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder={t('postventa.phone')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input value={asunto} onChange={(e) => setAsunto(e.target.value)} placeholder={t('postventa.subject')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={t('postventa.description')} rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <select value={prioridad} onChange={(e) => setPrioridad(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            {PRIORIDADES.map((p) => <option key={p} value={p}>{t(`postventa.prioridad.${p}`)}</option>)}
          </select>
          <input type="number" value={ventaId} onChange={(e) => setVentaId(e.target.value)} placeholder={t('postventa.saleId')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          <button onClick={guardar} disabled={saving || !cliente.trim() || !asunto.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalMensaje({ ticket, onClose, onSaved }: { ticket: Ticket; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [mensaje, setMensaje] = useState('')
  const [saving, setSaving] = useState(false)

  const enviar = async () => {
    setSaving(true)
    try {
      await callApi('postventa:ticket-mensaje', { id: ticket.id, mensaje })
      toast.success(t('postventa.messageSent'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{ticket.numero} — {ticket.asunto}</h2>
        <p className="text-sm text-gray-500">{ticket.cliente_nombre}</p>
        <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={4} placeholder={t('postventa.writeMessage')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.close')}</button>
          <button onClick={enviar} disabled={saving || !mensaje.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50">
            {t('postventa.send')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalDevolucion({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [ventaId, setVentaId] = useState('')
  const [productoId, setProductoId] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [monto, setMonto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [tipo, setTipo] = useState('devolucion')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('postventa:devolucion-create', {
        venta_id: ventaId ? Number(ventaId) : undefined,
        producto_id: productoId ? Number(productoId) : undefined,
        cantidad: Number(cantidad) || 1,
        monto: Number(monto),
        motivo,
        tipo,
      })
      toast.success(t('postventa.devolucionCreated'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('postventa.newDevolucion')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={ventaId} onChange={(e) => setVentaId(e.target.value)} placeholder={t('postventa.saleId')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" value={productoId} onChange={(e) => setProductoId(e.target.value)} placeholder={t('postventa.productId')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} min="0" placeholder={t('contable.colQty')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} min="0" placeholder={t('common.total')}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="devolucion">{t('postventa.tipo.devolucion')}</option>
          <option value="nota_credito">{t('postventa.tipo.nota_credito')}</option>
        </select>
        <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder={t('postventa.reason')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          <button onClick={guardar} disabled={saving || !motivo.trim() || !(Number(monto) > 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:opacity-50">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function Card({ icon: Icon, label, value, detail, color }: { icon: any; label: string; value: string; detail?: string; color: string }) {
  const colors: Record<string, string> = {
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${colors[color] || 'bg-gray-100'}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {detail && <p className="text-xs text-gray-400">{detail}</p>}
      </div>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}
