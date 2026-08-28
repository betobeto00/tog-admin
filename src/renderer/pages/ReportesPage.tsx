import { useEffect, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend
} from 'recharts'
import { BarChart3, TrendingUp, Package, Calendar } from 'lucide-react'
import { formatCurrency, formatDateTime } from '../lib/utils'

interface VentaDiaria { fecha: string; total_ventas: number; monto_total: number }
interface TopProducto { nombre: string; total_vendido: number; total_ingreso: number }
interface ResumenDia { total_ventas: number; monto_total: number; efectivo: number; transferencia: number; pago_movil: number }

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16']

export default function ReportesPage() {
  const [fechaInicio, setFechaInicio] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return d.toISOString().split('T')[0] })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0])

  const [ventasDiarias, setVentasDiarias] = useState<VentaDiaria[]>([])
  const [topProductos, setTopProductos] = useState<TopProducto[]>([])
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadReportes() }, [fechaInicio, fechaFin])

  const loadReportes = async () => {
    setLoading(true)
    const [diarias, top, res] = await Promise.all([
      window.api.reportes.ventasPeriodo(fechaInicio, fechaFin),
      window.api.reportes.productosMasVendidos(fechaInicio, fechaFin, 10),
      window.api.ventas.resumenDia(),
    ])
    setVentasDiarias(diarias)
    setTopProductos(top)
    setResumen(res)
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

  // Datos para pie chart (métodos de pago del día)
  const pieData = resumen ? [
    { name: 'Efectivo', value: resumen.efectivo },
    { name: 'Transferencia', value: resumen.transferencia },
    { name: 'Pago Móvil', value: resumen.pago_movil },
  ].filter((d) => d.value > 0) : []

  // Totales del período
  const totalPeriodo = ventasDiarias.reduce((acc, v) => acc + v.monto_total, 0)
  const totalVentasPeriodo = ventasDiarias.reduce((acc, v) => acc + v.total_ventas, 0)
  const promedioDiario = ventasDiarias.length > 0 ? totalPeriodo / ventasDiarias.length : 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reportes</h1>
        <p className="text-sm text-gray-500">Análisis de ventas y rendimiento</p>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 7); setFechaInicio(d.toISOString().split('T')[0]); setFechaFin(new Date().toISOString().split('T')[0]) }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          Últimos 7 días
        </button>
        <button onClick={() => { const d = new Date(); d.setDate(d.getDate() - 30); setFechaInicio(d.toISOString().split('T')[0]); setFechaFin(new Date().toISOString().split('T')[0]) }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          Últimos 30 días
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
                <span className="text-sm text-gray-500">Total Período</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalPeriodo)}</p>
              <p className="text-xs text-gray-400 mt-1">{totalVentasPeriodo} ventas en {ventasDiarias.length} días</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-green-50 rounded-lg"><BarChart3 className="w-5 h-5 text-green-600" /></div>
                <span className="text-sm text-gray-500">Promedio Diario</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(promedioDiario)}</p>
              <p className="text-xs text-gray-400 mt-1">promedio por día</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-purple-50 rounded-lg"><Package className="w-5 h-5 text-purple-600" /></div>
                <span className="text-sm text-gray-500">Top Producto</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{topProductos[0]?.nombre || '—'}</p>
              <p className="text-xs text-gray-400 mt-1">{topProductos[0] ? `${topProductos[0].total_vendido} unidades` : 'sin datos'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfica de ventas por día */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">📈 Ventas por Día</h3>
              {lineData.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No hay datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={lineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="fecha" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    <Legend />
                    <Line type="monotone" dataKey="monto" name="Ingresos ($)" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Top productos más vendidos */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">🏆 Productos Más Vendidos</h3>
              {barData.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No hay datos en este período</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={barData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="nombre" type="category" width={120} tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number) => value.toLocaleString()} />
                    <Bar dataKey="vendidos" name="Unidades" fill="#10B981" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Métodos de pago */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">💳 Métodos de Pago (Hoy)</h3>
              {pieData.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No hay ventas hoy</p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%"
                      outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tabla de top productos */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-base font-semibold text-gray-900 mb-4">📋 Detalle Top Productos</h3>
              {topProductos.length === 0 ? (
                <p className="text-center text-gray-400 py-12">No hay datos</p>
              ) : (
                <div className="overflow-y-auto max-h-64">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">#</th>
                        <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Producto</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Vendidos</th>
                        <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Ingreso</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {topProductos.map((p, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-400 font-medium">{i + 1}</td>
                          <td className="px-3 py-2 font-medium text-gray-900">{p.nombre}</td>
                          <td className="px-3 py-2 text-right">{p.total_vendido}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(p.total_ingreso)}</td>
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
