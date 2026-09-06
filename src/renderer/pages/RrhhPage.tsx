import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users, CalendarCheck, Banknote, Plus, Edit2, Trash2, Save, X, CheckCircle2, Printer
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'

interface Empleado {
  id: number; nombre: string; documento: string | null; cargo: string | null
  salario_mensual: number; telefono: string | null; direccion: string | null
  fecha_ingreso: string; activo: number
}
interface AsistenciaRow {
  empleado_id: number; nombre: string; cargo: string | null
  asistencia_id: number | null; estado: string | null; notas: string | null
}
interface Nomina {
  id: number; empleado_id: number; empleado_nombre: string; empleado_documento: string | null; empleado_cargo: string | null
  periodo_inicio: string; periodo_fin: string; salario_base: number; dias_trabajados: number
  bonos: number; deducciones: number; total_pagar: number; estado: string; pagado_en: string | null
}

const ESTADOS_ASISTENCIA = ['presente', 'ausente', 'tarde', 'permiso', 'descanso'] as const
const HOY = () => new Date().toISOString().slice(0, 10)

export default function RrhhPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<'empleados' | 'asistencia' | 'nomina'>('empleados')

  // Empleados
  const [empleados, setEmpleados] = useState<Empleado[]>([])
  const [empModalOpen, setEmpModalOpen] = useState(false)
  const [editingEmp, setEditingEmp] = useState<Empleado | null>(null)
  const [empForm, setEmpForm] = useState({ nombre: '', documento: '', cargo: '', salario_mensual: '', telefono: '', direccion: '', fecha_ingreso: '' })
  const [deleteEmp, setDeleteEmp] = useState<Empleado | null>(null)

  // Asistencia
  const [fechaAsistencia, setFechaAsistencia] = useState(HOY())
  const [asistencia, setAsistencia] = useState<AsistenciaRow[]>([])

  // Nómina
  const [nominaDesde, setNominaDesde] = useState(HOY())
  const [nominaHasta, setNominaHasta] = useState(HOY())
  const [nominas, setNominas] = useState<Nomina[]>([])
  const [generando, setGenerando] = useState(false)
  const [bonos, setBonos] = useState<Record<number, string>>({})
  const [deducciones, setDeducciones] = useState<Record<number, string>>({})

  const loadEmpleados = async () => {
    try {
      const list = await callApi<Empleado[]>('rrhh:empleados-list', { incluirInactivos: true })
      setEmpleados(Array.isArray(list) ? list : [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const loadAsistencia = async () => {
    try {
      const res = await callApi<{ fecha: string; registros: AsistenciaRow[] }>('rrhh:asistencia-list', { fecha: fechaAsistencia })
      setAsistencia(res.registros || [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const loadNominas = async () => {
    try {
      const list = await callApi<Nomina[]>('rrhh:nomina-list', {})
      setNominas(Array.isArray(list) ? list : [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  useEffect(() => {
    if (tab === 'empleados') loadEmpleados()
    if (tab === 'asistencia') loadAsistencia()
    if (tab === 'nomina') loadNominas()
  }, [tab])

  const openCreateEmp = () => {
    setEditingEmp(null)
    setEmpForm({ nombre: '', documento: '', cargo: '', salario_mensual: '', telefono: '', direccion: '', fecha_ingreso: '' })
    setEmpModalOpen(true)
  }

  const openEditEmp = (e: Empleado) => {
    setEditingEmp(e)
    setEmpForm({
      nombre: e.nombre, documento: e.documento || '', cargo: e.cargo || '',
      salario_mensual: String(e.salario_mensual || ''), telefono: e.telefono || '',
      direccion: e.direccion || '', fecha_ingreso: e.fecha_ingreso?.slice(0, 10) || '',
    })
    setEmpModalOpen(true)
  }

  const saveEmp = async () => {
    if (!empForm.nombre.trim()) return
    const payload = {
      nombre: empForm.nombre.trim(),
      documento: empForm.documento.trim() || undefined,
      cargo: empForm.cargo.trim() || undefined,
      salario_mensual: parseFloat(empForm.salario_mensual) || 0,
      telefono: empForm.telefono.trim() || undefined,
      direccion: empForm.direccion.trim() || undefined,
      fecha_ingreso: empForm.fecha_ingreso || undefined,
    }
    try {
      if (editingEmp) {
        await callApi('rrhh:empleado-update', { id: editingEmp.id, data: payload })
      } else {
        await callApi('rrhh:empleado-create', payload)
      }
      setEmpModalOpen(false)
      await loadEmpleados()
      toast.success(t('common.save'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const removeEmp = async (e: Empleado) => {
    try {
      const res = await callApi<{ success: boolean; desactivado?: boolean }>('rrhh:empleado-delete', { id: e.id })
      if (res?.desactivado) toast.info(t('rrhh.deactivatedHasPayroll'))
      setDeleteEmp(null)
      await loadEmpleados()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const marcarAsistencia = async (empleado_id: number, estado: string) => {
    try {
      await callApi('rrhh:asistencia-registrar', { empleado_id, fecha: fechaAsistencia, estado })
      await loadAsistencia()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const generarNomina = async () => {
    setGenerando(true)
    const parseMap = (m: Record<number, string>) =>
      Object.fromEntries(Object.entries(m).map(([k, v]) => [Number(k), parseFloat(v) || 0]))
    try {
      const res = await callApi<{ success: boolean; nominas: Nomina[]; error?: string }>('rrhh:nomina-generar', {
        periodo_inicio: nominaDesde,
        periodo_fin: nominaHasta,
        bonos: parseMap(bonos),
        deducciones: parseMap(deducciones),
      })
      setNominas(res.nominas || [])
      toast.success(t('rrhh.payrollGenerated'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    } finally {
      setGenerando(false)
    }
  }

  const pagarNomina = async () => {
    const ids = nominas.filter((n) => n.estado === 'pendiente').map((n) => n.id)
    if (ids.length === 0) return
    try {
      await callApi('rrhh:nomina-pagar', { ids })
      toast.success(t('rrhh.payrollPaid'))
      await loadNominas()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const imprimirRecibos = () => {
    const recibos = nominas.map((n) => `
      <div style="page-break-after:always;font-family:monospace;font-size:12px;width:280px;margin:0 auto;padding:10px">
        <h2 style="text-align:center;margin:4px 0;font-size:14px">${t('rrhh.payrollReceipt')}</h2>
        <div style="text-align:center;font-size:10px;color:#666">${n.periodo_inicio} → ${n.periodo_fin}</div>
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <div><strong>${n.empleado_nombre}</strong></div>
        ${n.empleado_documento ? `<div style="font-size:11px">${n.empleado_documento}</div>` : ''}
        ${n.empleado_cargo ? `<div style="font-size:11px">${n.empleado_cargo}</div>` : ''}
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.baseSalary')}</span><span>${formatMoney(n.salario_base)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.daysWorked')}</span><span>${n.dias_trabajados}</span></div>
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.bonuses')}</span><span>${formatMoney(n.bonos)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.deductions')}</span><span>-${formatMoney(n.deducciones)}</span></div>
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px"><span>${t('rrhh.totalToPay')}</span><span>${formatMoney(n.total_pagar)}</span></div>
        <div style="text-align:center;font-size:10px;color:#666;margin-top:20px">${t('rrhh.receiptSignature')}</div>
      </div>
    `).join('')
    const win = window.open('', '_blank', 'width=400,height=700')
    if (!win) return
    win.document.write(`<!DOCTYPE html><html><head><title>${t('rrhh.payrollReceipt')}</title></head><body>${recibos}</body></html>`)
    win.document.close()
    win.print()
  }

  const tabs = [
    { id: 'empleados' as const, icon: Users, label: t('rrhh.tabEmployees') },
    { id: 'asistencia' as const, icon: CalendarCheck, label: t('rrhh.tabAttendance') },
    { id: 'nomina' as const, icon: Banknote, label: t('rrhh.tabPayroll') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{t('rrhh.title')}</h1>
          <p className="text-sm text-gray-500">{t('rrhh.subtitle')}</p>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-200">
        {tabs.map(({ id, icon: Icon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}>
            <Icon className="w-4 h-4 inline mr-1.5" /> {label}
          </button>
        ))}
      </div>

      {tab === 'empleados' && (
        <div className="space-y-4">
          {has('rrhh_edit') && (
            <div className="flex justify-end">
              <button onClick={openCreateEmp}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                <Plus className="w-4 h-4" /> {t('rrhh.newEmployee')}
              </button>
            </div>
          )}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.position')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.monthlySalary')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.hireDate')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th>
                  {has('rrhh_edit') && <th className="w-24" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {empleados.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400">{t('rrhh.noEmployees')}</td></tr>
                ) : empleados.map((e) => (
                  <tr key={e.id} className={`hover:bg-gray-50 ${!e.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{e.nombre}</p>
                      {e.documento && <p className="text-xs text-gray-400">{e.documento}</p>}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{e.cargo || '—'}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatMoney(e.salario_mensual)}</td>
                    <td className="px-4 py-3 text-gray-600">{e.fecha_ingreso?.slice(0, 10)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${e.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {e.activo ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    {has('rrhh_edit') && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => openEditEmp(e)} className="p-1.5 hover:bg-blue-50 rounded-lg" title={t('common.edit')}>
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          {e.activo === 1 && (
                            <button onClick={() => setDeleteEmp(e)} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('common.delete')}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'asistencia' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <input type="date" value={fechaAsistencia} onChange={(e) => setFechaAsistencia(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            <p className="text-xs text-gray-400">{t('rrhh.attendanceHint')}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.position')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.attendanceStatus')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {asistencia.length === 0 ? (
                  <tr><td colSpan={3} className="text-center py-10 text-gray-400">{t('rrhh.noEmployees')}</td></tr>
                ) : asistencia.map((r) => (
                  <tr key={r.empleado_id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{r.nombre}</td>
                    <td className="px-4 py-3 text-gray-600">{r.cargo || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-1">
                        {ESTADOS_ASISTENCIA.map((est) => (
                          <button key={est} disabled={!has('rrhh_edit')}
                            onClick={() => marcarAsistencia(r.empleado_id, est)}
                            className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-colors ${
                              r.estado === est
                                ? 'bg-blue-600 text-white border-blue-600'
                                : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 disabled:opacity-40'
                            }`}>
                            {t(`rrhh.attendance.${est}`)}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'nomina' && (
        <div className="space-y-4">
          {has('rrhh_nomina') && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.periodFrom')}</label>
                  <input type="date" value={nominaDesde} onChange={(e) => setNominaDesde(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.periodTo')}</label>
                  <input type="date" value={nominaHasta} onChange={(e) => setNominaHasta(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                </div>
                <button onClick={generarNomina} disabled={generando}
                  className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                  {generando ? t('common.saving') : t('rrhh.generatePayroll')}
                </button>
                {nominas.some((n) => n.estado === 'pendiente') && (
                  <>
                    <button onClick={pagarNomina}
                      className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {t('rrhh.markPaid')}
                    </button>
                    <button onClick={imprimirRecibos} title={t('common.print')}
                      className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                      <Printer className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
              <p className="text-xs text-gray-400">{t('rrhh.payrollHint')}</p>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('nav.clients')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.period')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.daysWorked')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.bonuses')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.deductions')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.totalToPay')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {nominas.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-10 text-gray-400">{t('rrhh.noPayroll')}</td></tr>
                ) : nominas.map((n) => (
                  <tr key={n.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{n.empleado_nombre}</p>
                      {n.empleado_cargo && <p className="text-xs text-gray-400">{n.empleado_cargo}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{n.periodo_inicio} → {n.periodo_fin}</td>
                    <td className="px-4 py-3 text-center">{n.dias_trabajados}</td>
                    <td className="px-4 py-3">
                      {has('rrhh_nomina') && n.estado === 'pendiente' ? (
                        <input type="number" step="0.01" min="0" value={bonos[n.id] ?? ''}
                          onChange={(e) => setBonos({ ...bonos, [n.id]: e.target.value })}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-right text-sm" />
                      ) : (
                        <span className="block text-right">{formatMoney(n.bonos)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {has('rrhh_nomina') && n.estado === 'pendiente' ? (
                        <input type="number" step="0.01" min="0" value={deducciones[n.id] ?? ''}
                          onChange={(e) => setDeducciones({ ...deducciones, [n.id]: e.target.value })}
                          placeholder="0.00"
                          className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-right text-sm" />
                      ) : (
                        <span className="block text-right">{formatMoney(n.deducciones)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">{formatMoney(n.total_pagar)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${
                        n.estado === 'pagada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {n.estado === 'pagada' ? t('rrhh.payrollPaidStatus') : t('rrhh.payrollPendingStatus')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={empModalOpen} onClose={() => setEmpModalOpen(false)}
        title={editingEmp ? t('rrhh.editEmployee') : t('rrhh.newEmployee')}>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.name')} *</label>
            <input value={empForm.nombre} onChange={(e) => setEmpForm({ ...empForm, nombre: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rrhh.document')}</label>
              <input value={empForm.documento} onChange={(e) => setEmpForm({ ...empForm, documento: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" placeholder="V-12345678" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rrhh.position')}</label>
              <input value={empForm.cargo} onChange={(e) => setEmpForm({ ...empForm, cargo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rrhh.monthlySalary')}</label>
              <input type="number" step="0.01" min="0" value={empForm.salario_mensual}
                onChange={(e) => setEmpForm({ ...empForm, salario_mensual: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('rrhh.hireDate')}</label>
              <input type="date" value={empForm.fecha_ingreso} onChange={(e) => setEmpForm({ ...empForm, fecha_ingreso: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.phone')}</label>
              <input value={empForm.telefono} onChange={(e) => setEmpForm({ ...empForm, telefono: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('clientes.address')}</label>
              <input value={empForm.direccion} onChange={(e) => setEmpForm({ ...empForm, direccion: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => setEmpModalOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200">
              <X className="w-4 h-4 inline" /> {t('common.cancel')}
            </button>
            <button onClick={saveEmp} disabled={!empForm.nombre.trim()}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
              <Save className="w-4 h-4" /> {t('common.save')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteEmp} onClose={() => setDeleteEmp(null)}
        onConfirm={() => { if (deleteEmp) removeEmp(deleteEmp) }}
        title={t('rrhh.deleteEmployee')}
        message={t('rrhh.deleteEmployeeMsg', { name: deleteEmp?.nombre || '' })}
        confirmText={t('common.delete')} danger />
    </div>
  )
}
