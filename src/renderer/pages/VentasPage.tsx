import { Fragment, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Search, Eye, XCircle, Printer, Calendar, Receipt,
  ChevronDown, AlertTriangle, DollarSign, Clock
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { formatCurrency, formatDateTime, formatTicketNumber } from '../lib/utils'
import { callApi } from '../lib/api-client'

interface Venta {
  id: number; numero_venta: number; fecha: string; usuario_nombre: string
  subtotal: number; impuesto: number; descuento: number; total: number
  metodo_pago: string; monto_pagado: number; cambio: number
  estado: string; notas: string | null
}

interface VentaDetalle {
  id: number; producto_id: number | null; descripcion: string | null; producto_nombre: string | null
  cantidad: number; precio_unitario: number; descuento: number; subtotal: number
  notas: string | null
  componentes?: { componente_id: number; cantidad: number; nombre: string | null }[]
}

export default function VentasPage() {
  const { t, i18n } = useTranslation()
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)

  // Filtros
  const [fechaInicio, setFechaInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]
  })
  const [fechaFin, setFechaFin] = useState(() => new Date().toISOString().split('T')[0])
  const [search, setSearch] = useState('')

  // Detalle
  const [detalleOpen, setDetalleOpen] = useState(false)
  const [detalleVenta, setDetalleVenta] = useState<Venta & { detalles: VentaDetalle[] } | null>(null)

  // Anulación
  const [anularTarget, setAnularTarget] = useState<Venta | null>(null)
  const [anularMotivo, setAnularMotivo] = useState('')
  const [anulando, setAnulando] = useState(false)

  useEffect(() => { loadVentas() }, [fechaInicio, fechaFin])

  const loadVentas = async () => {
    setLoading(true)
    const data = await callApi<Venta[]>('ventas:list', { fecha_inicio: fechaInicio, fecha_fin: fechaFin })
    setVentas(data)
    setLoading(false)
  }

  const openDetalle = async (venta: Venta) => {
    const completa = await callApi<Venta & { detalles: VentaDetalle[] }>('ventas:getById', { id: venta.id })
    setDetalleVenta(completa)
    setDetalleOpen(true)
  }

  const anularVenta = async () => {
    if (!anularTarget || !anularMotivo.trim()) return
    setAnulando(true)
    try {
      await callApi('ventas:anular', { id: anularTarget.id, motivo: anularMotivo })
      setAnularTarget(null)
      setAnularMotivo('')
      await loadVentas()
    } finally {
      setAnulando(false)
    }
  }

  // Filtrado por búsqueda
  const filtered = ventas.filter((v) => {
    if (!search.trim()) return true
    const term = search.toLowerCase()
    return (
      String(v.numero_venta).includes(term) ||
      v.usuario_nombre?.toLowerCase().includes(term) ||
      v.metodo_pago.toLowerCase().includes(term)
    )
  })

  // Totales del filtro
  const totales = filtered.reduce(
    (acc, v) => ({
      count: acc.count + (v.estado === 'completada' ? 1 : 0),
      total: acc.total + (v.estado === 'completada' ? v.total : 0),
      anuladas: acc.anuladas + (v.estado === 'anulada' ? 1 : 0),
    }),
    { count: 0, total: 0, anuladas: 0 }
  )

  const metodoLabel: Record<string, string> = {
    efectivo: '💵 Efectivo',
    transferencia: '🏦 Transferencia',
    pago_movil: '📱 Pago Móvil',
    mixto: '💱 Mixto',
    fiado: '📒 Fiado / Crédito',
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('ventas.title')}</h1>
        <p className="text-sm text-gray-500">
          {totales.count} {t('ventas.sales')} • {formatCurrency(totales.total)} {t('ventas.total')}
          {totales.anuladas > 0 && ` • ${totales.anuladas} ${t('ventas.voided')}`}
        </p>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.from')}</label>
          <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.to')}</label>
          <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-gray-500 mb-1">{t('common.search')}</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Ticket, cashier, payment method..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <button onClick={() => { setFechaInicio(new Date().toISOString().split('T')[0]); setFechaFin(new Date().toISOString().split('T')[0]) }}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
          <Calendar className="w-4 h-4 inline mr-1" /> {t('common.today')}
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('ventas.ticket')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('ventas.date')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('ventas.cashier')}</th>
              <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('ventas.method')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.subtotal')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.tax')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.total')}</th>
              <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('ventas.status')}</th>
              <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={9} className="text-center py-12">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto" />
              </td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-12 text-gray-400">
                <Receipt className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>{t('ventas.noSales')}</p>
              </td></tr>
            ) : (
              filtered.map((v) => (
                <tr key={v.id} className={`hover:bg-gray-50 transition-colors ${
                  v.estado === 'anulada' ? 'opacity-50' : ''
                }`}>
                  <td className="px-4 py-3 text-sm font-mono font-medium text-gray-900">
                    {formatTicketNumber(v.numero_venta)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <div>{formatDateTime(v.fecha)}</div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{v.usuario_nombre}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {metodoLabel[v.metodo_pago] || v.metodo_pago}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(v.subtotal)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">{formatCurrency(v.impuesto)}</td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-900 text-right">{formatCurrency(v.total)}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                      v.estado === 'completada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                    }`}>
                      {v.estado === 'completada' ? `✓ ${t('ventas.completed')}` : `✕ ${t('ventas.voidedStatus')}`}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button onClick={() => openDetalle(v)}
                        className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('ventas.viewDetail')}>
                        <Eye className="w-4 h-4 text-gray-500" />
                      </button>
                      {v.estado === 'completada' && (
                        <>
                          <button onClick={() => callApi<Venta & { detalles: VentaDetalle[] }>('ventas:getById', { id: v.id }).then((venta) => {
                            if (venta?.detalles) {
                              const ticketWin = window.open('', '_blank', 'width=320,height=600')
                              if (ticketWin) {
                                ticketWin.document.write(generateTicketHTML(venta))
                                ticketWin.document.close()
                                ticketWin.print()
                              }
                            }
                          })}
                            className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('ventas.reprint')}>
                            <Printer className="w-4 h-4 text-gray-500" />
                          </button>
                          <button onClick={() => setAnularTarget(v)}
                            className="p-1.5 hover:bg-red-50 rounded-lg" title={t('ventas.void')}>
                            <XCircle className="w-4 h-4 text-red-400" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* ======== MODAL DETALLE ======== */}
      <Modal open={detalleOpen} onClose={() => setDetalleOpen(false)}
        title={`Detalle — Ticket ${detalleVenta ? formatTicketNumber(detalleVenta.numero_venta) : ''}`} wide>
        {detalleVenta && (
          <div className="space-y-4">
            {/* Info de la venta */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">{t('ventas.date')}</p>
                <p className="font-medium">{formatDateTime(detalleVenta.fecha)}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('ventas.cashier')}</p>
                <p className="font-medium">{detalleVenta.usuario_nombre}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('ventas.paymentMethod')}</p>
                <p className="font-medium">{metodoLabel[detalleVenta.metodo_pago] || detalleVenta.metodo_pago}</p>
              </div>
              <div>
                <p className="text-gray-500">{t('ventas.status')}</p>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                  detalleVenta.estado === 'completada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {detalleVenta.estado === 'completada' ? '✓ Completada' : '✕ Anulada'}
                </span>
              </div>
            </div>

            {/* Items */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('ventas.products')}</h4>
              <div className="bg-gray-50 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">{t('ventas.product')}</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">{t('ventas.price')}</th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500">{t('ventas.qty')}</th>
                      <th className="text-right px-3 py-2 text-xs font-semibold text-gray-500">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {detalleVenta.detalles?.map((d) => (
                      <Fragment key={d.id}>
                        <tr>
                          <td className="px-3 py-2">
                            {d.producto_nombre || d.descripcion || '—'}
                            {d.componentes && d.componentes.length > 0 && (
                              <span className="ml-2 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700">
                                {i18n.language === 'en' ? 'Combo' : 'Combo'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">{formatCurrency(d.precio_unitario)}</td>
                          <td className="px-3 py-2 text-center">{d.cantidad}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(d.subtotal)}</td>
                        </tr>
                        {d.componentes?.map((c, i) => (
                          <tr key={`${d.id}-c${i}`} className="bg-emerald-50/40">
                            <td className="px-3 py-1 pl-8 text-xs text-gray-500">
                              └ {i18n.language === 'en' ? 'includes' : 'incluye'} · {c.nombre || `#${c.componente_id}`} ×{c.cantidad}
                            </td>
                            <td colSpan={3} />
                          </tr>
                        ))}
                      </Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totales */}
            <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Subtotal</span><span>{formatCurrency(detalleVenta.subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Sales Tax</span><span>{formatCurrency(detalleVenta.impuesto)}</span></div>
              {detalleVenta.descuento > 0 && (
                <div className="flex justify-between text-red-600"><span>{t('common.discount')}</span><span>-{formatCurrency(detalleVenta.descuento)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                <span>Total</span><span>{formatCurrency(detalleVenta.total)}</span>
              </div>
              <div className="flex justify-between text-gray-500"><span>Pagado</span><span>{formatCurrency(detalleVenta.monto_pagado)}</span></div>
              {detalleVenta.cambio > 0 && (
                <div className="flex justify-between text-green-600"><span>Cambio</span><span>{formatCurrency(detalleVenta.cambio)}</span></div>
              )}
            </div>

            {detalleVenta.notas && (
              <div className="bg-yellow-50 rounded-xl p-3 text-sm text-yellow-700">
                <strong>{t('common.notes')}:</strong> {detalleVenta.notas}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* ======== CONFIRM ANULAR ======== */}
      <Modal open={!!anularTarget} onClose={() => { setAnularTarget(null); setAnularMotivo('') }}
        title="Void Sale">
        <div className="space-y-4">
          <div className="bg-red-50 rounded-xl p-4 text-sm text-red-700 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">¿Estás seguro?</p>
              <p className="mt-1">
                Se anulará el ticket {anularTarget && formatTicketNumber(anularTarget.numero_venta)} por{' '}
                <strong>{anularTarget && formatCurrency(anularTarget.total)}</strong>.
                El stock de los productos se devolverá automáticamente.
              </p>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('ventas.voidReason')}</label>
            <textarea rows={2} value={anularMotivo}
              onChange={(e) => setAnularMotivo(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500"
              placeholder="E.g.: Customer changed mind, pricing error..." />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => { setAnularTarget(null); setAnularMotivo('') }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              {t('common.cancel')}
            </button>
            <button onClick={anularVenta}
              disabled={!anularMotivo.trim() || anulando}
              className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:bg-red-300 flex items-center gap-2">
              {anulando ? 'Voiding...' : <><XCircle className="w-4 h-4" /> Void Sale</>}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// Generador de HTML para ticket de re-impresión
function generateTicketHTML(venta: any): string {
  const items = venta.detalles?.map((d: any) =>
    `<tr><td>${d.producto_nombre}</td><td style="text-align:center">${d.cantidad}</td><td style="text-align:right">${formatCurrency(d.subtotal)}</td></tr>`
  ).join('') || ''

  return `<!DOCTYPE html><html><head><style>
    body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}
    h2{text-align:center;margin:5px 0;font-size:14px}
    table{width:100%;border-collapse:collapse;margin:8px 0}
    td{padding:2px 0}
    .total{font-weight:bold;font-size:14px;border-top:1px dashed #000;padding-top:5px;margin-top:5px}
    .center{text-align:center}.right{text-align:right}
    hr{border:none;border-top:1px dashed #000;margin:8px 0}
  </style></head><body>
    <h2>TOG Admin</h2>
    <div class="center">${formatTicketNumber(venta.numero_venta)}</div>
    <div class="center" style="font-size:10px;color:#666">${formatDateTime(venta.fecha)}</div>
    <hr>
    <table><thead><tr><th>Producto</th><th style="text-align:center">Cant</th><th style="text-align:right">Subtotal</th></tr></thead>
    <tbody>${items}</tbody></table>
    <hr>
    <div class="right">Subtotal: ${formatCurrency(venta.subtotal)}</div>
    <div class="right">Tax: ${formatCurrency(venta.impuesto)}</div>
    <div class="right total">TOTAL: ${formatCurrency(venta.total)}</div>
    <div class="right" style="margin-top:5px">Pagado: ${formatCurrency(venta.monto_pagado)}</div>
    ${venta.cambio > 0 ? `<div class="right">Cambio: ${formatCurrency(venta.cambio)}</div>` : ''}
    <hr>
    <div class="center" style="margin-top:10px;color:#666">¡Gracias por su compra!</div>
  </body></html>`
}
