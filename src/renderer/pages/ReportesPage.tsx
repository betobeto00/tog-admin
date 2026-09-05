import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { BarChart3, TrendingUp, Package, Calendar, Download, FileText } from 'lucide-react'
import { formatDateTime } from '../lib/utils'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'

interface VentaDiaria { fecha: string; total_ventas: number; monto_total: number }
interface TopProducto { nombre: string; tipo: 'producto' | 'servicio'; total_vendido: number; total_ingreso: number }
interface ResumenDia {
  total_ventas: number; monto_total: number; efectivo: number; transferencia: number; pago_movil: number
  por_metodo?: { clave: string; nombre: string; total: number }[]
}
interface VentaCategoria { categoria: string; total_ventas: number; total_unidades: number; total_ingreso: number }

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function ReportesPage() {
  const [fechaInicio, setFechaInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0])

  const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>([])
  const [topProductos, setTopProductos] = useState<TopProducto[]>([])
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [ventasCategoria, setVentasCategoria] = useState<VentaCategoria[]>([])
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReportes() }, [fechaInicio, fechaFin])

  const loadReportes = async () => {
    setLoading(true)
    const [diarias, top, res, cat] = await Promise.all([
      callApi<VentaDiaria[]>('reportes:ventas-periodo', { fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
      callApi<TopProducto[]>('reportes:productos-mas-vendidos', { fecha_inicio: fechaInicio, fecha_fin: fechaFin, limite: 10 }),
      callApi<ResumenDia>('ventas:resumen-dia'),
      callApi<VentaCategoria[]>('reportes:ventas-por-categoria', { fecha_inicio: fechaInicio, fecha_fin: fechaFin }),
    ])
    setVentasDiarias(diarias)
    setTopProductos(top)
    setResumen(res)
    setVentasCategoria(cat)
    setLoading(false)
  }

  // Datos para gráfica de líneas (ventas por día)
  const lineData = ventasDiarias.map((v) => ({
    fecha: v.fecha.split('-').slice(1).join('/'), // MM/DD
    ventas: v.total_ventas,
    monto: v.monto_total,
  }))

  // Datos para gráfica de barras (top productos)
  const barData = topProductos.map((p) => ({
    nombre: p.nombre.length > 15 ? p.nombre.slice(0, 15) + '...' : p.nombre,
    vendidos: p.total_vendido,
    ingreso: p.total_ingreso,
  }))

  // Datos para pie chart (métodos de pago del día, según métodos configurados)
  const pieData = (resumen?.por_metodo || [])
    .map((m) => ({ name: m.nombre, value: m.total }))
    .filter((d) => d.value > 0)

  // Totales del período
  const totalPeriodo = ventasDiarias.reduce((acc, v) => acc + v.monto_total, 0)
  const totalVentasPeriodo = ventasDiarias.reduce((acc, v) => acc + v.total_ventas, 0)
  const promedioDiario = ventasDiarias.length > 0 ? totalPeriodo / ventasDiarias.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('reportes.title')}</h1>
        <p className="text-sm text-gray-500">{t('reportes.subtitle')}</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('reportes.startDate')}</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('reportes.endDate')}</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFechaInicio(d.toISOString().split('T')[0]); setFechaFin(new Date().toISOString().split('T')[0]) }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          {t('reportes.last7')}
        </button>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setFechaInicio(d.toISOString().split('T')[0]); setFechaFin(new Date().toISOString().split('T')[0]) }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          {t('reportes.last30')}
        </button>
        <div className="flex-1" />
        <button onClick={() => {
          const rows = [[t('common.date'), t('reportes.sales'), t('common.total')]]
          ventasDiarias.forEach(v => rows.push([v.fecha, String(v.total_ventas), String(v.monto_total)]))
          rows.push([])
          rows.push([t('inventario.productName'), t('reportes.units'), t('reportes.income')])
          topProductos.forEach(p => rows.push([p.nombre, String(p.total_vendido), String(p.total_ingreso)]))
          rows.push([])
          rows.push([t('reportes.category'), t('reportes.sales'), t('reportes.units'), t('reportes.income')])
          ventasCategoria.forEach(c => rows.push([c.categoria, String(c.total_ventas), String(c.total_unidades), String(c.total_ingreso)]))
          const csv = rows.map(r => r.join(',')).join('\n')
          const blob = new Blob([csv], { type: 'text/csv' })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a'); a.href = url; a.download = `reporte-${fechaInicio}-${fechaFin}.csv`; a.click()
          URL.revokeObjectURL(url)
        }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700">
          <Download className="w-4 h-4" /> {t('reportes.exportCsv')}
        </button>
        <button onClick={() => {
          const win = window.open('', '_blank', 'width=800,height=600')
          if (!win) return
win.document.write(`<html><head><title>${t('reportes.reportTitle')} - TOG Admin</title><style>
            body{font-family:Arial,sans-serif;padding:20px;color:#333}
            h1{font-size:20px;border-bottom:2px solid #3b82f6;padding-bottom:8px}
            h2{font-size:16px;margin-top:20px;color:#1e40af}
            table{width:100%;border-collapse:collapse;margin:10px 0}
            th,td{padding:8px 12px;border:1px solid #e5e7eb;text-align:left;font-size:13px}
            th{background:#f3f4f6;font-weight:600}
            .total{font-weight:bold;font-size:15px}
            .summary{display:flex;gap:20px;margin:15px 0}
            .card{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;flex:1}
            .card p{font-size:12px;color:#6b7280}
            .card span{font-size:18px;font-weight:bold}
          </style></head><body>
            <h1>TOG Admin — ${t('reportes.reportTitle')}</h1>
            <p>${t('reportes.periodLabel')} ${fechaInicio} - ${fechaFin} | ${t('reportes.generated')} ${new Date().toLocaleString()}</p>
            <div class="summary">
              <div class="card"><p>${t('reportes.totalPeriod')}</p><span>$${totalPeriodo.toFixed(2)}</span></div>
              <div class="card"><p>${t('reportes.totalTickets')}</p><span>${totalVentasPeriodo}</span></div>
              <div class="card"><p>${t('reportes.dailyAvg')}</p><span>$${promedioDiario.toFixed(2)}</span></div>
            </div>
            <h2>${t('reportes.salesByDay')}</h2>
            <table><thead><tr><th>${t('reportes.date')}</th><th>${t('reportes.salesCount')}</th><th>${t('reportes.amount')}</th></tr></thead><tbody>
              ${ventasDiarias.map(v => `<tr><td>${v.fecha}</td><td>${v.total_ventas}</td><td>$${v.monto_total.toFixed(2)}</td></tr>`).join('')}
            </tbody></table>
            <h2>${t('reportes.topProducts')}</h2>
            <table><thead><tr><th>${t('reportes.product')}</th><th>${t('reportes.sold')}</th><th>${t('reportes.income')}</th></tr></thead><tbody>
              ${topProductos.map(p => `<tr><td>${p.nombre}</td><td>${p.total_vendido}</td><td>$${p.total_ingreso.toFixed(2)}</td></tr>`).join('')}
            </tbody></table>
            <h2>${t('reportes.salesByCategory')}</h2>
            <table><thead><tr><th>${t('reportes.category')}</th><th>${t('reportes.salesCount')}</th><th>${t('reportes.units')}</th><th>${t('reportes.income')}</th></tr></thead><tbody>
              ${ventasCategoria.map(c => `<tr><td>${c.categoria}</td><td>${c.total_ventas}</td><td>${c.total_unidades}</td><td>$${c.total_ingreso.toFixed(2)}</td></tr>`).join('')}
            </tbody></table>
            <script>window.onload=()=>{window.print()}</script>
          </body></html>`)
          win.document.close()
        }} className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
          <FileText className="w-4 h-4" /> {t('reportes.printPdf')}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <>
          {/* Tarjetas resumen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-blue-50 rounded-lg"><TrendingUp className="w-5 h-5 text-blue-600" /></div>
                <span className="text-sm text-gray-500">{t('reportes.totalPeriod')}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(totalPeriodo)}</p>
              <p className="text-xs text-gray-400 mt-1">{t('reportes.periodSummary', { days: ventasDiarias.length })}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-50 rounded-lg"><BarChart3 className="w-5 h-5 text-green-600" /></div>
                <span className="text-sm text-gray-500">{t('reportes.dailyAvg')}</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatMoney(promedioDiario)}</p>
              <p className="text-xs text-gray-400 mt-1">{t('reportes.avgPerDay')}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-50 rounded-lg"><Package className="w-5 h-5 text-purple-600" /></div>
                <span className="text-sm text-gray-500">{t('reportes.topProduct')}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{topProductos[0]?.nombre || '—'}</p>
              <p className="text-xs text-gray-400 mt-1">{topProductos[0] ? `${topProductos[0].total_vendido} ${t('inventario.units')}` : t('reportes.noData')}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfica de ventas por día */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">{t('reportes.salesByDayChart')}</h3>
              {lineData.length === 0 ? (
                <p className="text-center text-gray-400 py-12">{t('reportes.noDataPeriod')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                    <Legend />
                    <Line type="monotone" dataKey="monto" name="Ingresos ($)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top productos más vendidos */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">{t('reportes.topProductsChart')}</h3>
              {barData.length === 0 ? (
                <p className="text-center text-gray-400 py-12">{t('reportes.noDataPeriod')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value) => Number(value).toLocaleString()} />
                    <Bar dataKey="vendidos" name="Unidades" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Métodos de pago */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">{t('reportes.paymentMethodsChart')}</h3>
              {pieData.length === 0 ? (
                <p className="text-center text-gray-400 py-12">{t('reportes.noSalesToday')}</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={100} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatMoney(Number(value))} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Ventas por categoría */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">{t('reportes.categoryChart')}</h3>
              {ventasCategoria.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No hay datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={ventasCategoria} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="categoria" type="category" width={120} tick={{ fontSize: 10 }} />
<Tooltip formatter={(value) => formatMoney(Number(value))} />
                  <Bar dataKey="total_ingreso" name="Ingreso ($)" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tabla de top productos */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">{t('reportes.topProductsDetail')}</h3>
              {topProductos.length === 0 ? (
                <p className="text-center text-gray-400 py-12">{t('reportes.noDataShort')}</p>
              ) : (
                <div className="overflow-y-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t('reportes.product')}</th>
                        <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">{t('reportes.type')}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t('reportes.sold')}</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t('reportes.income')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topProductos.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 font-medium">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                          <td className="px-3 py-2 text-center">
                            {p.tipo === 'servicio' ? (
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-sky-100 text-sky-700">{t('reportes.service')}</span>
                            ) : (
                              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">{t('reportes.product')}</span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{p.total_vendido}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatMoney(p.total_ingreso)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
