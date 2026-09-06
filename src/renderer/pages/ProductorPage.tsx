import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sprout, Plus, Wheat, Coins } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'
import type { IpcChannel } from '@shared/ipc-channels'

type Tab = 'siembras' | 'costos'

interface Siembra {
  id: number
  cultivo_nombre: string
  descripcion: string | null
  fecha_siembra: string
  area: number
  unidad_area: string
  cantidad_sembrada: number
  estado: string
  fecha_cosecha: string | null
  cantidad_cosechada: number
  costos_total: number
  costos_cantidad: number
}

interface Costo {
  id: number
  fecha: string
  concepto: string
  monto: number
  cultivo_nombre: string
  siembra_descripcion: string | null
}

interface Cultivo {
  id: number
  nombre: string
  unidad: string
}

export default function ProductorPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<Tab>('siembras')
  const [siembras, setSiembras] = useState<Siembra[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [loading, setLoading] = useState(false)

  const [modalSiembra, setModalSiembra] = useState(false)
  const [modalCosto, setModalCosto] = useState<{ siembraId: number; cultivo: string } | null>(null)
  const [cosechando, setCosechando] = useState<Siembra | null>(null)

  const puedeEditar = has('productor_edit')

  const load = async () => {
    setLoading(true)
    try {
      const [s, c, cu] = await Promise.all([
        callApi<any[]>('productor:siembras-list', {}),
        callApi<any[]>('productor:costos-list', {}),
        callApi<any[]>('productor:cultivos-list', {}),
      ])
      setSiembras(s || [])
      setCostos(c || [])
      setCultivos(cu || [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      activa: 'bg-green-100 text-green-700',
      cosechada: 'bg-blue-100 text-blue-700',
      cancelada: 'bg-gray-100 text-gray-500',
    }
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || 'bg-gray-100 text-gray-600'}`}>
        {t(`productor.estado.${estado}`, { defaultValue: estado })}
      </span>
    )
  }

  const siembrasActivas = siembras.filter((s) => s.estado === 'activa').length
  const costosMes = costos.reduce((acc, c) => acc + (c.monto || 0), 0)
  const invertidoEnCampo = siembras.reduce((acc, s) => acc + (s.costos_total || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('productor.title')}</h1>
          <p className="text-sm text-gray-500">{t('productor.subtitle')}</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            {tab === 'siembras' && (
              <button onClick={() => setModalSiembra(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" /> {t('productor.newSiembra')}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <ResumenCard icon={Sprout} label={t('productor.activeSiembras')} value={String(siembrasActivas)} color="green" />
        <ResumenCard icon={Coins} label={t('productor.fieldInvestment')} value={formatMoney(invertidoEnCampo)} color="orange" />
        <ResumenCard icon={Wheat} label={t('productor.costRecords')} value={String(costos.length)} detail={formatMoney(costosMes)} color="blue" />
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {(['siembras', 'costos'] as Tab[]).map((id) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            {t(`productor.tab.${id}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : tab === 'siembras' ? (
        <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('productor.crop')}</Th>
                <Th>{t('productor.description')}</Th>
                <Th>{t('productor.plantingDate')}</Th>
                <Th right>{t('productor.area')}</Th>
                <Th right>{t('productor.fieldCosts')}</Th>
                <Th>{t('contable.colStatus')}</Th>
                <Th>{t('productor.harvest')}</Th>
                {puedeEditar && <Th right>{t('common.actions')}</Th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {siembras.length === 0 ? (
                <tr><td colSpan={puedeEditar ? 8 : 7} className="text-center py-10 text-gray-400">{t('productor.noSiembras')}</td></tr>
              ) : siembras.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{s.cultivo_nombre}</td>
                  <td className="px-3 py-2 text-gray-500">{s.descripcion || '—'}</td>
                  <td className="px-3 py-2">{s.fecha_siembra?.slice(0, 10)}</td>
                  <td className="px-3 py-2 text-right">{s.area} {s.unidad_area}</td>
                  <td className="px-3 py-2 text-right">
                    <button onClick={() => setModalCosto({ siembraId: s.id, cultivo: s.cultivo_nombre })}
                      className="text-blue-600 hover:underline">
                      {formatMoney(s.costos_total)}
                    </button>
                    <span className="text-gray-400 text-xs ml-1">({s.costos_cantidad})</span>
                  </td>
                  <td className="px-3 py-2">{estadoBadge(s.estado)}</td>
                  <td className="px-3 py-2 text-gray-500">
                    {s.estado === 'cosechada' ? `${s.cantidad_cosechada} — ${s.fecha_cosecha?.slice(0, 10)}` : '—'}
                  </td>
                  {puedeEditar && (
                    <td className="px-3 py-2 text-right">
                      {s.estado === 'activa' && (
                        <button onClick={() => setCosechando(s)}
                          className="text-green-600 hover:underline text-sm">{t('productor.harvestAction')}</button>
                      )}
                    </td>
                  )}
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
                <Th>{t('productor.crop')}</Th>
                <Th>{t('productor.concept')}</Th>
                <Th right>{t('common.total')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {costos.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400">{t('productor.noCostos')}</td></tr>
              ) : costos.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{c.fecha?.slice(0, 10)}</td>
                  <td className="px-3 py-2">{c.cultivo_nombre}</td>
                  <td className="px-3 py-2">{c.concepto}{c.siembra_descripcion ? <span className="text-gray-400 text-xs ml-1">({c.siembra_descripcion})</span> : null}</td>
                  <td className="px-3 py-2 text-right font-medium">{formatMoney(c.monto)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalSiembra && (
        <ModalSiembra
          cultivos={cultivos}
          onClose={() => setModalSiembra(false)}
          onSaved={async () => { setModalSiembra(false); await load() }}
        />
      )}
      {modalCosto && (
        <ModalCosto
          siembraId={modalCosto.siembraId}
          cultivo={modalCosto.cultivo}
          onClose={() => setModalCosto(null)}
          onSaved={async () => { setModalCosto(null); await load() }}
        />
      )}
      {cosechando && (
        <ModalCosechar
          siembra={cosechando}
          onClose={() => setCosechando(null)}
          onDone={async () => { setCosechando(null); await load() }}
        />
      )}
    </div>
  )
}

function ModalSiembra({ cultivos, onClose, onSaved }: { cultivos: Cultivo[]; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [cultivoId, setCultivoId] = useState('')
  const [nuevoCultivo, setNuevoCultivo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [area, setArea] = useState('')
  const [unidadArea, setUnidadArea] = useState('ha')
  const [cantidad, setCantidad] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      let cultivoIdFinal = cultivoId ? Number(cultivoId) : null
      if (!cultivoIdFinal && nuevoCultivo.trim()) {
        const creado = await callApi<any>('productor:cultivo-create', { nombre: nuevoCultivo.trim() })
        cultivoIdFinal = creado.id
      }
      if (!cultivoIdFinal) {
        toast.error(t('productor.cropRequired'))
        setSaving(false)
        return
      }
      await callApi('productor:siembra-create', {
        cultivo_id: cultivoIdFinal,
        descripcion: descripcion || undefined,
        fecha_siembra: fecha || undefined,
        area: Number(area) || 0,
        unidad_area: unidadArea,
        cantidad_sembrada: Number(cantidad) || 0,
      })
      toast.success(t('productor.siembraCreated'))
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const hayCultivos = cultivos.length > 0 || nuevoCultivo.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.newSiembra')}</h2>
        <select value={cultivoId} onChange={(e) => setCultivoId(e.target.value)} disabled={nuevoCultivo.trim().length > 0}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('productor.selectCrop')}</option>
          {cultivos.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input value={nuevoCultivo} onChange={(e) => setNuevoCultivo(e.target.value)} placeholder={t('productor.orNewCrop')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder={t('productor.description')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={unidadArea} onChange={(e) => setUnidadArea(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="ha">ha</option>
            <option value="m2">m²</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={area} onChange={(e) => setArea(e.target.value)} placeholder={t('productor.area')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder={t('productor.quantityPlanted')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          <button onClick={guardar} disabled={saving || !hayCultivos}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalCosto({ siembraId, cultivo, onClose, onSaved }: { siembraId: number; cultivo: string; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [concepto, setConcepto] = useState('')
  const [monto, setMonto] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [items, setItems] = useState<Costo[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    callApi<any[]>('productor:costos-list', { siembra_id: siembraId }).then(setItems).catch(() => setItems([]))
  }, [siembraId])

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('productor:costo-create', {
        siembra_id: siembraId, concepto, monto: Number(monto), fecha: fecha || undefined,
      })
      toast.success(t('productor.costoCreated'))
      setConcepto(''); setMonto('')
      const items2 = await callApi<any[]>('productor:costos-list', { siembra_id: siembraId })
      setItems(items2 || [])
      onSaved()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  const total = items.reduce((acc, c) => acc + (c.monto || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.fieldCosts')} — {cultivo}</h2>
        {items.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm max-h-40 overflow-y-auto">
            {items.map((c) => (
              <div key={c.id} className="px-3 py-1.5 flex justify-between">
                <span>{c.fecha?.slice(0, 10)} — {c.concepto}</span>
                <span className="font-medium">{formatMoney(c.monto)}</span>
              </div>
            ))}
            <div className="px-3 py-1.5 flex justify-between font-semibold bg-gray-50">
              <span>{t('common.total')}</span><span>{formatMoney(total)}</span>
            </div>
          </div>
        )}
        <input value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder={t('productor.concept')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder={t('common.total')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.close')}</button>
          <button onClick={guardar} disabled={saving || !concepto.trim() || !(Number(monto) > 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalCosechar({ siembra, onClose, onDone }: { siembra: Siembra; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [cantidad, setCantidad] = useState('')
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10))
  const [saving, setSaving] = useState(false)

  const cosechar = async () => {
    setSaving(true)
    try {
      const res = await callApi<any>('productor:siembra-cosechar', {
        id: siembra.id, cantidad_cosechada: Number(cantidad), fecha_cosecha: fecha || undefined,
      })
      if (res?.success === false) {
        toast.error(res.error)
      } else {
        toast.success(t('productor.harvestDone', { cost: formatMoney(res?.costo_unitario || 0) }))
        onDone()
      }
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.harvestAction')} — {siembra.cultivo_nombre}</h2>
        <p className="text-sm text-gray-500">{t('productor.harvestHint')}</p>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex justify-between">
          <span>{t('productor.accumulatedCosts')}</span>
          <span className="font-semibold">{formatMoney(siembra.costos_total)}</span>
        </div>
        <input type="number" value={cantidad} onChange={(e) => setCantidad(e.target.value)} placeholder={t('productor.quantityHarvested')} min="0" step="any"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          <button onClick={cosechar} disabled={saving || !(Number(cantidad) > 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {t('productor.harvestAction')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ResumenCard({ icon: Icon, label, value, detail, color }: { icon: any; label: string; value: string; detail?: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
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
