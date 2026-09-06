import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BookOpen, ShoppingCart, Package, ScrollText, PieChart, Download, Printer, Layers, Scale, Droplets, TrendingUp, FileText } from 'lucide-react'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'
import type { IpcChannel } from '@shared/ipc-channels'

type Tab = 'resumen' | 'ventas' | 'compras' | 'inventario' | 'diario' | 'mayor' | 'balance' | 'flujo' | 'analisis'

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

interface EmpresaHeader { nombre: string; tax: string; direccion: string; telefono: string }

async function cargarEmpresa(): Promise<EmpresaHeader> {
  try {
    const cfg = await callApi<any[]>('config:get')
    const get = (k: string) => cfg.find((c: any) => c.clave === k)?.valor || ''
    return {
      nombre: get('nombre_negocio'),
      tax: get('ein'),
      direccion: get('direccion'),
      telefono: get('telefono'),
    }
  } catch {
    return { nombre: '', tax: '', direccion: '', telefono: '' }
  }
}

function headerHTML(h: EmpresaHeader): string {
  if (!h.nombre && !h.tax && !h.direccion && !h.telefono) return ''
  return `<div style="text-align:center;margin-bottom:14px;border-bottom:2px solid #1f2937;padding-bottom:8px">
    ${h.nombre ? `<div style="font-weight:bold;font-size:16px;color:#1f2937">${h.nombre}</div>` : ''}
    ${h.tax ? `<div style="font-size:11px;color:#4b5563">${h.tax}</div>` : ''}
    ${h.direccion ? `<div style="font-size:11px;color:#4b5563">${h.direccion}</div>` : ''}
    ${h.telefono ? `<div style="font-size:11px;color:#4b5563">${h.telefono}</div>` : ''}
  </div>`
}

function headerCSV(h: EmpresaHeader): string {
  const lines: string[] = []
  if (h.nombre) lines.push(h.nombre)
  if (h.tax) lines.push(h.tax)
  if (h.direccion) lines.push(h.direccion)
  if (h.telefono) lines.push(h.telefono)
  return lines.length ? lines.join('\n') + '\n\n' : ''
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`px-3 py-2 text-xs font-semibold text-gray-500 uppercase ${right ? 'text-right' : 'text-left'}`}>
      {children}
    </th>
  )
}

function escapeHTML(s: any): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] || c))
}

function renderCuerpoParaPDF(tab: Tab, data: any): string {
  const money = (n: number) => new Intl.NumberFormat('es', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n || 0)
  if (tab === 'resumen') {
    const cards = [
      { label: 'Total Ventas', value: money(data.ventas?.total), detail: `${data.ventas?.cantidad || 0} ops` },
      { label: 'Total Compras', value: money(data.compras?.total), detail: `${data.compras?.cantidad || 0} ops` },
      { label: 'Utilidad Bruta', value: money(data.utilidadBruta), detail: `COGS: ${money(data.costoVentas)}` },
      { label: 'Impuesto', value: money(data.ventas?.impuesto) },
      { label: 'Valor Inventario', value: money(data.valorInventario) },
      { label: 'Dif. Caja', value: money(data.caja?.diferencia), detail: `${data.caja?.cierres || 0} cierres` },
    ]
    return `<div class="grid grid-3">${cards.map((c) => `<div class="card"><div class="label">${escapeHTML(c.label)}</div><div class="value">${c.value}</div>${c.detail ? `<div class="label">${escapeHTML(c.detail)}</div>` : ''}</div>`).join('')}</div>`
  }
  if (tab === 'ventas' || tab === 'compras') {
    const filas = data.filas || []
    const headers = tab === 'ventas'
      ? ['Número', 'Fecha', 'Cliente', 'Base', 'Descuento', 'Impuesto', 'Total', 'Método', 'Estado']
      : ['Número', 'Fecha', 'Proveedor', 'Base', 'Impuesto', 'Total', 'Método', 'Estado']
    const rights = headers.map((_, i) => (tab === 'ventas' ? [3, 4, 5, 6] : [3, 4, 5]).includes(i))
    return `<table>
      <thead><tr>${headers.map((h, i) => `<th class="${rights[i] ? 'right' : ''}">${h}</th>`).join('')}</tr></thead>
      <tbody>${filas.map((f: any) => `<tr>
        <td>#${escapeHTML(tab === 'ventas' ? f.numero_venta : f.numero_compra)}</td>
        <td>${escapeHTML((f.fecha || '').slice(0, 10))}</td>
        <td>${escapeHTML(tab === 'ventas' ? f.cliente_nombre : f.proveedor_nombre)}</td>
        <td class="right">${money(f.subtotal)}</td>
        ${tab === 'ventas' ? `<td class="right">${money(f.descuento)}</td>` : ''}
        <td class="right">${money(f.impuesto)}</td>
        <td class="right">${money(f.total)}</td>
        <td>${escapeHTML(f.metodo_pago)}</td>
        <td>${escapeHTML(f.estado)}</td>
      </tr>`).join('')}</tbody>
      <tfoot><tr>
        <td colspan="${tab === 'ventas' ? 3 : 3}">TOTAL</td>
        <td class="right">${money(data.totales?.base)}</td>
        ${tab === 'ventas' ? `<td class="right">${money(data.totales?.descuento)}</td>` : ''}
        <td class="right">${money(data.totales?.impuesto)}</td>
        <td class="right">${money(data.totales?.total)}</td>
        <td colspan="2"></td>
      </tr></tfoot>
    </table>`
  }
  if (tab === 'inventario') {
    const filas = data.filas || []
    const kardex = data.kardex || []
    return `<h3>Ajustes</h3>
      <table><thead><tr><th>Fecha</th><th>Producto</th><th class="right">Cant.</th><th>Stock Ant.</th><th>Stock Nuevo</th><th>Motivo</th></tr></thead>
      <tbody>${filas.map((f: any) => `<tr><td>${escapeHTML((f.fecha || '').slice(0, 10))}</td><td>${escapeHTML(f.producto_nombre)}</td><td class="right">${escapeHTML(f.cantidad)}</td><td>${escapeHTML(f.stock_anterior)}</td><td>${escapeHTML(f.stock_nuevo)}</td><td>${escapeHTML(f.motivo)}</td></tr>`).join('')}</tbody></table>
      <h3>Kardex</h3>
      <table><thead><tr><th>Producto</th><th class="right">Stock</th><th class="right">Costo</th><th class="right">Valor</th><th class="right">Entradas</th><th class="right">Salidas</th><th class="right">Ajustes</th></tr></thead>
      <tbody>${kardex.map((k: any) => `<tr><td>${escapeHTML(k.nombre)}</td><td class="right">${escapeHTML(k.stock)}</td><td class="right">${money(k.costo_unitario)}</td><td class="right">${money(k.valor_stock)}</td><td class="right">+${escapeHTML(k.entradas_compras)}</td><td class="right">-${escapeHTML(k.salidas_ventas)}</td><td class="right">${escapeHTML(k.ajustes)}</td></tr>`).join('')}</tbody></table>`
  }
  if (tab === 'diario') {
    const asientos = data.asientos || []
    return `<table><thead><tr><th>Fecha</th><th>Tipo</th><th>Descripción</th><th>Cuenta</th><th class="right">Debe</th><th class="right">Haber</th></tr></thead>
      <tbody>${asientos.map((a: any) => `<tr><td>${escapeHTML((a.fecha || '').slice(0, 10))}</td><td>${escapeHTML(a.tipo)}</td><td>${escapeHTML(a.descripcion)}</td><td>${escapeHTML(a.cuenta)}</td><td class="right">${a.debe ? money(a.debe) : '—'}</td><td class="right">${a.haber ? money(a.haber) : '—'}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="4">TOTAL</td><td class="right">${money(data.totales?.debe)}</td><td class="right">${money(data.totales?.haber)}</td></tr></tfoot></table>`
  }
  if (tab === 'mayor') {
    const cuentas = data.cuentas || []
    return cuentas.map((c: any) => `<h3>${escapeHTML(c.cuenta)} <span style="font-weight:normal;font-size:10px">(Saldo: ${money(c.saldo)})</span></h3>
      <table><thead><tr><th>Fecha</th><th>Descripción</th><th class="right">Debe</th><th class="right">Haber</th></tr></thead>
      <tbody>${(c.movimientos || []).map((m: any) => `<tr><td>${escapeHTML((m.fecha || '').slice(0, 10))}</td><td>${escapeHTML(m.descripcion)}</td><td class="right">${m.debe ? money(m.debe) : '—'}</td><td class="right">${m.haber ? money(m.haber) : '—'}</td></tr>`).join('')}</tbody></table>`).join('')
  }
  if (tab === 'balance') {
    const det = data.detalle || []
    return `<table><thead><tr><th>Cuenta</th><th>Clase</th><th class="right">Saldo</th></tr></thead>
      <tbody>${det.map((d: any) => `<tr><td>${escapeHTML(d.cuenta)}</td><td>${escapeHTML(d.clase)}</td><td class="right">${money(d.saldo)}</td></tr>`).join('')}</tbody></table>
      <div class="grid grid-3" style="margin-top:10px">
        <div class="card"><div class="label">Total Activo</div><div class="value">${money(data.totales?.activo)}</div></div>
        <div class="card"><div class="label">Total Pasivo + Capital</div><div class="value">${money(data.totales?.pasivo_y_capital)}</div></div>
        <div class="card"><div class="label">Cuadre</div><div class="value">${money(data.totales?.cuadre)}</div></div>
      </div>`
  }
  if (tab === 'flujo') {
    const filas = data.filas || []
    return `<div class="grid grid-3">
        <div class="card"><div class="label">Inflow</div><div class="value">${money(data.totales?.inflow)}</div></div>
        <div class="card"><div class="label">Outflow</div><div class="value">${money(data.totales?.outflow)}</div></div>
        <div class="card"><div class="label">Neto</div><div class="value">${money((data.totales?.aperturas || 0) + (data.totales?.neto || 0))}</div></div>
      </div>
      <table><thead><tr><th>Concepto</th><th class="right">Monto</th></tr></thead>
      <tbody>${filas.map((f: any) => `<tr><td>${escapeHTML(f.concepto)}</td><td class="right">${money(f.monto)}</td></tr>`).join('')}</tbody></table>`
  }
  if (tab === 'analisis') {
    const ratios = data.ratios || []
    const porMetodo = data.porMetodo || []
    return `<h3>Ratios</h3>
      <table><thead><tr><th>Indicador</th><th class="right">Valor</th></tr></thead>
      <tbody>${ratios.map((r: any) => `<tr><td>${escapeHTML(r.clave)}</td><td class="right">${r.unidad === 'money' ? money(r.valor) : r.unidad === '%' ? `${r.valor}%` : r.unidad === 'x' ? `${r.valor}x` : escapeHTML(r.valor)}</td></tr>`).join('')}</tbody></table>
      <h3>Por método de pago</h3>
      <table><thead><tr><th>Método</th><th class="right">Ops</th><th class="right">Total</th></tr></thead>
      <tbody>${porMetodo.map((m: any) => `<tr><td>${escapeHTML(m.metodo_pago)}</td><td class="right">${escapeHTML(m.cantidad)}</td><td class="right">${money(m.total)}</td></tr>`).join('')}</tbody></table>`
  }
  return ''
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
    mayor: 'contable:mayor',
    balance: 'contable:balance',
    flujo: 'contable:flujo-efectivo',
    analisis: 'contable:analisis',
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

  const exportar = async () => {
    if (!data?.csv) return
    const nombres: Record<Tab, string> = {
      resumen: 'resumen',
      ventas: 'libro_ventas',
      compras: 'libro_compras',
      inventario: 'libro_inventario',
      diario: 'libro_diario',
      mayor: 'mayor',
      balance: 'balance_general',
      flujo: 'flujo_efectivo',
      analisis: 'analisis_financiero',
    }
    const h = await cargarEmpresa()
    descargarCSV(`${nombres[tab]}_${periodo.desde}_${periodo.hasta}.csv`, headerCSV(h) + data.csv)
    toast.success(t('contable.exported'))
  }

  const exportarPDF = async () => {
    if (!data) return
    const h = await cargarEmpresa()
    const titulo = tabs.find((x) => x.id === tab)?.label || ''
    const periodoStr = `${periodo.desde} → ${periodo.hasta}`
    const body = renderCuerpoParaPDF(tab, data)
    const html = `<!DOCTYPE html><html><head><title>${titulo}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#1f2937;margin:0;padding:24px;background:#fff;font-size:11px}
      h2{font-size:14px;margin:8px 0 4px}
      .period{color:#6b7280;margin-bottom:12px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      th{background:#f3f4f6;text-align:left;padding:6px 8px;border-bottom:2px solid #d1d5db;font-size:10px;text-transform:uppercase}
      td{padding:5px 8px;border-bottom:1px solid #e5e7eb;font-size:11px}
      .right{text-align:right}
      .center{text-align:center}
      tfoot td{font-weight:bold;background:#f9fafb;border-top:2px solid #d1d5db}
      .grid{display:grid;gap:8px;margin:8px 0}
      .grid-3{grid-template-columns:repeat(3,1fr)}
      .grid-4{grid-template-columns:repeat(4,1fr)}
      .card{border:1px solid #e5e7eb;border-radius:6px;padding:8px}
      .card .label{font-size:10px;color:#6b7280;text-transform:uppercase}
      .card .value{font-size:14px;font-weight:bold;margin-top:2px}
      @media print{body{padding:12px}.no-print{display:none}}
    </style></head><body>
      ${headerHTML(h)}
      <h2>${titulo}</h2>
      <div class="period">${periodoStr}</div>
      ${body}
      <div class="no-print" style="text-align:center;margin-top:18px">
        <button onclick="window.print()" style="padding:8px 18px;background:#2563eb;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:12px">${t('contable.printNow')}</button>
      </div>
    </body></html>`
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) { toast.error(t('common.error')); return }
    win.document.write(html)
    win.document.close()
  }

  const tabs: { id: Tab; icon: any; label: string }[] = [
    { id: 'resumen', icon: PieChart, label: t('contable.tabResumen') },
    { id: 'ventas', icon: BookOpen, label: t('contable.tabVentas') },
    { id: 'compras', icon: ShoppingCart, label: t('contable.tabCompras') },
    { id: 'inventario', icon: Package, label: t('contable.tabInventario') },
    { id: 'diario', icon: ScrollText, label: t('contable.tabDiario') },
    { id: 'mayor', icon: Layers, label: t('contable.tabMayor') },
    { id: 'balance', icon: Scale, label: t('contable.tabBalance') },
    { id: 'flujo', icon: Droplets, label: t('contable.tabFlujo') },
    { id: 'analisis', icon: TrendingUp, label: t('contable.tabAnalisis') },
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
          {tab !== 'resumen' && tab !== 'analisis' && has('contable_export') && (
            <button onClick={exportar}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
              <Download className="w-4 h-4" /> CSV
            </button>
          )}
          <button onClick={exportarPDF}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700"
            title={t('contable.pdfTitle')}>
            <FileText className="w-4 h-4" /> PDF
          </button>
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
      ) : tab === 'diario' ? (
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
      ) : tab === 'mayor' ? (
        <MayorView data={data} t={t} />
      ) : tab === 'balance' ? (
        <div className="space-y-4">
          <TablaLibro
            headers={[t('contable.colAccount'), t('contable.colClass'), t('contable.colBalance')]}
            rights={[2]}
            filas={(data.detalle || []).map((d: any) => [
              t(`contable.cuenta.${d.cuenta}`, { defaultValue: d.cuenta }),
              t(`contable.clase.${d.clase}`),
              formatMoney(d.saldo),
            ])}
            vacio={t('contable.noEntries')}
          />
          <div className="grid grid-cols-3 gap-4">
            <ResumenCard label={t('contable.totalAssets')} value={formatMoney(data.totales?.activo)} color="green" />
            <ResumenCard label={t('contable.totalLiabilities')} value={formatMoney(data.totales?.pasivo_y_capital)} color="orange" />
            <ResumenCard label={t('contable.difference')}
              value={formatMoney(data.totales?.cuadre)}
              detail={Math.abs(data.totales?.cuadre || 0) < 0.01 ? t('contable.balanced') : t('contable.unbalanced')}
              color={Math.abs(data.totales?.cuadre || 0) < 0.01 ? 'blue' : 'red'} />
          </div>
        </div>
      ) : tab === 'flujo' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <ResumenCard label={t('contable.cashIn')} value={formatMoney(data.totales?.inflow)} color="green" />
            <ResumenCard label={t('contable.cashOut')} value={formatMoney(data.totales?.outflow)} color="red" />
            <ResumenCard label={t('contable.netCash')}
              value={formatMoney((data.totales?.aperturas || 0) + (data.totales?.neto || 0))}
              detail={`${t('contable.openingFunds')}: ${formatMoney(data.totales?.aperturas || 0)}`} color="blue" />
          </div>
          <TablaLibro
            headers={[t('contable.colConcept'), t('common.total')]}
            rights={[1]}
            filas={(data.filas || []).map((f: any) => [
              t(`contable.flujo.${f.concepto}`), formatMoney(f.monto),
            ])}
            vacio={t('common.noData')}
          />
        </div>
      ) : tab === 'analisis' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ResumenCard label={t('contable.ratio.margen_bruto')} value={`${data.ratios?.find((r: any) => r.clave === 'margen_bruto')?.valor ?? 0}%`} color="green" />
            <ResumenCard label={t('contable.ratio.markup')} value={`${data.ratios?.find((r: any) => r.clave === 'markup')?.valor ?? 0}%`} color="blue" />
            <ResumenCard label={t('contable.ratio.ticket_promedio')} value={formatMoney(data.ratios?.find((r: any) => r.clave === 'ticket_promedio')?.valor || 0)} color="purple" />
            <ResumenCard label={t('contable.ratio.venta_diaria')} value={formatMoney(data.ratios?.find((r: any) => r.clave === 'venta_diaria')?.valor || 0)} color="indigo" />
          </div>
          <TablaLibro
            headers={[t('contable.colMethod'), t('contable.colOps'), t('common.total')]}
            rights={[1, 2]}
            filas={(data.porMetodo || []).map((m: any) => [
              t(`contable.metodo.${m.metodo_pago}`, { defaultValue: m.metodo_pago }),
              m.cantidad, formatMoney(m.total),
            ])}
            vacio={t('contable.noSales')}
          />
          <TablaLibro
            headers={[t('contable.colIndicator'), t('common.total')]}
            rights={[1]}
            filas={(data.ratios || []).filter((r: any) => !['margen_bruto', 'markup', 'ticket_promedio', 'venta_diaria'].includes(r.clave)).map((r: any) => [
              t(`contable.ratio.${r.clave}`),
              r.unidad === 'money' ? formatMoney(r.valor) : r.unidad === '%' ? `${r.valor}%` : r.unidad === 'x' ? `${r.valor}x` : String(r.valor),
            ])}
            vacio={t('common.noData')}
          />
        </div>
      ) : (
        <p className="text-center text-gray-400 py-12">{t('common.noData')}</p>
      )}
    </div>
  )
}

function MayorView({ data, t }: { data: any; t: (k: string, o?: any) => string }) {
  return (
    <div className="space-y-4">
      {(data.cuentas || []).map((c: any) => (
        <div key={c.cuenta} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
            <span className="font-semibold text-sm text-gray-700">{t(`contable.cuenta.${c.cuenta}`, { defaultValue: c.cuenta })}</span>
            <span className="text-sm font-medium text-gray-600">
              {t('contable.colBalance')}: <span className={c.saldo >= 0 ? 'text-green-600' : 'text-red-600'}>{formatMoney(c.saldo)}</span>
            </span>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <Th>{t('common.date')}</Th>
                <Th>{t('contable.colDescription')}</Th>
                <Th right>{t('contable.colDebit')}</Th>
                <Th right>{t('contable.colCredit')}</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {c.movimientos.map((m: any, i: number) => (
                <tr key={i} className="hover:bg-gray-50">
                  <td className="px-3 py-2">{m.fecha?.slice(0, 10)}</td>
                  <td className="px-3 py-2">{m.descripcion}</td>
                  <td className="px-3 py-2 text-right">{m.debe ? formatMoney(m.debe) : '—'}</td>
                  <td className="px-3 py-2 text-right">{m.haber ? formatMoney(m.haber) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {(data.cuentas || []).length === 0 && (
        <p className="text-center text-gray-400 py-12">{t('contable.noEntries')}</p>
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
