import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Printer, RefreshCw, Save, Receipt, FileText, ShieldCheck, Loader2 } from 'lucide-react'
import { documentoDePrueba, type AnchoTicket } from '@shared/print'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useAuthStore } from '@core/auth/store'
import { callApi } from '../lib/api-client'
import TicketLayout from '../components/print/TicketLayout'
import A4Layout from '../components/print/A4Layout'

interface ConfigImpresion {
  razon_social: string
  rif: string
  direccion: string
  telefono: string
  email: string
  pie_ticket: string
  puerto_impresora: string
  ancho_ticket: AnchoTicket
  abrir_cajon: boolean
  copias: number
  serie: string
  correlativo: number
  alicuota_iva: number
  proximo_numero_control?: string
  proxima_factura?: number
}

interface Puerto {
  path: string
  fabricante?: string | null
}

const VACIO: ConfigImpresion = {
  razon_social: '',
  rif: '',
  direccion: '',
  telefono: '',
  email: '',
  pie_ticket: '',
  puerto_impresora: '',
  ancho_ticket: 80,
  abrir_cajon: false,
  copias: 1,
  serie: 'A',
  correlativo: 0,
  alicuota_iva: 0,
}

type Pestana = 'impresora' | 'fiscal'

export default function ImpresionPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const puedeConfigurar = has('print_config')
  const esAdmin = useAuthStore((s) => s.usuario?.rol) === 'admin'

  const [pestana, setPestana] = useState<Pestana>('impresora')
  const [form, setForm] = useState<ConfigImpresion>(VACIO)
  const [puertos, setPuertos] = useState<Puerto[]>([])
  const [cargando, setCargando] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [probando, setProbando] = useState(false)
  const [errorPuertos, setErrorPuertos] = useState('')

  // Numeración (factura propia + N° de control fiscal). Solo un admin puede
  // cambiarla y con confirmación: renumerar comprobantes ya emitidos no se
  // deshace.
  const [proximoControl, setProximoControl] = useState('1')
  const [proximaFactura, setProximaFactura] = useState('1')
  const [numeracionOriginal, setNumeracionOriginal] = useState({ serie: 'A', proximo_control: 1, proxima_factura: 1 })
  const [guardandoNumeracion, setGuardandoNumeracion] = useState(false)
  const [confirmNumeracion, setConfirmNumeracion] = useState(false)

  const cargar = async () => {
    setCargando(true)
    try {
      const cfg = await callApi<ConfigImpresion>('print:config', {})
      setForm({ ...VACIO, ...cfg, ancho_ticket: cfg.ancho_ticket === 58 ? 58 : 80 })
      const proximo = (Number(cfg.correlativo) || 0) + 1
      const factura = Number(cfg.proxima_factura) || 1
      setProximoControl(String(proximo))
      setProximaFactura(String(factura))
      setNumeracionOriginal({ serie: (cfg.serie || 'A').toUpperCase(), proximo_control: proximo, proxima_factura: factura })
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setCargando(false)
    }
  }

  const numeroControlPreview = `${(form.serie || 'A').toUpperCase()}-${String(Number(proximoControl) || 0).padStart(8, '0')}`
  const numeracionCambio =
    (form.serie || 'A').toUpperCase() !== numeracionOriginal.serie ||
    Number(proximoControl) !== numeracionOriginal.proximo_control ||
    Number(proximaFactura) !== numeracionOriginal.proxima_factura

  const guardarNumeracion = async () => {
    setGuardandoNumeracion(true)
    try {
      const res = await callApi<{ success: boolean; error?: string }>('facturacion:set-numeracion', {
        serie: form.serie,
        proximo_numero_control: Number(proximoControl),
        proxima_factura: Number(proximaFactura),
      })
      if (res?.success) {
        toast.success(t('print.numberingSaved'))
        await cargar()
      } else {
        toast.error(res?.error || t('common.error'))
      }
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setGuardandoNumeracion(false)
    }
  }

  const pedirGuardarNumeracion = () => {
    if (!numeracionCambio) {
      toast.info(t('print.numberingNoChanges'))
      return
    }
    setConfirmNumeracion(true)
  }

  const cargarPuertos = async () => {
    setErrorPuertos('')
    try {
      const res = await callApi<{ success: boolean; puertos?: Puerto[]; error?: string }>('print:puertos', {})
      if (res?.success) setPuertos(res.puertos || [])
      else setErrorPuertos(res?.error || t('print.portsError'))
    } catch (err: any) {
      setErrorPuertos(err?.message || t('print.portsError'))
    }
  }

  useEffect(() => {
    cargar()
    cargarPuertos()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const documentoPrueba = useMemo(
    () =>
      documentoDePrueba(
        {
          razon_social: form.razon_social || 'TOG Admin',
          rif: form.rif,
          direccion: form.direccion,
          telefono: form.telefono,
          email: form.email,
        },
        {
          numero_control: numeroControlPreview,
          alicuota_iva: form.alicuota_iva || undefined,
          pie: form.pie_ticket,
        },
      ),
    [form, numeroControlPreview],
  )

  const guardar = async () => {
    setGuardando(true)
    try {
      const res = await callApi<{ success: boolean; error?: string; config?: ConfigImpresion }>('print:set-config', {
        razon_social: form.razon_social,
        rif: form.rif,
        direccion: form.direccion,
        telefono: form.telefono,
        email: form.email,
        pie_ticket: form.pie_ticket,
        puerto_impresora: form.puerto_impresora,
        ancho_ticket: form.ancho_ticket,
        abrir_cajon: form.abrir_cajon,
        copias: form.copias,
      })
      if (res?.success) {
        toast.success(t('print.saved'))
        await cargar()
      } else {
        toast.error(res?.error || t('common.error'))
      }
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setGuardando(false)
    }
  }

  const probar = async () => {
    setProbando(true)
    try {
      const res = await callApi<{ success: boolean; error?: string }>('print:test', {})
      if (res?.success) toast.success(t('print.testOk'))
      else toast.error(res?.error || t('print.printError'))
    } catch (err: any) {
      toast.error(err?.message || t('print.printError'))
    } finally {
      setProbando(false)
    }
  }

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500'
  const etiqueta = 'block text-xs font-medium text-gray-600 mb-1'

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('print.title')}</h1>
          <p className="text-sm text-gray-500">{t('print.subtitle')}</p>
        </div>
        {puedeConfigurar && (
          <div className="flex gap-2">
            <button
              onClick={probar}
              disabled={probando}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              {probando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {t('print.testPrinter')}
            </button>
            <button
              onClick={guardar}
              disabled={guardando}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300"
            >
              {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {t('common.save')}
            </button>
          </div>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setPestana('impresora')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${
            pestana === 'impresora' ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'
          }`}
        >
          <Receipt className="w-4 h-4" /> {t('print.tabPrinter')}
        </button>
        <button
          onClick={() => setPestana('fiscal')}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg border ${
            pestana === 'fiscal' ? 'bg-blue-50 border-blue-300 text-blue-700 font-medium' : 'border-gray-200 text-gray-600'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> {t('print.tabFiscal')}
        </button>
      </div>

      <ConfirmDialog open={confirmNumeracion} onClose={() => setConfirmNumeracion(false)}
        onConfirm={guardarNumeracion}
        title={t('print.confirmNumberingTitle')}
        message={t('print.confirmNumberingMessage', { factura: proximaFactura, control: numeroControlPreview })}
        confirmText={t('print.saveNumbering')} danger />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="space-y-4">
          {pestana === 'impresora' ? (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-gray-800">{t('print.printerSection')}</h2>
                <button
                  onClick={cargarPuertos}
                  className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700"
                  title={t('print.refreshPorts')}
                >
                  <RefreshCw className="w-3.5 h-3.5" /> {t('print.refreshPorts')}
                </button>
              </div>

              <div>
                <label className={etiqueta}>{t('print.port')}</label>
                <div className="flex gap-2">
                  {puertos.length > 0 ? (
                    <select
                      value={form.puerto_impresora}
                      onChange={(e) => setForm({ ...form, puerto_impresora: e.target.value })}
                      disabled={!puedeConfigurar}
                      className={inputClass}
                    >
                      <option value="">{t('print.portNone')}</option>
                      {puertos.map((p) => (
                        <option key={p.path} value={p.path}>
                          {p.path}
                          {p.fabricante ? ` — ${p.fabricante}` : ''}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.puerto_impresora}
                      onChange={(e) => setForm({ ...form, puerto_impresora: e.target.value })}
                      placeholder="COM3"
                      disabled={!puedeConfigurar}
                      className={inputClass}
                    />
                  )}
                </div>
                {errorPuertos && <p className="text-xs text-amber-600 mt-1">{errorPuertos}</p>}
                <p className="text-xs text-gray-400 mt-1">{t('print.portHelp')}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={etiqueta}>{t('print.paperWidth')}</label>
                  <select
                    value={form.ancho_ticket}
                    onChange={(e) => setForm({ ...form, ancho_ticket: Number(e.target.value) === 58 ? 58 : 80 })}
                    disabled={!puedeConfigurar}
                    className={inputClass}
                  >
                    <option value={80}>80 mm (48 {t('print.columns')})</option>
                    <option value={58}>58 mm (32 {t('print.columns')})</option>
                  </select>
                </div>
                <div>
                  <label className={etiqueta}>{t('print.copies')}</label>
                  <input
                    type="number"
                    min={1}
                    max={3}
                    value={form.copias}
                    onChange={(e) => setForm({ ...form, copias: Number(e.target.value) || 1 })}
                    disabled={!puedeConfigurar}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.abrir_cajon}
                  onChange={(e) => setForm({ ...form, abrir_cajon: e.target.checked })}
                  disabled={!puedeConfigurar}
                />
                {t('print.openDrawer')}
              </label>

              {/* Atajo: el RIF y la numeración viven en la otra pestaña y era
                  fácil quedarse en "Impresora" sin verlos. */}
              <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">
                {t('print.fiscalHint')}{' '}
                <button
                  type="button"
                  onClick={() => setPestana('fiscal')}
                  className="text-blue-600 hover:underline font-medium"
                >
                  {t('print.goToFiscal')}
                </button>
              </p>
            </section>
          ) : (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">{t('print.fiscalSection')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className={etiqueta}>{t('print.businessName')}</label>
                  <input value={form.razon_social} onChange={(e) => setForm({ ...form, razon_social: e.target.value })} disabled={!puedeConfigurar} className={inputClass} />
                </div>
                <div>
                  <label className={etiqueta}>{t('print.taxId')}</label>
                  <input value={form.rif} onChange={(e) => setForm({ ...form, rif: e.target.value })} placeholder="J-12345678-9" disabled={!puedeConfigurar} className={inputClass} />
                </div>
                <div>
                  <label className={etiqueta}>{t('print.phone')}</label>
                  <input value={form.telefono} onChange={(e) => setForm({ ...form, telefono: e.target.value })} disabled={!puedeConfigurar} className={inputClass} />
                </div>
                <div className="col-span-2">
                  <label className={etiqueta}>{t('print.address')}</label>
                  <input value={form.direccion} onChange={(e) => setForm({ ...form, direccion: e.target.value })} disabled={!puedeConfigurar} className={inputClass} />
                </div>
                <div>
                  <label className={etiqueta}>{t('print.taxRate')}</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step="0.5"
                    value={form.alicuota_iva}
                    onChange={(e) => setForm({ ...form, alicuota_iva: Number(e.target.value) || 0 })}
                    disabled={!puedeConfigurar}
                    className={inputClass}
                  />
                </div>
                <div className="col-span-2">
                  <label className={etiqueta}>{t('print.footer')}</label>
                  <input value={form.pie_ticket} onChange={(e) => setForm({ ...form, pie_ticket: e.target.value })} disabled={!puedeConfigurar} className={inputClass} />
                </div>
              </div>
              <p className="text-xs text-gray-500">{t('print.fiscalHelp')}</p>
            </section>
          )}

          {pestana === 'fiscal' && (
            <section className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <h2 className="text-sm font-semibold text-gray-800">{t('print.numberingSection')}</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={etiqueta}>{t('print.controlSerie')}</label>
                  <input
                    value={form.serie}
                    onChange={(e) => setForm({ ...form, serie: e.target.value.toUpperCase() })}
                    disabled={!esAdmin}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={etiqueta}>{t('print.controlNext')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={proximoControl}
                    onChange={(e) => setProximoControl(e.target.value.replace(/\D/g, ''))}
                    disabled={!esAdmin}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">{numeroControlPreview}</p>
                </div>
                <div className="col-span-2">
                  <label className={etiqueta}>{t('print.invoiceNext')}</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={proximaFactura}
                    onChange={(e) => setProximaFactura(e.target.value.replace(/\D/g, ''))}
                    disabled={!esAdmin}
                    className={inputClass}
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('print.invoiceNextHelp')}</p>
                </div>
              </div>
              <p className={`text-xs ${esAdmin ? 'text-gray-500' : 'text-amber-600'}`}>
                {esAdmin ? t('print.numberingHelp') : t('print.numberingAdminOnly')}
              </p>
              <div className="flex justify-end">
                <button
                  onClick={pedirGuardarNumeracion}
                  disabled={!esAdmin || guardandoNumeracion}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:bg-purple-300 flex items-center gap-2"
                >
                  {guardandoNumeracion ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {t('print.saveNumbering')}
                </button>
              </div>
            </section>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" /> {t('print.preview')}
            </h2>
            <span className="text-xs text-gray-400">{t('print.previewHelp')}</span>
          </div>
          <div className="overflow-auto">
            <TicketLayout documento={documentoPrueba} ancho={form.ancho_ticket} maxAlto={360} />
          </div>
          <details className="bg-white rounded-xl border border-gray-200 p-3">
            <summary className="text-sm font-medium text-gray-700 cursor-pointer">{t('print.previewA4')}</summary>
            <div className="mt-3 overflow-auto border border-gray-200">
              <A4Layout documento={{ ...documentoPrueba, titulo: 'FACTURA' }} />
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}
