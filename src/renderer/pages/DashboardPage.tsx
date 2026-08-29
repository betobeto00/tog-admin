import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth.store'
import { formatCurrency, formatDateTime, formatTicketNumber } from '../lib/utils'
import {
  ShoppingCart,
  DollarSign,
  Package,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'

interface ResumenDia {
  total_ventas: number
  monto_total: number
  efectivo: number
  transferencia: number
  pago_movil: number
}

interface StockBajo {
  id: number
  nombre: string
  stock: number
  stock_minimo: number
  categoria_nombre: string | null
}

interface VentaReciente {
  id: number; numero_venta: number; fecha: string
  total: number; metodo_pago: string; usuario_nombre: string
}

export default function DashboardPage() {
  const { t, i18n } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const [resumen, setResumen] = useState<ResumenDia | null>(null)
  const [stockBajo, setStockBajo] = useState<StockBajo[]>([])
  const [ultimasVentas, setUltimasVentas] = useState<VentaReciente[]>([])
  const [hora, setHora] = useState(new Date())

  useEffect(() => {
    cargarDatos()
    const timer = setInterval(() => setHora(new Date()), 1000)
    return () => clearInterval(timer)
  }, [i18n.language])

  const cargarDatos = async () => {
    try {
      const [resumenData, stockData, ventasRecientes] = await Promise.all([
        window.api.ventas.resumenDia(),
        window.api.productos.lowStock(),
        window.api.reportes.ultimasVentas(10),
      ])
      setResumen(resumenData)
      setStockBajo(stockData)
      setUltimasVentas(ventasRecientes)
    } catch (err) {
      console.error('Error cargando dashboard:', err)
    }
  }

  const locale = i18n.language === 'en' ? 'en-US' : 'es-VE'

  const methodLabels: Record<string, string> = {
    efectivo: t('caja.cashMethod'),
    tarjeta: t('caja.cardMethod'),
    transferencia: t('caja.transferMethod'),
    pago_movil: t('caja.mobileMethod'),
    mixto: t('pos.mixed'),
  }

  return (
    <div className="space-y-6">
      {/* Saludo */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          {i18n.language === 'en' ? `Welcome, ${usuario?.nombre}!` : `¡Bienvenido, ${usuario?.nombre}!`}
        </h1>
        <p className="text-gray-500 mt-1">
          {hora.toLocaleDateString(locale, {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
          {' • '}
          {hora.toLocaleTimeString(locale)}
        </p>
      </div>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<ShoppingCart className="w-6 h-6 text-blue-600" />}
          bg="bg-blue-50"
          label={t('dashboard.todayTickets')}
          value={resumen?.total_ventas?.toString() || '0'}
          sub={t('dashboard.todayTickets')}
        />
        <StatCard
          icon={<DollarSign className="w-6 h-6 text-green-600" />}
          bg="bg-green-50"
          label={t('dashboard.todaySales')}
          value={formatCurrency(resumen?.monto_total || 0)}
          sub={t('common.total')}
        />
        <StatCard
          icon={<TrendingUp className="w-6 h-6 text-purple-600" />}
          bg="bg-purple-50"
          label={t('caja.cashMethod')}
          value={formatCurrency(resumen?.efectivo || 0)}
          sub={t('caja.cashMethod')}
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6 text-orange-600" />}
          bg="bg-orange-50"
          label={t('dashboard.lowStock')}
          value={stockBajo.length.toString()}
          sub={t('dashboard.lowStock')}
        />
      </div>

      {/* Dos columnas: Distribución de pagos + Stock bajo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {i18n.language === 'en' ? 'Payment Distribution' : 'Distribución de Pagos'}
          </h2>
          <div className="space-y-4">
            <PaymentRow label={t('caja.cashMethod')} amount={resumen?.efectivo || 0} total={resumen?.monto_total || 1} color="bg-green-500" />
            <PaymentRow label={t('caja.transferMethod')} amount={resumen?.transferencia || 0} total={resumen?.monto_total || 1} color="bg-blue-500" />
            <PaymentRow label={t('caja.mobileMethod')} amount={resumen?.pago_movil || 0} total={resumen?.monto_total || 1} color="bg-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">⚠️ {t('dashboard.lowStock')}</h2>
          {stockBajo.length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>{i18n.language === 'en' ? 'All products have enough stock' : 'Todos los productos tienen stock suficiente'}</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {stockBajo.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{p.nombre}</p>
                    <p className="text-xs text-gray-500">{p.categoria_nombre || t('common.none')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-orange-600">{p.stock} uds</p>
                    <p className="text-xs text-gray-400">mín: {p.stock_minimo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Últimas ventas */}
      {ultimasVentas.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">📋 {t('dashboard.latestSales')}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b border-gray-100">
                  <th className="pb-2 font-medium">{t('ventas.ticket')}</th>
                  <th className="pb-2 font-medium">{t('common.hour')}</th>
                  <th className="pb-2 font-medium">{t('ventas.cashier')}</th>
                  <th className="pb-2 font-medium">{t('ventas.payment')}</th>
                  <th className="pb-2 font-medium text-right">{t('common.total')}</th>
                </tr>
              </thead>
              <tbody>
                {ultimasVentas.map((v) => (
                  <tr key={v.id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="py-2 font-mono font-medium">{formatTicketNumber(v.numero_venta)}</td>
                    <td className="py-2 text-gray-500">{formatDateTime(v.fecha)}</td>
                    <td className="py-2 text-gray-600">{v.usuario_nombre}</td>
                    <td className="py-2 text-gray-600 capitalize">{methodLabels[v.metodo_pago] || v.metodo_pago.replace('_', ' ')}</td>
                    <td className="py-2 text-right font-bold">{formatCurrency(v.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ icon, bg, label, value, sub }: {
  icon: React.ReactNode
  bg: string
  label: string
  value: string
  sub: string
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${bg}`}>{icon}</div>
        <div>
          <p className="text-sm text-gray-500">{label}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-400">{sub}</p>
        </div>
      </div>
    </div>
  )
}

function PaymentRow({ label, amount, total, color }: {
  label: string
  amount: number
  total: number
  color: string
}) {
  const pct = total > 0 ? (amount / total) * 100 : 0
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-600">{label}</span>
        <span className="font-medium">{formatCurrency(amount)}</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2">
        <div className={`${color} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
