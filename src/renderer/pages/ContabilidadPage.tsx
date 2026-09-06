import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ShoppingCart, Package, ScrollText, PieChart, Download, Printer } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'
import type { IpcChannel } from '@shared/ipc-channels'

type Tab = 'resumen' | 'ventas' | 'compras' | 'inventario' | 'diario'

interface Periodo {
  desde: string
  hasta: string
}

function mesActual(): Periodo {
  const hoy = new Date()
  const y = hoy.getFullYear()
  const m = String(hoy.getMonth() + 1).padStart(2, '0')
  return { desde: `${y}-${m}-01`, hasta: hoy.toISOString().slice(0, 10) }
}

function descargarCSV(nombre: string, csv: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

export default function ContabilidadPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<Tab>('resumen')
  const [periodo, setPeriodo] = useState<Periodo>(mesActual())
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const canales: Record<Tab, IpcChannel> = {
    resumen: 'contable:resumen',
    ventas: 'contable:libro-ventas',
    compras: 'contable:libro-compras',
    inventario: 'contable:libro-inventario',
    diario: 'contable:libro-diario',
  }

  const load = async () => {
    setLoading(true)
    try {
      const res = await callApi<any>(canales[tab], { desde: periodo.desde, hasta: periodo.hasta })
      setData(res)
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [tab, periodo.desde, periodo.hasta])

  const exportar = () => {
    if (!data?.csv) return
    const nombres: Record<Tab, string> = {
      resumen: 'resumen',
      ventas: 'libro_ventas',
      compras: 'libro_compras',
      inventario: 'libro_inventario',
      diario: 'libro_diario',
    }
    descargarCSV(`${nombres[tab]}_${periodo.desde}_${periodo.hasta}.csv`, data.csv)
    toast.success(t('contable.exported'))
  }

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'resumen', icon: PieChart, label: t('contable.tabResumen') },
    { id: 'ventas', icon: BookOpen, label: t('contable.tabVentas') },
    { id: 'compras', icon: ShoppingCart, label: t('contable.tabCompras') },
    { id: 'inventario', icon: Package, label: t('contable.tabInventario') },
    { id: 'diario', icon: ScrollText, label: t('contable.tabDiario') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('contable.title')}</h1>
          <p className="text-sm text-gray-500">{t('contable.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="date" value={periodo.desde} onChange={(e) => setPeriodo({ ...periodo, desde: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <span className="text-gray-400">→</span>
          <input type="date" value={periodo.hasta} onChange={(e) => setPeriodo({ ...periodo, hasta: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          {tab !== 'resumen' && has('contable_export') && (
            <button onClick={exportar}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          {tab !== 'resumen' && (
            <button onClick={() => window.print()} title={t('common.print')}
              className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              <Printer className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => { setTab(id); setData(null) }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4 inline mr-1.5" /> {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
        </div>
      ) : !data ? (
        <p className="text-center text-gray-400 py-12">{t('common.noData')}</p>
      ) : tab === 'resumen' ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <ResumenCard label={t('contable.totalVentas')} value={formatMoney(data.ventas?.total || 0)}
            detail={`${data.ventas?.cantidad || 0} ${t('contable.ops')}`} color="green" />
          <ResumenCard label={t('contable.totalCompras')} value={formatMoney(data.compras?.total || 0)}
            detail={`${data.compras?.cantidad || 0} ${t('contable.ops')}`} color="orange" />
          <ResumenCard label={t('contable.grossProfit')} value={formatMoney(data.utilidadBruta || 0)}
            detail={`${t('contable.cogs')}: ${formatMoney(data.costoVentas || 0)}`} color="blue" />
          <ResumenCard label={t('contable.salesTax')} value={formatMoney(data.ventas?.impuesto || 0)} color="purple" />
          <ResumenCard label={t('contable.inventoryValue')} value={formatMoney(data.valorInventario || 0)} color="indigo" />
          <ResumenCard label={t('contable.cashDiff')} value={formatMoney(data.caja?.diferencia || 0)}
            detail={`${data.caja?.cierres || 0} ${t('contable.closings')}`} color="red" />
        </div>
      ) : tab === 'ventas' ? (
        <TablaLibro
          headers={[t('contable.colNumber'), t('common.date'), t('nav.clients'), t('common.subtotal'), t('common.discount'), t('common.tax'), t('common.total'), t('contable.colStatus')]}
          rights={[3, 4, 5, 6]}
          filas={(data.filas || []).map((f: any) => [
            `#${f.numero_venta}`, f.fecha?.slice(0, 10), f.cliente_nombre || '—',
            formatMoney(f.subtotal), formatMoney(f.descuento), formatMoney(f.impuesto),
            formatMoney(f.total), f.estado,
          ])}
          totales={[
            t('common.total'),
            formatMoney(data.totales?.base), formatMoney(data.totales?.descuento),
            formatMoney(data.totales?.impuesto), formatMoney(data.totales?.total),
          ]}
          vacio={t('contable.noSales')}
        />
      ) : tab === 'compras' ? (
        <TablaLibro
          headers={[t('contable.colNumber'), t('common.date'), t('nav.suppliers'), t('common.subtotal'), t('common.tax'), t('common.total'), t('contable.colStatus')]}
          rights={[3, 4, 5]}
          filas={(data.filas || []).map((f: any) => [
            `#${f.numero_compra}`, f.fecha?.slice(0, 10), f.proveedor_nombre || '—',
            formatMoney(f.subtotal), formatMoney(f.impuesto), formatMoney(f.total), f.estado,
          ])}
          totales={[
            t('common.total'),
            formatMoney(data.totales?.base), formatMoney(data.totales?.impuesto), formatMoney(data.totales?.total),
          ]}
          vacio={t('contable.noPurchases')}
        />
      ) : tab === 'inventario' ? (
        <div className="space-y-4">
          <TablaLibro
            headers={[t('common.date'), t('contable.colProduct'), t('contable.colQty'), t('contable.colBefore'), t('contable.colAfter'), t('contable.colReason')]}
            rights={[2]}
            filas={(data.filas || []).map((f: any) => [
              f.fecha?.slice(0, 10), f.producto_nombre, f.cantidad, f.stock_anterior, f.stock_nuevo, f.motivo,
            ])}
            vacio={t('contable.noAdjustments')}
          />
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 font-semibold text-sm text-gray-700">
              {t('contable.kardexTitle')}
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <Th>{t('contable.colProduct')}</Th>
                  <Th right>{t('contable.colStock')}</Th>
                  <Th right>{t('contable.colUnitCost')}</Th>
                  <Th right>{t('contable.colStockValue')}</Th>
                  <Th right>{t('contable.colPurchasesIn')}</Th>
                  <Th right>{t('contable.colSalesOut')}</Th>
                  <Th right>{t('contable.colAdjustments')}</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(data.kardex || []).map((k: any) => (
                  <tr key={k.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2">{k.nombre} <span className="text-gray-400 text-xs">({k.unidad})</span></td>
                    <td className="px-3 py-2 text-right">{k.stock}</td>
                    <td className="px-3 py-2 text-right">{formatMoney(k.costo_unitario)}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMoney(k.valor_stock)}</td>
                    <td className="px-3 py-2 text-right text-green-600">+{k.entradas_compras}</td>
                    <td className="px-3 py-2 text-right text-red-600">-{k.salidas_ventas}</td>
                    <td className="px-3 py-2 text-right">{k.ajustes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <TablaLibro
          headers={[t('common.date'), t('contable.colType'), t('contable.colDescription'), t('contable.colAccount'), t('contable.colDebit'), t('contable.colCredit')]}
          rights={[4, 5]}
          filas={(data.asientos || []).map((a: any) => [
            a.fecha?.slice(0, 10), t(`contable.journal.${a.tipo}`), a.descripcion, a.cuenta,
            a.debe ? formatMoney(a.debe) : '—', a.haber ? formatMoney(a.haber) : '—',
          ])}
          totales={[t('common.total'), '', '', formatMoney(data.totales?.debe), formatMoney(data.totales?.haber)]}
          vacio={t('contable.noEntries')}
        />
      )}
    </div>
  )
}

function TablaLibro({ headers, filas, totales, vacio, rights = [] }: {
  headers: string[]
  filas: (string | number)[][]
  totales?: (string | number)[]
  vacio: string
  rights?: number[]
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((h, i) => <Th key={i} right={rights.includes(i)}>{h}</Th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filas.length === 0 ? (
            <tr><td colSpan={headers.length} className="text-center py-10 text-gray-400">{vacio}</td></tr>
          ) : filas.map((f, i) => (
            <tr key={i} className="hover:bg-gray-50">
              {f.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${rights.includes(j) ? 'text-right' : ''}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {totales && filas.length > 0 && (
          <tfoot className="bg-gray-50 border-t-2 border-gray-200 font-semibold">
            <tr>
              {totales.map((c, i) => (
                <td key={i} className={`px-3 py-2.5 ${i > 0 && rights.some((r) => r === i - 1) ? 'text-right' : ''}`}>{c}</td>
              ))}
              {headers.length > totales.length && <td />}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

function ResumenCard({ label, value, detail, color }: { label: string; value: string; detail?: string; color: string }) {
  const colors: Record<string, string> = {
    green: 'bg-green-50 text-green-600',
    orange: 'bg-orange-50 text-orange-600',
    blue: 'bg-blue-50 text-blue-600',
    purple: 'bg-purple-50 text-purple-600',
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colors[color]?.split(' ')[1] || 'text-gray-900'}`}>{value}</p>
      {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
    </div>
  )
}
