import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '../stores/auth.store'
import {
  Lock, Unlock, DollarSign, ArrowUpCircle, ArrowDownCircle,
  Clock, AlertTriangle, CheckCircle, History, Calculator, Printer
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import { formatCurrency, formatDateTime } from '../lib/utils'

interface CajaState {
  id: number; fecha_apertura: string; fondo_inicial: number
  total_ventas: number; total_entradas: number; total_salidas: number
  total_esperado: number; total_real: number; diferencia: number
  estado: string; usuario_nombre: string
}

interface HistorialCaja {
  id: number; fecha_apertura: string; fecha_cierre: string | null
  fondo_inicial: number; total_ventas: number; total_entradas: number
  total_salidas: number; total_esperado: number; total_real: number
  diferencia: number; estado: string; usuario_nombre: string; notas: string | null
}

export default function CajaPage() {
  const { t, i18n } = useTranslation()
  const usuario = useAuthStore((s) => s.usuario)
  const [caja, setCaja] = useState<CajaState | null>(null)
  const [historial, setHistorial] = useState<HistorialCaja[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'caja' | 'historial'>('caja')

  // Apertura
  const [aperturaOpen, setAperturaOpen] = useState(false)
  const [fondoInicial, setFondoInicial] = useState('')
  const [fondoDefault, setFondoDefault] = useState('')

  useEffect(() => {
    window.api.config.get().then((cfg: any[]) => {
      const fd = cfg.find((c: any) => c.clave === 'fondo_inicial_default')
      if (fd?.valor) setFondoDefault(fd.valor)
    })
  }, [])

  // Movimiento
  const [movOpen, setMovOpen] = useState(false)
  const [movTipo, setMovTipo] = useState<'entrada' | 'salida'>('entrada')
  const [movMonto, setMovMonto] = useState('')
  const [movDesc, setMovDesc] = useState('')

  // Cierre
  const [cierreOpen, setCierreOpen] = useState(false)
  const [totalReal, setTotalReal] = useState('')
  const [cierreNotas, setCierreNotas] = useState('')

  useEffect(() => { loadCaja() }, [])

  const loadCaja = async () => {
    setLoading(true)
    const [status, hist] = await Promise.all([
      window.api.caja.status(),
      window.api.caja.historial(),
    ])
    setCaja(status || null)
    setHistorial(hist)
    setLoading(false)
  }

  // Totales calculados
  const totalEsperado = caja
    ? caja.fondo_inicial + caja.total_entradas - caja.total_salidas + caja.total_ventas
    : 0

  // ======== APERTURA ========
  const abrirCaja = async () => {
    const fondo = parseFloat(fondoInicial)
    if (isNaN(fondo) || fondo < 0) return
    await window.api.caja.abrir({ usuario_id: usuario!.id, fondo_inicial: fondo })
    setAperturaOpen(false)
    setFondoInicial('')
    await loadCaja()
  }

  // ======== MOVIMIENTO ========
  const registrarMovimiento = async () => {
    const monto = parseFloat(movMonto)
    if (isNaN(monto) || monto <= 0 || !movDesc.trim()) return
    await window.api.caja.movimiento({ tipo: movTipo, monto, descripcion: movDesc })
    setMovOpen(false)
    setMovMonto('')
    setMovDesc('')
    await loadCaja()
  }

  // ======== CIERRE ========
  const cerrarCaja = async () => {
    const real = parseFloat(totalReal)
    if (isNaN(real) || !caja) return
    // Backup automático antes de cerrar
    try { await window.api.caja.backupAuto() } catch {}
    await window.api.caja.cerrar({
      caja_id: caja.id,
      total_real: real,
      notas: cierreNotas || undefined,
    })
    setCierreOpen(false)
    setTotalReal('')
    setCierreNotas('')
    await loadCaja()
  }

  // Reporte X (parcial)
  const [reporteXOpen, setReporteXOpen] = useState(false)
  const [reporteX, setReporteX] = useState<any>(null)

  const verReporteX = async () => {
    const result = await window.api.caja.reporteX()
    if (result?.success) {
      setReporteX(result)
      setReporteXOpen(true)
    } else {
      alert(result?.error || 'Error al generar reporte')
    }
  }

  const imprimirCierre = () => {
    if (!caja) return
    const html = `<!DOCTYPE html><html><head><style>
      body{font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px}
      h2{text-align:center;margin:5px 0;font-size:14px}
      table{width:100%;border-collapse:collapse;margin:8px 0}
      td{padding:2px 0}
      .total{font-weight:bold;font-size:13px;border-top:1px dashed #000;padding-top:5px;margin-top:5px}
      .center{text-align:center}.right{text-align:right}
      hr{border:none;border-top:1px dashed #000;margin:8px 0}
    </style></head><body>
      <h2>TOG Admin - {t('caja.receiptTitle')}</h2>
      <div class="center">${formatDateTime(new Date().toISOString())}</div>
      <hr>
      <div>{t('caja.receiptCashier')} <strong>${caja.usuario_nombre}</strong></div>
      <div>{t('caja.receiptOpening')} ${formatDateTime(caja.fecha_apertura)}</div>
      <hr>
      <table>
        <tr><td>{t('caja.receiptInitialFund')}</td><td class="right">${formatCurrency(caja.fondo_inicial)}</td></tr>
        <tr><td>{t('caja.receiptSales')}</td><td class="right">${formatCurrency(caja.total_ventas)}</td></tr>
        <tr><td>{t('caja.receiptEntries')}</td><td class="right">${formatCurrency(caja.total_entradas)}</td></tr>
        <tr><td>{t('caja.receiptWithdrawals')}</td><td class="right">${formatCurrency(caja.total_salidas)}</td></tr>
        <tr><td class="total">{t('caja.receiptExpectedTotal')}</td><td class="right total">${formatCurrency(totalEsperado)}</td></tr>
      </table>
      <hr>
      <div class="total">{t('caja.receiptPhysicalCount')} ${formatCurrency(totalEsperado)}</div>
      <div class="total">{t('caja.receiptDifference')} $0.00</div>
      <hr>
      <div class="center" style="margin-top:15px;font-size:10px;color:#666">{t('caja.receiptDoc')}</div>
    </body></html>`
    const win = window.open('', '_blank', 'width=320,height=600')
    if (win) {
      win.document.write(html)
      win.document.close()
      win.print()
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('caja.title')}</h1>
          <p className="text-sm text-gray-500">
            {caja?.estado === 'abierta'
              ? `Abierta desde ${formatDateTime(caja.fecha_apertura)}`
              : 'No hay caja abierta'}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setView('caja')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === 'caja' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <Lock className="w-4 h-4 inline mr-1" /> {t('caja.currentRegister')}
          </button>
          <button onClick={() => setView('historial')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              view === 'historial' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}>
            <History className="w-4 h-4 inline mr-1" /> {t('caja.historyTab')}
          </button>
        </div>
      </div>

      {view === 'caja' ? (
        /* ======== VISTA CAJA ACTUAL ======== */
        !caja ? (
          /* Sin caja abierta */
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Lock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-gray-700 mb-2">{t('caja.noCashOpen')}</h2>
            <p className="text-gray-500 mb-6">{t('caja.noCashOpenDesc')}</p>
            <button onClick={() => { setFondoInicial(fondoDefault || ''); setAperturaOpen(true) }}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors inline-flex items-center gap-2">
              <Unlock className="w-5 h-5" /> {t('caja.open')}
            </button>
          </div>
        ) : (
          /* Caja abierta */
          <div className="space-y-4">
            {/* Tarjetas de resumen */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <SummaryCard label={t('caja.openingBalance')} value={formatCurrency(caja.fondo_inicial)} color="blue" />
              <SummaryCard label={t('caja.totalSales')} value={formatCurrency(caja.total_ventas)} color="green" />
              <SummaryCard label={t('caja.entries')} value={formatCurrency(caja.total_entradas)} color="emerald" />
              <SummaryCard label={t('caja.withdrawals')} value={formatCurrency(caja.total_salidas)} color="red" />
              <SummaryCard label={t('caja.expected')} value={formatCurrency(totalEsperado)} color="purple" />
            </div>

            {/* Fórmula */}
            <div className="bg-gray-50 rounded-xl p-4 text-sm text-gray-600">
              <p className="font-mono">
                <span className="text-gray-400">{t('caja.formula')}</span>{' '}
                Fondo ({formatCurrency(caja.fondo_inicial)}) {t('caja.receiptSales')} ({formatCurrency(caja.total_ventas)}) {t('caja.receiptEntries')} ({formatCurrency(caja.total_entradas)}) {t('caja.receiptWithdrawals')} ({formatCurrency(caja.total_salidas)}) = <strong>{formatCurrency(totalEsperado)}</strong>
              </p>
            </div>

            {/* Acciones */}
            <div className="flex gap-3">
              <button onClick={() => { setMovTipo('entrada'); setMovOpen(true) }}
                className="flex-1 py-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-emerald-200">
                <ArrowUpCircle className="w-5 h-5" /> {t('caja.recordEntry')}
              </button>
              <button onClick={() => { setMovTipo('salida'); setMovOpen(true) }}
                className="flex-1 py-3 bg-red-50 hover:bg-red-100 text-red-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-red-200">
                <ArrowDownCircle className="w-5 h-5" /> {t('caja.recordWithdrawal')}
              </button>
              <button onClick={verReporteX}
                className="flex-1 py-3 bg-yellow-50 hover:bg-yellow-100 text-yellow-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2 border border-yellow-200">
                <Calculator className="w-5 h-5" /> {t('caja.xReportShort')}
              </button>
              <button onClick={() => setTotalReal(String(Math.round(totalEsperado)))}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                <Calculator className="w-5 h-5" /> {t('caja.autoFill')}
              </button>
              <button onClick={imprimirCierre}
                className="flex-1 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors flex items-center justify-center gap-2">
                <Printer className="w-5 h-5" /> {t('common.print')}
              </button>
              <button onClick={() => setCierreOpen(true)}
                className="flex-1 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors flex items-center justify-center gap-2">
                <Lock className="w-5 h-5" /> {t('caja.close')}
              </button>
            </div>
          </div>
        )
      ) : (
        /* ======== VISTA HISTORIAL ======== */
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.opening')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.closing')}</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.cashier')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.fund')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.totalSales')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.expected')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.actual')}</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('caja.difference')}</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {historial.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-gray-400">
                    <History className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p>{t('caja.noHistoryDesc')}</p>
                  </td>
                </tr>
              ) : (
                historial.map((h) => (
                  <tr key={h.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{formatDateTime(h.fecha_apertura)}</td>
                    <td className="px-4 py-3 text-sm">{h.fecha_cierre ? formatDateTime(h.fecha_cierre) : '—'}</td>
                    <td className="px-4 py-3 text-sm">{h.usuario_nombre}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(h.fondo_inicial)}</td>
                    <td className="px-4 py-3 text-sm text-right font-medium">{formatCurrency(h.total_ventas)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(h.total_esperado)}</td>
                    <td className="px-4 py-3 text-sm text-right">{formatCurrency(h.total_real)}</td>
                    <td className={`px-4 py-3 text-sm text-right font-medium ${
                      h.diferencia === 0 ? 'text-green-600' : h.diferencia > 0 ? 'text-blue-600' : 'text-red-600'
                    }`}>
                      {h.diferencia === 0 ? '—' : (h.diferencia > 0 ? '+' : '') + formatCurrency(h.diferencia)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${
                        h.estado === 'cerrada' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'
                      }`}>
                        {h.estado === 'cerrada' ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {h.estado}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ======== MODAL APERTURA ======== */}
      <Modal open={aperturaOpen} onClose={() => setAperturaOpen(false)} title={t('caja.open')}>
        <div className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 text-sm text-blue-700">
            <p>{t('caja.openingBalanceDesc')}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('caja.openAmount')} *</label>
            <input type="number" step="0.01" min="0" value={fondoInicial}
              onChange={(e) => setFondoInicial(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
              placeholder="0.00" autoFocus />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setAperturaOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
            <button onClick={abrirCaja}
              disabled={!fondoInicial || parseFloat(fondoInicial) < 0}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
              <Unlock className="w-4 h-4" /> Abrir Caja
            </button>
          </div>
        </div>
      </Modal>

      {/* ======== MODAL MOVIMIENTO ======== */}
      <Modal open={movOpen} onClose={() => setMovOpen(false)}
        title={movTipo === 'entrada' ? (t('caja.recordEntry')) : (t('caja.recordWithdrawal'))}>
        <div className="space-y-4">
          <div className={`rounded-xl p-4 text-sm ${
            movTipo === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
          }`}>
            {movTipo === 'entrada'
              ? (i18n.language === 'en' ? 'Record extra money entering the register (e.g.: debt payment, adjustment).' : 'Registra dinero extra que ingresa a la caja (ej: pago de deuda, ajuste).')
              : (i18n.language === 'en' ? 'Record a withdrawal or expense from the register (e.g.: minor purchase, cash withdrawal).' : 'Registra un retiro o gasto de la caja (ej: compra menor, retiro de efectivo).')}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('caja.amount')} *</label>
            <input type="number" step="0.01" min="0.01" value={movMonto}
              onChange={(e) => setMovMonto(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
              placeholder="0.00" autoFocus />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.description')} *</label>
            <input type="text" value={movDesc}
              onChange={(e) => setMovDesc(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
              placeholder={t('caja.descPlaceholder')} />
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setMovOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
            <button onClick={registrarMovimiento}
              disabled={!movMonto || parseFloat(movMonto) <= 0 || !movDesc.trim()}
              className={`px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:bg-gray-300 flex items-center gap-2 ${
                movTipo === 'entrada' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}>
              {movTipo === 'entrada' ? <ArrowUpCircle className="w-4 h-4" /> : <ArrowDownCircle className="w-4 h-4" />}
              {i18n.language === 'en' ? 'Record ' : 'Registrar '}{movTipo === 'entrada' ? (i18n.language === 'en' ? 'Entry' : 'Entrada') : (i18n.language === 'en' ? 'Withdrawal' : 'Salida')}
            </button>
          </div>
        </div>
      </Modal>

      {/* ======== MODAL CIERRE ======== */}
      <Modal open={cierreOpen} onClose={() => setCierreOpen(false)} title={t('caja.close')}>
        <div className="space-y-4">
          {caja && (
            <>
              <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">{t('caja.receiptInitialFund')}</span><span className="font-medium">{formatCurrency(caja.fondo_inicial)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">{t('caja.receiptSales')}</span><span className="font-medium">{formatCurrency(caja.total_ventas)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">{t('caja.receiptEntries')}</span><span className="font-medium">{formatCurrency(caja.total_entradas)}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">{t('caja.receiptWithdrawals')}</span><span className="font-medium">{formatCurrency(caja.total_salidas)}</span></div>
                <div className="flex justify-between font-bold text-base pt-2 border-t border-gray-200">
                  <span>{t('caja.receiptExpectedTotal')}</span>
                  <span className="text-blue-600">{formatCurrency(totalEsperado)}</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('caja.howMuchMoney')} *
                </label>
                <input type="number" step="0.01" min="0" value={totalReal}
                  onChange={(e) => setTotalReal(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl text-2xl font-bold text-center focus:ring-2 focus:ring-blue-500"
                  placeholder="0.00" autoFocus />
              </div>

              {totalReal && !isNaN(parseFloat(totalReal)) && (
                <div className={`rounded-xl p-4 text-center ${
                  parseFloat(totalReal) === totalEsperado
                    ? 'bg-green-50'
                    : parseFloat(totalReal) > totalEsperado
                      ? 'bg-blue-50'
                      : 'bg-red-50'
                }`}>
                  <p className={`text-sm ${
                    parseFloat(totalReal) === totalEsperado ? 'text-green-600'
                      : parseFloat(totalReal) > totalEsperado ? 'text-blue-600' : 'text-red-600'
                  }`}>
                    {parseFloat(totalReal) === totalEsperado
                      ? t('caja.balances')
                      : parseFloat(totalReal) > totalEsperado
                        ? `t('caja.over') + ' ' ${formatCurrency(parseFloat(totalReal) - totalEsperado)}`
                        : `t('caja.short') + ' ' ${formatCurrency(totalEsperado - parseFloat(totalReal))}`}
                  </p>
                  <p className={`text-2xl font-bold mt-1 ${
                    parseFloat(totalReal) === totalEsperado ? 'text-green-700'
                      : parseFloat(totalReal) > totalEsperado ? 'text-blue-700' : 'text-red-700'
                  }`}>
                    {t('caja.difference')}: {parseFloat(totalReal) >= totalEsperado ? '+' : ''}{formatCurrency(parseFloat(totalReal) - totalEsperado)}
                  </p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.notes')} ({t('caja.closeOptional')})</label>
                <textarea rows={2} value={cierreNotas}
                  onChange={(e) => setCierreNotas(e.target.value)}
                  className="w-full px-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder={t('caja.closePlaceholder')} />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setCierreOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">Cancelar</button>
            <button onClick={cerrarCaja}
              disabled={!totalReal || isNaN(parseFloat(totalReal))}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-lg hover:bg-orange-600 disabled:bg-gray-300 flex items-center gap-2">
              <Lock className="w-4 h-4" /> Cerrar Caja
            </button>
          </div>
        </div>
      </Modal>
      {/* ======== MODAL REPORTE X ======== */}
      <Modal open={reporteXOpen} onClose={() => setReporteXOpen(false)} title={i18n.language === 'en' ? 'X Report (Partial)' : 'Reporte X (Parcial)'}>
        {reporteX && (
          <div className="space-y-4">
            <div className="bg-yellow-50 rounded-xl p-4 text-center">
              <p className="text-sm text-yellow-700">{t('caja.xReportPartial')}</p>
              <p className="text-xs text-yellow-600 mt-1">Generado: {new Date().toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">{t('caja.cashier')}</span><span className="font-medium">{reporteX.caja.usuario_nombre}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('caja.opening')}</span><span className="font-medium">{formatDateTime(reporteX.caja.fecha_apertura)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">{t('caja.openAmount')}</span><span className="font-medium">{formatCurrency(reporteX.caja.fondo_inicial)}</span></div>
              <div className="flex justify-between font-bold pt-2 border-t border-gray-200">
                <span>{t('caja.receiptExpectedTotal')}</span>
                <span className="text-blue-600">{formatCurrency(reporteX.totalEsperado)}</span>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('caja.salesByMethod')}</h4>
              <div className="space-y-1">
                {reporteX.ventasPorMetodo?.map((v: any, i: number) => (
                  <div key={i} className="flex justify-between text-sm bg-white rounded-lg p-2">
                    <span className="text-gray-600 capitalize">{v.metodo_pago} ({v.cantidad})</span>
                    <span className="font-medium">{formatCurrency(v.total)}</span>
                  </div>
                ))}
                {(!reporteX.ventasPorMetodo || reporteX.ventasPorMetodo.length === 0) && (
                  <p className="text-sm text-gray-400 text-center py-2">{t('caja.noSalesRecorded')}</p>
                )}
              </div>
            </div>
            {reporteX.movimientos?.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">{t('caja.movements')}</h4>
                <div className="space-y-1">
                  {reporteX.movimientos.map((m: any, i: number) => (
                    <div key={i} className="flex justify-between text-sm bg-white rounded-lg p-2">
                      <span className="text-gray-600">{m.tipo === 'entrada' ? '↗' : '↘'} {m.descripcion}</span>
                      <span className={m.tipo === 'entrada' ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                        {m.tipo === 'entrada' ? '+' : '-'}{formatCurrency(m.monto)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => setReporteXOpen(false)}
              className="w-full py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200">
              {t('common.close')}
            </button>
          </div>
        )}
      </Modal>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    emerald: 'bg-emerald-50 text-emerald-600',
    red: 'bg-red-50 text-red-600',
    purple: 'bg-purple-50 text-purple-600',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-lg font-bold ${colors[color]?.split(' ')[1] || 'text-gray-900'}`}>{value}</p>
    </div>
  )
}
