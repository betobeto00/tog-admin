import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sprout, Plus, Wheat, Coins, Factory, Package, BarChart3, Trash2, Edit2, CheckCircle, XCircle, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'

type Tab = 'cadenas' | 'produccion' | 'analisis' | 'siembras' | 'costos'

// ─── Interfaces ─────────────────────────────────────────────────────
interface Cadena {
  id: number; producto_final_id: number; producto_nombre: string; nombre: string
  descripcion: string | null; tiempo_estimado_minutos: number; costo_mano_obra_hora: number
  overhead_porcentaje: number; activo: number; pasos_count: number
  costo_materiales: number; costo_mano_obra: number; costo_overhead: number; costo_total: number
}

interface CadenaDetalle extends Cadena {
  pasos: CadenaPaso[]
  resumen: { costo_materiales: number; costo_mano_obra: number; costo_overhead: number; costo_total: number }
}

interface CadenaPaso {
  id: number; cadena_id: number; orden: number; producto_base_id: number
  base_nombre: string; base_unidad: string; base_precio_compra: number
  cantidad: number; unidad: string; costo_unitario_override: number | null
  costo_unitario_calculado: number; costo_total_linea: number; notas: string | null
}

interface Lote {
  id: number; cadena_id: number; cadena_nombre: string; producto_final_id: number
  producto_nombre: string; cantidad_producida: number
  costo_materiales: number; costo_mano_obra: number; costo_overhead: number
  costo_total: number; costo_unitario: number
  fecha_inicio: string; fecha_fin: string | null; estado: string; notas: string | null
}

interface AnalisisCosto {
  costo_materiales: number; costo_mano_obra: number; costo_overhead: number; costo_total: number
  pasos: any[]; lotes_recientes: Lote[]
}

interface Producto { id: number; nombre: string; tipo_produccion: string | null; stock: number }

interface Siembra {
  id: number; cultivo_nombre: string; descripcion: string | null; fecha_siembra: string
  area: number; unidad_area: string; cantidad_sembrada: number; estado: string
  fecha_cosecha: string | null; cantidad_cosechada: number; costos_total: number; costos_cantidad: number
}

interface Costo {
  id: number; fecha: string; concepto: string; monto: number
  cultivo_nombre: string; siembra_descripcion: string | null
}

interface Cultivo { id: number; nombre: string; unidad: string }

// ─── Page ───────────────────────────────────────────────────────────
export default function ProductorPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<Tab>('cadenas')
  const puedeEditar = has('productor_edit')
  const puedeVer = has('productor_view')
  const [loading, setLoading] = useState(false)

  // Cadenas state
  const [cadenas, setCadenas] = useState<Cadena[]>([])
  const [modalCadena, setModalCadena] = useState(false)
  const [editingCadena, setEditingCadena] = useState<Cadena | null>(null)
  const [detailCadena, setDetailCadena] = useState<CadenaDetalle | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Lotes state
  const [lotes, setLotes] = useState<Lote[]>([])
  const [modalLote, setModalLote] = useState(false)

  // Análisis state
  const [productos, setProductos] = useState<Producto[]>([])
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null)
  const [analisis, setAnalisis] = useState<AnalisisCosto | null>(null)
  const [analisisProducto, setAnalisisProducto] = useState<string>('')
  const [margen, setMargen] = useState(50)
  const [precioRecomendado, setPrecioRecomendado] = useState<any>(null)

  // Siembras state
  const [siembras, setSiembras] = useState<Siembra[]>([])
  const [costos, setCostos] = useState<Costo[]>([])
  const [cultivos, setCultivos] = useState<Cultivo[]>([])
  const [modalSiembra, setModalSiembra] = useState(false)
  const [modalCosto, setModalCosto] = useState<{ siembraId: number; cultivo: string } | null>(null)
  const [cosechando, setCosechando] = useState<Siembra | null>(null)

  // ─── Load functions ──────────────────────────────────────────────
  const loadCadenas = async () => {
    try {
      const c = await callApi<Cadena[]>('productor:cadena-list', {})
      setCadenas(c || [])
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
  }

  const loadLotes = async () => {
    try {
      const l = await callApi<Lote[]>('productor:lote-list', {})
      setLotes(l || [])
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
  }

  const loadProductos = async () => {
    try {
      const p = await callApi<Producto[]>('productos:list', {})
      setProductos(p || [])
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
  }

  const loadAnalisis = async (productoId: number) => {
    try {
      const a = await callApi<AnalisisCosto>('productor:costo-estructura', { producto_id: productoId })
      setAnalisis(a)
      const prod = productos.find(p => p.id === productoId)
      setAnalisisProducto(prod?.nombre || '')
    } catch (err: any) {
      setAnalisis(null)
      toast.error(err?.message || t('productor.analisis.noChain'))
    }
  }

  const loadSiembras = async () => {
    try {
      const [s, c, cu] = await Promise.all([
        callApi<Siembra[]>('productor:siembras-list', {}),
        callApi<Costo[]>('productor:costos-list', {}),
        callApi<Cultivo[]>('productor:cultivos-list', {}),
      ])
      setSiembras(s || []); setCostos(c || []); setCultivos(cu || [])
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
  }

  const load = async () => {
    setLoading(true)
    try {
      await Promise.all([loadCadenas(), loadLotes(), loadProductos(), loadSiembras()])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  useEffect(() => {
    if (selectedProductId) loadAnalisis(selectedProductId)
  }, [selectedProductId])

  // ─── Summary cards ────────────────────────────────────────────────
  const cadenasActivas = cadenas.filter(c => c.activo).length
  const lotesEnProceso = lotes.filter(l => l.estado === 'en_proceso').length
  const lotesCompletados = lotes.filter(l => l.estado === 'completado').length
  const siembrasActivas = siembras.filter(s => s.estado === 'activa').length

  const tabConfig: { id: Tab; label: string; icon: any }[] = [
    { id: 'cadenas', label: t('productor.tab.cadenas'), icon: Factory },
    { id: 'produccion', label: t('productor.tab.produccion'), icon: Package },
    { id: 'analisis', label: t('productor.tab.analisis'), icon: BarChart3 },
    { id: 'siembras', label: t('productor.tab.siembras'), icon: Sprout },
    { id: 'costos', label: t('productor.tab.costos'), icon: Coins },
  ]

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('productor.title')}</h1>
          <p className="text-sm text-gray-500">{t('productor.subtitle')}</p>
        </div>
        {puedeEditar && (
          <div className="flex gap-2">
            {tab === 'cadenas' && (
              <button onClick={() => { setEditingCadena(null); setModalCadena(true) }}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" /> {t('productor.cadena.newChain')}
              </button>
            )}
            {tab === 'produccion' && (
              <button onClick={() => setModalLote(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" /> {t('productor.lote.newLot')}
              </button>
            )}
            {tab === 'siembras' && (
              <button onClick={() => setModalSiembra(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                <Plus className="w-4 h-4" /> {t('productor.newSiembra')}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <ResumenCard icon={Factory} label={t('productor.cadena.title')} value={String(cadenasActivas)} color="green" />
        <ResumenCard icon={Package} label={t('productor.lote.title')} value={`${lotesEnProceso} / ${lotesCompletados}`} color="blue" />
        <ResumenCard icon={Sprout} label={t('productor.activeSiembras')} value={String(siembrasActivas)} color="orange" />
        <ResumenCard icon={Coins} label={t('productor.fieldInvestment')} value={formatMoney(siembras.reduce((a, s) => a + (s.costos_total || 0), 0))} color="purple" />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {tabConfig.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {tab === 'cadenas' && (
            <TabCadenas cadenas={cadenas} puedeEditar={puedeEditar}
              onEdit={(c) => { setEditingCadena(c); setModalCadena(true) }}
              onDetail={async (c) => { setLoadingDetail(true); try { const d = await callApi<CadenaDetalle>('productor:cadena-detail', { id: c.id, usuario_id: 1 }); setDetailCadena(d); } catch {} finally { setLoadingDetail(false) } }}
              onDelete={async (id) => {
                if (!confirm(t('productor.cadena.deleteConfirm'))) return
                const r = await callApi<any>('productor:cadena-delete', { id, usuario_id: 1 })
                if (r?.success === false) toast.error(r.error)
                else { toast.success(t('productor.cadena.deleted')); await loadCadenas() }
              }}
            />
          )}
          {tab === 'produccion' && (
            <TabProduccion lotes={lotes}
              onCompletar={async (id) => {
                if (!confirm(t('productor.lote.confirmComplete'))) return
                const r = await callApi<any>('productor:lote-completar', { id, usuario_id: 1 })
                if (r?.success === false) toast.error(r.error)
                else { toast.success(t('productor.lote.completed')); await loadLotes() }
              }}
              onCancelar={async (id) => {
                if (!confirm(t('productor.lote.confirmCancel'))) return
                const r = await callApi<any>('productor:lote-cancelar', { id, usuario_id: 1 })
                if (r?.success === false) toast.error(r.error)
                else { toast.success(t('productor.lote.cancelled')); await loadLotes() }
              }}
            />
          )}
          {tab === 'analisis' && (
            <TabAnalisis productos={productos} selectedProductId={selectedProductId}
              onSelect={setSelectedProductId} analisis={analisis} nombre={analisisProducto}
              margen={margen} setMargen={setMargen}
              precioRecomendado={precioRecomendado} setPrecioRecomendado={setPrecioRecomendado}
              onCalcular={async () => {
                if (!selectedProductId) return
                try {
                  const r = await callApi<any>('productor:precio-recomendado', {
                    producto_id: selectedProductId, margen_porcentaje: margen, usuario_id: 1,
                  })
                  setPrecioRecomendado(r)
                } catch (err: any) { toast.error(err?.message || t('common.error')) }
              }}
            />
          )}
          {tab === 'siembras' && (
            <TabSiembras siembras={siembras} puedeEditar={puedeEditar}
              onCosechar={(s) => setCosechando(s)}
              onAddCosto={(s) => setModalCosto({ siembraId: s.id, cultivo: s.cultivo_nombre })}
            />
          )}
          {tab === 'costos' && (
            <TabCostos costos={costos} />
          )}
        </>
      )}

      {/* Modals */}
      {modalCadena && (
        <ModalCadena productos={productos} editing={editingCadena}
          onClose={() => { setModalCadena(false); setEditingCadena(null) }}
          onSaved={async () => { setModalCadena(false); setEditingCadena(null); await loadCadenas() }} />
      )}
      {detailCadena && (
        <ModalDetalleCadena cadena={detailCadena} onClose={() => setDetailCadena(null)} />
      )}
      {modalLote && (
        <ModalLote cadenas={cadenas}
          onClose={() => setModalLote(false)}
          onSaved={async () => { setModalLote(false); await loadLotes(); await loadCadenas() }} />
      )}
      {modalSiembra && (
        <ModalSiembra cultivos={cultivos}
          onClose={() => setModalSiembra(false)}
          onSaved={async () => { setModalSiembra(false); await loadSiembras() }} />
      )}
      {modalCosto && (
        <ModalCosto siembraId={modalCosto.siembraId} cultivo={modalCosto.cultivo}
          onClose={() => setModalCosto(null)}
          onSaved={async () => { setModalCosto(null); await loadSiembras() }} />
      )}
      {cosechando && (
        <ModalCosechar siembra={cosechando}
          onClose={() => setCosechando(null)}
          onDone={async () => { setCosechando(null); await loadSiembras() }} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: Cadenas de Producción
// ═══════════════════════════════════════════════════════════════════════
function TabCadenas({ cadenas, puedeEditar, onEdit, onDetail, onDelete }: {
  cadenas: Cadena[]; puedeEditar: boolean
  onEdit: (c: Cadena) => void; onDetail: (c: Cadena) => void; onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [sortBy, setSortBy] = useState<'nombre' | 'costo_total' | 'pasos_count' | 'producto_nombre'>('nombre')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const toggleSort = (col: typeof sortBy) => {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const SortIcon = ({ col }: { col: typeof sortBy }) => (
    <span className="ml-1 text-gray-400 inline-block w-3">
      {sortBy === col ? (sortDir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  )

  const filtered = cadenas
    .filter(c => {
      if (statusFilter === 'active' && !c.activo) return false
      if (statusFilter === 'inactive' && c.activo) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return c.producto_nombre.toLowerCase().includes(q) ||
               c.nombre.toLowerCase().includes(q)
      }
      return true
    })
    .sort((a, b) => {
      const aVal = a[sortBy]
      const bVal = b[sortBy]
      if (typeof aVal === 'string' && typeof bVal === 'string')
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      return sortDir === 'asc' ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number)
    })

  const colCount = puedeEditar ? 9 : 8

  return (
    <div className="space-y-3">
      {/* Filters bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('productor.cadena.search', { defaultValue: 'Buscar por producto o nombre...' })}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">{t('common.all', { defaultValue: 'Todos' })}</option>
          <option value="active">{t('productor.cadena.active')}</option>
          <option value="inactive">{t('productor.cadena.inactive')}</option>
        </select>
        <span className="text-xs text-gray-400">
          {filtered.length} / {cadenas.length}
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th><button onClick={() => toggleSort('producto_nombre')} className="hover:text-gray-700">{t('productor.cadena.product')}<SortIcon col="producto_nombre" /></button></Th>
              <Th><button onClick={() => toggleSort('nombre')} className="hover:text-gray-700">{t('productor.cadena.title')}<SortIcon col="nombre" /></button></Th>
              <Th right><button onClick={() => toggleSort('pasos_count')} className="hover:text-gray-700">{t('productor.cadena.steps')}<SortIcon col="pasos_count" /></button></Th>
              <Th right>{t('productor.cadena.materialCost')}</Th>
              <Th right>{t('productor.cadena.laborCost')}</Th>
              <Th right>{t('productor.cadena.overheadCost')}</Th>
              <Th right><button onClick={() => toggleSort('costo_total')} className="hover:text-gray-700">{t('productor.cadena.totalCost')}<SortIcon col="costo_total" /></button></Th>
              <Th>{t('contable.colStatus')}</Th>
              {puedeEditar && <Th right>{t('common.actions')}</Th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={colCount} className="text-center py-10 text-gray-400">
                {search || statusFilter !== 'all'
                  ? t('productor.cadena.noResults', { defaultValue: 'No se encontraron cadenas con esos filtros' })
                  : t('productor.cadena.noChains')}
              </td></tr>
            ) : filtered.map(c => (
              <tr key={c.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onDetail(c)}>
                <td className="px-3 py-2 font-medium">{c.producto_nombre}</td>
                <td className="px-3 py-2">{c.nombre}</td>
                <td className="px-3 py-2 text-right">{c.pasos_count}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.costo_materiales)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.costo_mano_obra)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(c.costo_overhead)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(c.costo_total)}</td>
                <td className="px-3 py-2">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {c.activo ? t('productor.cadena.active') : t('productor.cadena.inactive')}
                  </span>
                </td>
                {puedeEditar && (
                  <td className="px-3 py-2 text-right space-x-2" onClick={e => e.stopPropagation()}>
                    <button onClick={() => onEdit(c)} className="text-blue-600 hover:underline text-sm"><Edit2 className="w-4 h-4 inline" /></button>
                    <button onClick={() => onDelete(c.id)} className="text-red-600 hover:underline text-sm"><Trash2 className="w-4 h-4 inline" /></button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: Producción (Lotes)
// ═══════════════════════════════════════════════════════════════════════
function TabProduccion({ lotes, onCompletar, onCancelar }: {
  lotes: Lote[]; onCompletar: (id: number) => void; onCancelar: (id: number) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      en_proceso: 'bg-yellow-100 text-yellow-700',
      completado: 'bg-green-100 text-green-700',
      cancelado: 'bg-gray-100 text-gray-500',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || 'bg-gray-100 text-gray-600'}`}>
      {t(`productor.lote.estado.${estado}`, { defaultValue: estado })}
    </span>
  }

  const filtered = lotes
    .filter(l => {
      if (statusFilter !== 'all' && l.estado !== statusFilter) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return l.cadena_nombre.toLowerCase().includes(q) ||
               l.producto_nombre.toLowerCase().includes(q)
      }
      return true
    })

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('productor.lote.search', { defaultValue: 'Buscar por cadena o producto...' })}
            className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="all">{t('common.all', { defaultValue: 'Todos' })}</option>
          <option value="en_proceso">{t('productor.lote.estado.en_proceso')}</option>
          <option value="completado">{t('productor.lote.estado.completado')}</option>
          <option value="cancelado">{t('productor.lote.estado.cancelado')}</option>
        </select>
        <span className="text-xs text-gray-400">
          {filtered.length} / {lotes.length}
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <Th>#</Th>
              <Th>{t('productor.lote.chain')}</Th>
              <Th>{t('productor.cadena.product')}</Th>
              <Th right>{t('productor.lote.produced')}</Th>
              <Th right>{t('productor.lote.materialCost')}</Th>
              <Th right>{t('productor.lote.unitCost')}</Th>
              <Th right>{t('productor.lote.totalCost')}</Th>
              <Th>{t('productor.lote.status')}</Th>
              <Th>{t('productor.lote.startDate')}</Th>
              <Th right>{t('common.actions')}</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-10 text-gray-400">
                {search || statusFilter !== 'all'
                  ? t('productor.lote.noResults', { defaultValue: 'No se encontraron lotes con esos filtros' })
                  : t('productor.lote.noLots')}
              </td></tr>
            ) : filtered.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-400">{l.id}</td>
                <td className="px-3 py-2">{l.cadena_nombre}</td>
                <td className="px-3 py-2 font-medium">{l.producto_nombre}</td>
                <td className="px-3 py-2 text-right">{l.cantidad_producida}</td>
                <td className="px-3 py-2 text-right">{formatMoney(l.costo_materiales)}</td>
                <td className="px-3 py-2 text-right">{formatMoney(l.costo_unitario)}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatMoney(l.costo_total)}</td>
                <td className="px-3 py-2">{estadoBadge(l.estado)}</td>
                <td className="px-3 py-2 text-gray-500">{l.fecha_inicio?.slice(0, 10)}</td>
                <td className="px-3 py-2 text-right space-x-2">
                  {l.estado === 'en_proceso' && (
                    <>
                      <button onClick={() => onCompletar(l.id)} className="text-green-600 hover:underline text-sm">{t('productor.lote.estado.completado')}</button>
                      <button onClick={() => onCancelar(l.id)} className="text-red-600 hover:underline text-sm">{t('productor.lote.estado.cancelado')}</button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: Análisis de Costos
// ═══════════════════════════════════════════════════════════════════════
function TabAnalisis({ productos, selectedProductId, onSelect, analisis, nombre, margen, setMargen, precioRecomendado, setPrecioRecomendado, onCalcular }: {
  productos: Producto[]; selectedProductId: number | null; onSelect: (id: number) => void
  analisis: AnalisisCosto | null; nombre: string
  margen: number; setMargen: (v: number) => void
  precioRecomendado: any; setPrecioRecomendado: (v: any) => void
  onCalcular: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select value={selectedProductId || ''} onChange={(e) => { onSelect(Number(e.target.value)); setPrecioRecomendado(null) }}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('productor.analisis.selectProduct')}</option>
          {productos.map(p => (
            <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>
          ))}
        </select>
      </div>

      {!selectedProductId && (
        <div className="text-center py-16 text-gray-400">{t('productor.analisis.noAnalysis')}</div>
      )}

      {selectedProductId && !analisis && (
        <div className="text-center py-16 text-gray-400">{t('productor.analisis.noChain')}</div>
      )}

      {analisis && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Cost breakdown */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">{t('productor.cadena.totalCost')} — {nombre}</h3>
            <div className="space-y-3">
              <CostBar label={t('productor.cadena.materialCost')} value={analisis.costo_materiales} total={analisis.costo_total} color="bg-blue-500" />
              <CostBar label={t('productor.cadena.laborCost')} value={analisis.costo_mano_obra} total={analisis.costo_total} color="bg-green-500" />
              <CostBar label={t('productor.cadena.overheadCost')} value={analisis.costo_overhead} total={analisis.costo_total} color="bg-orange-500" />
            </div>
            <div className="flex justify-between items-center pt-3 border-t border-gray-200">
              <span className="font-semibold text-gray-900">{t('productor.cadena.totalCost')}</span>
              <span className="text-xl font-bold text-green-600">{formatMoney(analisis.costo_total)}</span>
            </div>

            {/* Steps detail */}
            {analisis.pasos.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">{t('productor.cadena.steps')}</h4>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                  {analisis.pasos.map((p: any, i: number) => (
                    <div key={i} className="px-3 py-2 flex justify-between">
                      <span>{p.orden}. {p.base_nombre} × {p.cantidad} {p.unidad}</span>
                      <span className="font-medium">{formatMoney(p.costo_total_linea)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Pricing calculator */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <h3 className="font-bold text-gray-900">{t('productor.analisis.pricing')}</h3>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">{t('productor.analisis.margin')}</label>
              <input type="number" value={margen} onChange={(e) => setMargen(Number(e.target.value))} min="0" max="500"
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right" />
              <span className="text-sm text-gray-400">%</span>
              <button onClick={onCalcular}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
                {t('productor.analisis.applyMargin')}
              </button>
            </div>

            {precioRecomendado && (
              <div className="bg-green-50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('productor.cadena.totalCost')}</span>
                  <span>{formatMoney(precioRecomendado.costo_total)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">{t('productor.analisis.margin')}</span>
                  <span>{precioRecomendado.margen_porcentaje}%</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-green-200">
                  <span className="font-semibold">{t('productor.analisis.recommendedPrice')}</span>
                  <span className="text-2xl font-bold text-green-700">{formatMoney(precioRecomendado.precio_recomendado)}</span>
                </div>
              </div>
            )}

            {/* Recent lots */}
            {analisis.lotes_recientes.length > 0 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-600 mb-2">{t('productor.analisis.recentLots')}</h4>
                <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
                  {analisis.lotes_recientes.map((l: any, i: number) => (
                    <div key={i} className="px-3 py-2 flex justify-between">
                      <span>{l.fecha_fin?.slice(0, 10) || l.fecha_inicio?.slice(0, 10)} — {l.cantidad_producida} uds</span>
                      <span className="font-medium">{formatMoney(l.costo_unitario)}/ud</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: Siembras (Agriculture — existing)
// ═══════════════════════════════════════════════════════════════════════
function TabSiembras({ siembras, puedeEditar, onCosechar, onAddCosto }: {
  siembras: Siembra[]; puedeEditar: boolean
  onCosechar: (s: Siembra) => void; onAddCosto: (s: Siembra) => void
}) {
  const { t } = useTranslation()
  const estadoBadge = (estado: string) => {
    const styles: Record<string, string> = {
      activa: 'bg-green-100 text-green-700',
      cosechada: 'bg-blue-100 text-blue-700',
      cancelada: 'bg-gray-100 text-gray-500',
    }
    return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${styles[estado] || 'bg-gray-100 text-gray-600'}`}>
      {t(`productor.estado.${estado}`, { defaultValue: estado })}
    </span>
  }

  return (
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
          ) : siembras.map(s => (
            <tr key={s.id} className="hover:bg-gray-50">
              <td className="px-3 py-2 font-medium">{s.cultivo_nombre}</td>
              <td className="px-3 py-2 text-gray-500">{s.descripcion || '—'}</td>
              <td className="px-3 py-2">{s.fecha_siembra?.slice(0, 10)}</td>
              <td className="px-3 py-2 text-right">{s.area} {s.unidad_area}</td>
              <td className="px-3 py-2 text-right">
                <button onClick={() => onAddCosto(s)} className="text-blue-600 hover:underline">
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
                    <button onClick={() => onCosechar(s)}
                      className="text-green-600 hover:underline text-sm">{t('productor.harvestAction')}</button>
                  )}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
// TAB: Costos de Campo
// ═══════════════════════════════════════════════════════════════════════
function TabCostos({ costos }: { costos: Costo[] }) {
  const { t } = useTranslation()
  return (
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
          ) : costos.map(c => (
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
  )
}

// ═══════════════════════════════════════════════════════════════════════
// MODALS
// ═══════════════════════════════════════════════════════════════════════

function ModalCadena({ productos, editing, onClose, onSaved }: {
  productos: Producto[]; editing: Cadena | null; onClose: () => void; onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [productoFinalId, setProductoFinalId] = useState(editing?.producto_final_id || '')
  const [nombre, setNombre] = useState(editing?.nombre || '')
  const [descripcion, setDescripcion] = useState(editing?.descripcion || '')
  const [tiempo, setTiempo] = useState(editing?.tiempo_estimado_minutos || 0)
  const [manoObra, setManoObra] = useState(editing?.costo_mano_obra_hora || 0)
  const [overhead, setOverhead] = useState(editing?.overhead_porcentaje || 0)
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      if (editing) {
        await callApi('productor:cadena-update', {
          id: editing.id,
          data: { nombre: nombre.trim(), descripcion: descripcion.trim() || null, tiempo_estimado_minutos: Number(tiempo), costo_mano_obra_hora: Number(manoObra), overhead_porcentaje: Number(overhead) },
          usuario_id: 1,
        })
        toast.success(t('productor.cadena.updated'))
      } else {
        await callApi('productor:cadena-create', {
          producto_final_id: Number(productoFinalId), nombre: nombre.trim(), descripcion: descripcion.trim() || undefined,
          tiempo_estimado_minutos: Number(tiempo), costo_mano_obra_hora: Number(manoObra), overhead_porcentaje: Number(overhead), usuario_id: 1,
        })
        toast.success(t('productor.cadena.created'))
      }
      onSaved()
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{editing ? t('productor.cadena.updated') : t('productor.cadena.newChain')}</h2>
        {!editing && (
          <select value={productoFinalId} onChange={e => setProductoFinalId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="">{t('productor.cadena.selectProduct')}</option>
            {productos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        )}
        <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder={t('productor.cadena.title')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input value={descripcion || ''} onChange={e => setDescripcion(e.target.value)} placeholder={t('productor.description')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-gray-500">{t('productor.cadena.estimatedTime')}</label>
            <input type="number" value={tiempo} onChange={e => setTiempo(Number(e.target.value))} min="0"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('productor.cadena.laborRate')}</label>
            <input type="number" value={manoObra} onChange={e => setManoObra(Number(e.target.value))} min="0" step="0.01"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div>
            <label className="text-xs text-gray-500">{t('productor.cadena.overheadPct')}</label>
            <input type="number" value={overhead} onChange={e => setOverhead(Number(e.target.value))} min="0" max="100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          <button onClick={guardar} disabled={saving || !nombre.trim() || (!editing && !productoFinalId)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalDetalleCadena({ cadena, onClose }: { cadena: CadenaDetalle; onClose: () => void }) {
  const { t } = useTranslation()
  const toast = useToast()
  const [currentCadena, setCurrentCadena] = useState(cadena)
  const [showAddStep, setShowAddStep] = useState(false)
  const [productos, setProductos] = useState<Producto[]>([])
  const [stepProductoId, setStepProductoId] = useState('')
  const [stepCantidad, setStepCantidad] = useState('')
  const [stepUnidad, setStepUnidad] = useState('unidad')
  const [stepCosto, setStepCosto] = useState('')

  useEffect(() => {
    callApi<Producto[]>('productos:list', {}).then(setProductos).catch(() => {})
  }, [])

  const reloadDetail = async () => {
    try {
      const d = await callApi<CadenaDetalle>('productor:cadena-detail', { id: currentCadena.id, usuario_id: 1 })
      setCurrentCadena(d)
    } catch {}
  }

  const addStep = async () => {
    try {
      await callApi('productor:cadena-paso-add', {
        cadena_id: currentCadena.id, producto_base_id: Number(stepProductoId),
        cantidad: Number(stepCantidad), unidad: stepUnidad || 'unidad',
        costo_unitario_override: stepCosto ? Number(stepCosto) : undefined, usuario_id: 1,
      })
      toast.success(t('productor.cadena.stepAdded'))
      setShowAddStep(false)
      setStepProductoId(''); setStepCantidad(''); setStepCosto('')
      await reloadDetail()
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-lg p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">{currentCadena.nombre} — {currentCadena.producto_nombre}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-4 gap-3">
          <MiniCard label={t('productor.cadena.materialCost')} value={formatMoney(currentCadena.resumen.costo_materiales)} color="blue" />
          <MiniCard label={t('productor.cadena.laborCost')} value={formatMoney(currentCadena.resumen.costo_mano_obra)} color="green" />
          <MiniCard label={t('productor.cadena.overheadCost')} value={formatMoney(currentCadena.resumen.costo_overhead)} color="orange" />
          <MiniCard label={t('productor.cadena.totalCost')} value={formatMoney(currentCadena.resumen.costo_total)} color="purple" bold />
        </div>

        {/* Steps */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-semibold text-gray-700">{t('productor.cadena.steps')} ({currentCadena.pasos.length})</h3>
            <button onClick={() => setShowAddStep(!showAddStep)} className="text-sm text-green-600 hover:underline">
              <Plus className="w-4 h-4 inline" /> {t('productor.cadena.stepAdd')}
            </button>
          </div>

          {showAddStep && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2">
              <select value={stepProductoId} onChange={e => setStepProductoId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
                <option value="">{t('productor.cadena.selectProduct')}</option>
                {productos.map(p => <option key={p.id} value={p.id}>{p.nombre} (stock: {p.stock})</option>)}
              </select>
              <div className="grid grid-cols-3 gap-2">
                <input type="number" value={stepCantidad} onChange={e => setStepCantidad(e.target.value)} placeholder={t('productor.cadena.stepQuantity')} min="0" step="any"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <input value={stepUnidad} onChange={e => setStepUnidad(e.target.value)} placeholder={t('productor.cadena.stepUnit')}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                <input type="number" value={stepCosto} onChange={e => setStepCosto(e.target.value)} placeholder={t('productor.cadena.stepCostOverride')} min="0" step="0.01"
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <button onClick={addStep} disabled={!stepProductoId || !(Number(stepCantidad) > 0)}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
                {t('productor.cadena.stepAdd')}
              </button>
            </div>
          )}

          {currentCadena.pasos.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 text-center">{t('productor.cadena.noSteps')}</p>
          ) : (
            <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm">
              {currentCadena.pasos.map(p => (
                <div key={p.id} className="px-3 py-2 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-gray-400 w-6 text-center">{p.orden}</span>
                    <div>
                      <span className="font-medium">{p.base_nombre}</span>
                      <span className="text-gray-500 ml-2">{p.cantidad} {p.unidad}</span>
                      {p.costo_unitario_override != null && (
                        <span className="text-orange-500 text-xs ml-1">override: {formatMoney(p.costo_unitario_override)}</span>
                      )}
                    </div>
                  </div>
                  <span className="font-medium">{formatMoney(p.costo_total_linea)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalLote({ cadenas, onClose, onSaved }: {
  cadenas: Cadena[]; onClose: () => void; onSaved: () => void
}) {
  const { t } = useTranslation()
  const toast = useToast()
  const [cadenaId, setCadenaId] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)

  const guardar = async () => {
    setSaving(true)
    try {
      const r = await callApi<any>('productor:lote-create', {
        cadena_id: Number(cadenaId), cantidad_producida: Number(cantidad), notas: notas.trim() || undefined, usuario_id: 1,
      })
      if (r?.success === false) {
        toast.error(r.error)
      } else {
        toast.success(t('productor.lote.created'))
        onSaved()
      }
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
    finally { setSaving(false) }
  }

  const selectedCadena = cadenas.find(c => c.id === Number(cadenaId))
  const costoUnitario = selectedCadena && Number(cantidad) > 0
    ? (selectedCadena.costo_total * Number(cantidad)) / Number(cantidad)
    : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.lote.newLot')}</h2>
        <select value={cadenaId} onChange={e => setCadenaId(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('productor.lote.chain')}</option>
          {cadenas.filter(c => c.activo).map(c => (
            <option key={c.id} value={c.id}>{c.nombre} — {c.producto_nombre} ({formatMoney(c.costo_total)}/ud)</option>
          ))}
        </select>
        <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder={t('productor.lote.quantity')} min="1"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input value={notas} onChange={e => setNotas(e.target.value)} placeholder={t('productor.lote.notes')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

        {selectedCadena && Number(cantidad) > 0 && (
          <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-gray-500">{t('productor.lote.materialCost')}</span><span>{formatMoney(selectedCadena.costo_materiales * Number(cantidad))}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('productor.lote.laborCost')}</span><span>{formatMoney(selectedCadena.costo_mano_obra * Number(cantidad))}</span></div>
            <div className="flex justify-between"><span className="text-gray-500">{t('productor.lote.overheadCost')}</span><span>{formatMoney(selectedCadena.costo_overhead * Number(cantidad))}</span></div>
            <div className="flex justify-between font-semibold border-t border-gray-200 pt-1">
              <span>{t('productor.lote.totalCost')}</span>
              <span>{formatMoney(selectedCadena.costo_total * Number(cantidad))}</span>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
          <button onClick={guardar} disabled={saving || !cadenaId || !(Number(cantidad) > 0)}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50">
            {t('common.save')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Existing modals (kept as-is) ───────────────────────────────────

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
      if (!cultivoIdFinal) { toast.error(t('productor.cropRequired')); setSaving(false); return }
      await callApi('productor:siembra-create', {
        cultivo_id: cultivoIdFinal, descripcion: descripcion || undefined, fecha_siembra: fecha || undefined,
        area: Number(area) || 0, unidad_area: unidadArea, cantidad_sembrada: Number(cantidad) || 0,
      })
      toast.success(t('productor.siembraCreated')); onSaved()
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
    finally { setSaving(false) }
  }

  const hayCultivos = cultivos.length > 0 || nuevoCultivo.trim().length > 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.newSiembra')}</h2>
        <select value={cultivoId} onChange={e => setCultivoId(e.target.value)} disabled={nuevoCultivo.trim().length > 0}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
          <option value="">{t('productor.selectCrop')}</option>
          {cultivos.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </select>
        <input value={nuevoCultivo} onChange={e => setNuevoCultivo(e.target.value)} placeholder={t('productor.orNewCrop')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder={t('productor.description')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <select value={unidadArea} onChange={e => setUnidadArea(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm">
            <option value="ha">ha</option><option value="m2">m²</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={area} onChange={e => setArea(e.target.value)} placeholder={t('productor.area')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder={t('productor.quantityPlanted')} min="0"
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
    callApi<Costo[]>('productor:costos-list', { siembra_id: siembraId }).then(setItems).catch(() => setItems([]))
  }, [siembraId])

  const guardar = async () => {
    setSaving(true)
    try {
      await callApi('productor:costo-create', { siembra_id: siembraId, concepto, monto: Number(monto), fecha: fecha || undefined })
      toast.success(t('productor.costoCreated')); setConcepto(''); setMonto('')
      const items2 = await callApi<Costo[]>('productor:costos-list', { siembra_id: siembraId }); setItems(items2 || []); onSaved()
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
    finally { setSaving(false) }
  }

  const total = items.reduce((acc, c) => acc + (c.monto || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-md p-5 space-y-3 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.fieldCosts')} — {cultivo}</h2>
        {items.length > 0 && (
          <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 text-sm max-h-40 overflow-y-auto">
            {items.map(c => (
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
        <input value={concepto} onChange={e => setConcepto(e.target.value)} placeholder={t('productor.concept')}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <div className="grid grid-cols-2 gap-3">
          <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder={t('common.total')} min="0"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
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
      const res = await callApi<any>('productor:siembra-cosechar', { id: siembra.id, cantidad_cosechada: Number(cantidad), fecha_cosecha: fecha || undefined })
      if (res?.success === false) toast.error(res.error)
      else { toast.success(t('productor.harvestDone', { cost: formatMoney(res?.costo_unitario || 0) })); onDone() }
    } catch (err: any) { toast.error(err?.message || t('common.error')) }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold">{t('productor.harvestAction')} — {siembra.cultivo_nombre}</h2>
        <p className="text-sm text-gray-500">{t('productor.harvestHint')}</p>
        <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm flex justify-between">
          <span>{t('productor.accumulatedCosts')}</span>
          <span className="font-semibold">{formatMoney(siembra.costos_total)}</span>
        </div>
        <input type="number" value={cantidad} onChange={e => setCantidad(e.target.value)} placeholder={t('productor.quantityHarvested')} min="0" step="any"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
        <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
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

// ─── Shared components ───────────────────────────────────────────────

function ResumenCard({ icon: Icon, label, value, detail, color }: { icon: any; label: string; value: string; detail?: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600', orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600', purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${colors[color] || 'bg-gray-100'}`}><Icon className="w-5 h-5" /></div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-lg font-bold text-gray-900">{value}</p>
        {detail && <p className="text-xs text-gray-400">{detail}</p>}
      </div>
    </div>
  )
}

function MiniCard({ label, value, color, bold }: { label: string; value: string; color: string; bold?: boolean }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50', green: 'bg-green-50', orange: 'bg-orange-50', purple: 'bg-purple-50',
  }
  return (
    <div className={`${colors[color] || 'bg-gray-50'} rounded-lg p-3`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-sm ${bold ? 'text-lg font-bold' : 'font-semibold'} text-gray-900`}>{value}</p>
    </div>
  )
}

function CostBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{formatMoney(value)} ({Math.round(pct)}%)</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <th className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${right ? 'text-right' : 'text-left'}`}>{children}</th>
}
