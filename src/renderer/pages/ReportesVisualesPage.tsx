import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BarChart3, Download, FileDown, Play, CalendarRange, Save, FolderOpen, Trash2 } from 'lucide-react'
import Modal from '../components/ui/Modal'
import { useToast } from '../components/ui/Toast'
import { formatCurrency, formatDate } from '../lib/utils'
import { callApi } from '../lib/api-client'

type SourceId = 'salesPerDay' | 'topProducts' | 'byCategory' | 'recentSales'
type FieldType = 'text' | 'number' | 'money' | 'date'

interface Field {
  key: string
  labelKey: string
  type: FieldType
}

interface SourceDef {
  labelKey: string
  channel: string
  needsRange: boolean
  fields: Field[]
}

const SOURCES: Record<SourceId, SourceDef> = {
  salesPerDay: {
    labelKey: 'reportesVisuales.sourceSalesPerDay',
    channel: 'reportes:ventas-periodo',
    needsRange: true,
    fields: [
      { key: 'fecha', labelKey: 'reportesVisuales.fDate', type: 'date' },
      { key: 'total_ventas', labelKey: 'reportesVisuales.fSales', type: 'number' },
      { key: 'monto_total', labelKey: 'reportesVisuales.fAmount', type: 'money' },
    ],
  },
  topProducts: {
    labelKey: 'reportesVisuales.sourceTopProducts',
    channel: 'reportes:productos-mas-vendidos',
    needsRange: true,
    fields: [
      { key: 'nombre', labelKey: 'reportesVisuales.fProduct', type: 'text' },
      { key: 'codigo_barras', labelKey: 'reportesVisuales.fCode', type: 'text' },
      { key: 'total_vendido', labelKey: 'reportesVisuales.fUnits', type: 'number' },
      { key: 'total_ingreso', labelKey: 'reportesVisuales.fIncome', type: 'money' },
    ],
  },
  byCategory: {
    labelKey: 'reportesVisuales.sourceByCategory',
    channel: 'reportes:ventas-por-categoria',
    needsRange: true,
    fields: [
      { key: 'categoria', labelKey: 'reportesVisuales.fCategory', type: 'text' },
      { key: 'total_ventas', labelKey: 'reportesVisuales.fSales', type: 'number' },
      { key: 'total_unidades', labelKey: 'reportesVisuales.fUnits', type: 'number' },
      { key: 'total_ingreso', labelKey: 'reportesVisuales.fIncome', type: 'money' },
    ],
  },
  recentSales: {
    labelKey: 'reportesVisuales.sourceRecentSales',
    channel: 'reportes:ultimas-ventas',
    needsRange: false,
    fields: [
      { key: 'numero_venta', labelKey: 'reportesVisuales.fNumber', type: 'number' },
      { key: 'fecha', labelKey: 'reportesVisuales.fDate', type: 'date' },
      { key: 'usuario_nombre', labelKey: 'reportesVisuales.fUser', type: 'text' },
      { key: 'metodo_pago', labelKey: 'reportesVisuales.fMethod', type: 'text' },
      { key: 'total', labelKey: 'reportesVisuales.fTotal', type: 'money' },
    ],
  },
}

interface SavedReport {
  id: number
  nombre: string
  fuente: string
  campos: string
  fecha_inicio: string | null
  fecha_fin: string | null
}

function allSelected(fields: Field[]): Record<string, boolean> {
  const all: Record<string, boolean> = {}
  for (const f of fields) all[f.key] = true
  return all
}

function formatCell(value: any, type: FieldType): string {
  if (value === null || value === undefined) return '—'
  if (type === 'money') return formatCurrency(Number(value))
  if (type === 'number') return Number(value).toLocaleString('en-US')
  if (type === 'date') return formatDate(String(value))
  return String(value)
}

export default function ReportesVisualesPage() {
  const { t } = useTranslation()
  const toast = useToast()

  const hoy = new Date()
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`
  const hoyStr = hoy.toISOString().split('T')[0]

  const [source, setSource] = useState<SourceId>('salesPerDay')
  const [fechaInicio, setFechaInicio] = useState(inicioMes)
  const [fechaFin, setFechaFin] = useState(hoyStr)
  const [selected, setSelected] = useState<Record<string, boolean>>(() => allSelected(SOURCES.salesPerDay.fields))
  const [rows, setRows] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  // Reportes guardados por usuario
  const [saved, setSaved] = useState<SavedReport[]>([])
  const [selectedSaved, setSelectedSaved] = useState('')
  const [saveOpen, setSaveOpen] = useState(false)
  const [saveName, setSaveName] = useState('')

  const src = SOURCES[source]

  useEffect(() => {
    generate()
  }, [refreshKey])

  useEffect(() => {
    loadSaved()
  }, [])

  const loadSaved = async () => {
    try {
      const list = await callApi<SavedReport[]>('reportes-visuales:list')
      setSaved(Array.isArray(list) ? list : [])
    } catch {}
  }

  const pickSource = (id: SourceId) => {
    setSource(id)
    setSelected(allSelected(SOURCES[id].fields))
    setRefreshKey((k) => k + 1)
  }

  const generate = async () => {
    setLoading(true)
    try {
      const payload: any = src.needsRange
        ? { fecha_inicio: fechaInicio, fecha_fin: fechaFin }
        : { limite: 200 }
      const data = await callApi<any[]>(src.channel as any, payload)
      setRows(Array.isArray(data) ? data : [])
    } catch (err: any) {
      toast.error(err?.message || 'Error')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  const saveCurrent = async () => {
    if (!saveName.trim()) return
    try {
      await callApi('reportes-visuales:save', {
        nombre: saveName.trim(),
        fuente: source,
        campos: src.fields.filter((f) => selected[f.key]).map((f) => f.key),
        fecha_inicio: src.needsRange ? fechaInicio : undefined,
        fecha_fin: src.needsRange ? fechaFin : undefined,
      })
      toast.success(t('reportesVisuales.saved'))
      setSaveOpen(false)
      setSaveName('')
      await loadSaved()
    } catch (err: any) {
      toast.error(err?.message || t('reportesVisuales.error'))
    }
  }

  const applySaved = (reportId: number) => {
    const s = saved.find((x) => x.id === reportId)
    if (!s) return
    let campos: Record<string, boolean> = {}
    try {
      const parsed = JSON.parse(s.campos)
      if (Array.isArray(parsed)) campos = Object.fromEntries(parsed.map((k: string) => [k, true]))
    } catch {}
    if (s.fuente in SOURCES) {
      const def = SOURCES[s.fuente as SourceId]
      campos = Object.keys(campos).length > 0 ? campos : allSelected(def.fields)
      setSource(s.fuente as SourceId)
      setSelected(campos)
    }
    if (s.fecha_inicio) setFechaInicio(s.fecha_inicio)
    if (s.fecha_fin) setFechaFin(s.fecha_fin)
    setRefreshKey((k) => k + 1)
  }

  const deleteSaved = async (reportId: number) => {
    try {
      await callApi('reportes-visuales:delete', { id: reportId })
      setSelectedSaved('')
      await loadSaved()
    } catch (err: any) {
      toast.error(err?.message || t('reportesVisuales.error'))
    }
  }

  const visibleFields = src.fields.filter((f) => selected[f.key])

  const exportCsv = () => {
    if (rows.length === 0) return
    const header = visibleFields.map((f) => t(f.labelKey).replace(/"/g, '""')).join(',')
    const lines = rows.map((r) =>
      visibleFields.map((f) => {
        const v = r[f.key]
        const s = v === null || v === undefined ? '' : String(v)
        return `"${s.replace(/"/g, '""')}"`
      }).join(','),
    )
    const csv = [header, ...lines].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-visual-${fechaInicio}-${fechaFin}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportPdf = () => {
    if (rows.length === 0) return
    const head = visibleFields.map((f) => `<th>${t(f.labelKey)}</th>`).join('')
    const body = rows
      .map((r) => `<tr>${visibleFields.map((f) => `<td>${formatCell(r[f.key], f.type)}</td>`).join('')}</tr>`)
      .join('')
    const win = window.open('', '_blank', 'width=840,height=640')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${t('reportesVisuales.title')} — TOG Admin</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:32px;background:#f3f4f6}
      .page{max-width:780px;margin:0 auto;background:#fff;padding:32px;border:1px solid #e5e7eb}
      h1{font-size:20px;border-bottom:2px solid #3b82f6;padding-bottom:8px;margin:0 0 6px}
      p{color:#6b7280;font-size:12px;margin:2px 0 12px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th{background:#f3f4f6;text-align:left;padding:8px;border:1px solid #e5e7eb;text-transform:uppercase;font-size:11px;color:#6b7280}
      td{padding:8px;border:1px solid #e5e7eb}
      @media print{body{background:#fff;padding:0}.page{box-shadow:none;border:none}}
    </style></head><body><div class="page">
      <h1>${t('reportesVisuales.title')} — ${t(src.labelKey)}</h1>
      <p>${src.needsRange ? `${t('reportesVisuales.dateRange')}: ${fechaInicio} → ${fechaFin} · ` : ''}${t('reportesVisuales.generated')}: ${new Date().toLocaleString()} · ${rows.length} ${t('reportesVisuales.rows')}</p>
      <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    </div></body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reportesVisuales.title')}</h1>
        <p className="text-sm text-gray-500">{t('reportesVisuales.subtitle')}</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" /> {t('reportesVisuales.dataSource')}
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(SOURCES) as SourceId[]).map((id) => (
              <button key={id} onClick={() => pickSource(id)}
                className={`px-3 py-2.5 text-sm font-medium rounded-lg border transition-colors text-left ${
                  source === id ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300'
                }`}>
                {t(SOURCES[id].labelKey)}
              </button>
            ))}
          </div>
        </div>

        {/* Reportes guardados */}
        <div className="flex flex-wrap items-end gap-2 border-t border-gray-100 pt-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-500 mb-1 flex items-center gap-1.5">
              <FolderOpen className="w-3.5 h-3.5" /> {t('reportesVisuales.savedReports')}
            </label>
            <select value={selectedSaved}
              onChange={(e) => { setSelectedSaved(e.target.value); if (e.target.value) applySaved(Number(e.target.value)) }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">{t('reportesVisuales.savedPlaceholder')}</option>
              {saved.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre} — {t(SOURCES[s.fuente as SourceId]?.labelKey || 'reportesVisuales.title')}</option>
              ))}
            </select>
          </div>
          <button onClick={() => { setSaveName(''); setSaveOpen(true) }}
            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 flex items-center gap-2">
            <Save className="w-4 h-4" /> {t('reportesVisuales.saveReport')}
          </button>
          {selectedSaved && (
            <button onClick={() => deleteSaved(Number(selectedSaved))}
              className="px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
              title={t('reportesVisuales.deleteReport')}>
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          {src.needsRange && (
            <div className="md:col-span-2 grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('reportesVisuales.from')}</label>
                <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('reportesVisuales.to')}</label>
                <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={() => setRefreshKey((k) => k + 1)}
              className="flex-1 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
              <Play className="w-4 h-4" /> {t('reportesVisuales.generate')}
            </button>
            <button onClick={exportCsv} disabled={rows.length === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center gap-2"
              title={t('reportesVisuales.exportCsv')}>
              <Download className="w-4 h-4" />
            </button>
            <button onClick={exportPdf} disabled={rows.length === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-2"
              title={t('reportesVisuales.exportPdf')}>
              <FileDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <CalendarRange className="w-4 h-4 text-gray-500" /> {t('reportesVisuales.fields')}
          </label>
          <div className="flex flex-wrap gap-2">
            {src.fields.map((f) => (
              <label key={f.key}
                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm cursor-pointer transition-colors ${
                  selected[f.key] ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-500'
                }`}>
                <input type="checkbox" checked={!!selected[f.key]}
                  onChange={(e) => setSelected({ ...selected, [f.key]: e.target.checked })}
                  className="accent-blue-600" />
                {t(f.labelKey)}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">{rows.length} {t('reportesVisuales.rows')}</p>
          <div className="flex gap-2">
            <button onClick={exportCsv} disabled={rows.length === 0}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:bg-green-300 flex items-center gap-1.5">
              <Download className="w-3.5 h-3.5" /> {t('reportesVisuales.exportCsv')}
            </button>
            <button onClick={exportPdf} disabled={rows.length === 0}
              className="px-3 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 flex items-center gap-1.5">
              <FileDown className="w-3.5 h-3.5" /> {t('reportesVisuales.exportPdf')}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <BarChart3 className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>{t('reportesVisuales.noData')}</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {visibleFields.map((f) => (
                    <th key={f.key} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t(f.labelKey)}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    {visibleFields.map((f) => (
                      <td key={f.key} className={`px-4 py-2.5 text-gray-700 ${f.type === 'money' ? 'font-medium text-right' : ''}`}>
                        {formatCell(r[f.key], f.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal guardar reporte */}
      <Modal open={saveOpen} onClose={() => setSaveOpen(false)} title={t('reportesVisuales.saveReport')}>
        <div className="space-y-4">
          <p className="text-sm text-gray-500">{t('reportesVisuales.saveHint')} — {t(src.labelKey)}</p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('reportesVisuales.savedName')} *</label>
            <input value={saveName} onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && saveName.trim()) saveCurrent() }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
              placeholder={t('reportesVisuales.savedNamePlaceholder')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setSaveOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg">{t('quotes.cancel')}</button>
            <button onClick={saveCurrent} disabled={!saveName.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-300">
              <Save className="w-4 h-4 inline mr-1" /> {t('reportesVisuales.saveReport')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}