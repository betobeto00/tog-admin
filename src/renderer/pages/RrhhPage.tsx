import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Users, CalendarCheck, Banknote, Plus, Edit2, Trash2, Save, X, CheckCircle2, Printer, FileText
} from 'lucide-react'
import Modal from '../components/ui/Modal'
import ConfirmDialog from '../components/ui/ConfirmDialog'
import { useToast } from '../components/ui/Toast'
import { usePermissions } from '../hooks/usePermissions'
import { formatMoney } from '../services/currency'
import { callApi } from '../lib/api-client'
import { escapeHtml, localDateStr } from '../lib/utils'
import { abrirDocumento } from '../lib/print'

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
  conceptos?: NominaConcepto[]
}
interface NominaConcepto {
  id: number; nomina_id: number; nombre: string; tipo: 'asignacion' | 'deduccion'; monto: number; orden: number
}
interface ConceptoCatalogo {
  id: number; nombre: string; tipo: 'asignacion' | 'deduccion'; monto_default: number; activo: number
}
interface GrupoEmpleado {
  id: number; nombre: string; descripcion: string | null; activo: number; miembros: number; conceptos: number
  empleado_ids: number[]
  conceptos_detalle: { concepto_id: number; monto: number; nombre: string; tipo: 'asignacion' | 'deduccion'; monto_default: number }[]
}
interface AsistenciaHistorial {
  id: number; fecha: string; estado: string; notas: string | null
  empleado_id: number; empleado_nombre: string; empleado_cargo: string | null
}

const ESTADOS_ASISTENCIA = ['presente', 'ausente', 'tarde', 'permiso', 'descanso'] as const
const HOY = () => localDateStr()

export default function RrhhPage() {
  const { t } = useTranslation()
  const toast = useToast()
  const { has } = usePermissions()
  const [tab, setTab] = useState<'empleados' | 'asistencia' | 'nomina' | 'grupos' | 'conceptos'>('empleados')

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
  const [tipoPago, setTipoPago] = useState<'semanal' | 'quincenal' | 'mensual'>('mensual')
  const [salarioBaseActivo, setSalarioBaseActivo] = useState(true)
  const [bonosGlobales, setBonosGlobales] = useState('')
  const [deduccionesGlobales, setDeduccionesGlobales] = useState('')
  const [bonos, setBonos] = useState<Record<number, string>>({})
  const [deducciones, setDeducciones] = useState<Record<number, string>>({})
  const [conceptosNominaId, setConceptosNominaId] = useState<number | null>(null)
  const [conceptoForm, setConceptoForm] = useState<{ nombre: string; tipo: 'asignacion' | 'deduccion'; monto: string }>({
    nombre: '', tipo: 'asignacion', monto: '',
  })

  // Catálogo global de conceptos (capa 3)
  const [conceptos, setConceptos] = useState<ConceptoCatalogo[]>([])
  const [conceptoCatForm, setConceptoCatForm] = useState<{ id: number | null; nombre: string; tipo: 'asignacion' | 'deduccion'; monto_default: string }>({
    id: null, nombre: '', tipo: 'asignacion', monto_default: '',
  })

  // Grupos de empleados (capa 2)
  const [grupos, setGrupos] = useState<GrupoEmpleado[]>([])
  const [grupoForm, setGrupoForm] = useState<{ id: number | null; nombre: string; descripcion: string }>({ id: null, nombre: '', descripcion: '' })
  const [grupoSel, setGrupoSel] = useState<number | null>(null)
  const [grupoMiembrosSel, setGrupoMiembrosSel] = useState<number[]>([])
  const [grupoConceptosSel, setGrupoConceptosSel] = useState<{ concepto_id: number; monto: string }[]>([])

  // Generar nómina por grupo
  const [nominaGrupoId, setNominaGrupoId] = useState<string>('')

  // Históricos
  const [histAsistencia, setHistAsistencia] = useState<AsistenciaHistorial[]>([])
  const [histDesde, setHistDesde] = useState('')
  const [histHasta, setHistHasta] = useState('')
  const [histEmpleadoId, setHistEmpleadoId] = useState<string>('')
  const [nominaHistEmpleado, setNominaHistEmpleado] = useState<{ nominas: Nomina[]; totales: { bruto: number; asignaciones: number; deducciones: number; neto: number } } | null>(null)

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

  const loadConceptos = async () => {
    try {
      const list = await callApi<ConceptoCatalogo[]>('rrhh:conceptos-list', { incluirInactivos: true })
      setConceptos(Array.isArray(list) ? list : [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const loadGrupos = async () => {
    try {
      const list = await callApi<GrupoEmpleado[]>('rrhh:grupos-list', {})
      setGrupos(Array.isArray(list) ? list : [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const loadHistorialAsistencia = async () => {
    try {
      const list = await callApi<AsistenciaHistorial[]>('rrhh:asistencia-historial', {
        empleado_id: histEmpleadoId ? Number(histEmpleadoId) : undefined,
        desde: histDesde || undefined,
        hasta: histHasta || undefined,
      })
      setHistAsistencia(Array.isArray(list) ? list : [])
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const loadHistorialNomina = async (empleadoId: string) => {
    if (!empleadoId) { setNominaHistEmpleado(null); return }
    try {
      const res = await callApi<{ nominas: Nomina[]; totales: any }>('rrhh:nomina-por-empleado', { empleado_id: Number(empleadoId) })
      setNominaHistEmpleado({ nominas: res.nominas || [], totales: res.totales || { bruto: 0, asignaciones: 0, deducciones: 0, neto: 0 } })
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  useEffect(() => {
    if (tab === 'empleados') loadEmpleados()
    if (tab === 'asistencia') { loadAsistencia(); loadEmpleados(); loadHistorialAsistencia() }
    if (tab === 'nomina') { loadNominas(); loadEmpleados(); loadGrupos() }
    if (tab === 'grupos') { loadGrupos(); loadEmpleados(); loadConceptos() }
    if (tab === 'conceptos') loadConceptos()
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
    const porGrupo = nominaGrupoId !== ''
    const parseMap = (m: Record<number, string>) =>
      Object.fromEntries(Object.entries(m).map(([k, v]) => [Number(k), parseFloat(v) || 0]))
    try {
      const res = await callApi<{ success: boolean; nominas: Nomina[]; error?: string }>('rrhh:nomina-generar', {
        periodo_inicio: nominaDesde,
        periodo_fin: nominaHasta,
        tipo_pago: tipoPago,
        salario_base_activo: salarioBaseActivo,
        grupo_id: porGrupo ? Number(nominaGrupoId) : undefined,
        // Con grupo, los conceptos vienen del grupo: no enviar globales ni mapas.
        bonos_globales: porGrupo || bonosGlobales.trim() === '' ? undefined : parseFloat(bonosGlobales) || 0,
        deducciones_globales: porGrupo || deduccionesGlobales.trim() === '' ? undefined : parseFloat(deduccionesGlobales) || 0,
        bonos: porGrupo ? {} : parseMap(bonos),
        deducciones: porGrupo ? {} : parseMap(deducciones),
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

  const openConceptos = async (nominaId: number) => {
    setConceptosNominaId(nominaId)
    setConceptoForm({ nombre: '', tipo: 'asignacion', monto: '' })
  }

  const agregarConcepto = async () => {
    if (conceptosNominaId === null) return
    if (!conceptoForm.nombre.trim()) { toast.error(t('rrhh.conceptNameRequired')); return }
    const monto = parseFloat(conceptoForm.monto) || 0
    if (monto < 0) { toast.error(t('rrhh.conceptAmountInvalid')); return }
    try {
      await callApi('rrhh:nomina-concepto-add', {
        nomina_id: conceptosNominaId,
        nombre: conceptoForm.nombre.trim(),
        tipo: conceptoForm.tipo,
        monto,
      })
      setConceptoForm({ nombre: '', tipo: conceptoForm.tipo, monto: '' })
      await loadNominas()
      toast.success(t('common.save'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const eliminarConcepto = async (id: number) => {
    try {
      await callApi('rrhh:nomina-concepto-delete', { id })
      await loadNominas()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const editConceptoCatalogo = (c: ConceptoCatalogo) =>
    setConceptoCatForm({ id: c.id, nombre: c.nombre, tipo: c.tipo, monto_default: String(c.monto_default) })

  const saveConceptoCatalogo = async () => {
    if (!conceptoCatForm.nombre.trim()) { toast.error(t('rrhh.conceptNameRequired')); return }
    const monto = parseFloat(conceptoCatForm.monto_default) || 0
    if (monto < 0) { toast.error(t('rrhh.conceptAmountInvalid')); return }
    try {
      await callApi('rrhh:concepto-save', {
        id: conceptoCatForm.id ?? undefined,
        nombre: conceptoCatForm.nombre.trim(),
        tipo: conceptoCatForm.tipo,
        monto_default: monto,
      })
      setConceptoCatForm({ id: null, nombre: '', tipo: 'asignacion', monto_default: '' })
      await loadConceptos()
      toast.success(t('common.save'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const deleteConceptoCatalogo = async (id: number) => {
    try {
      const res = await callApi<{ desactivado?: boolean }>('rrhh:concepto-delete', { id })
      if (res?.desactivado) toast.info(t('rrhh.conceptDeactivated'))
      await loadConceptos()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const saveGrupo = async () => {
    if (!grupoForm.nombre.trim()) { toast.error(t('rrhh.groupNameRequired')); return }
    try {
      await callApi('rrhh:grupo-save', {
        id: grupoForm.id ?? undefined,
        nombre: grupoForm.nombre.trim(),
        descripcion: grupoForm.descripcion.trim() || undefined,
      })
      setGrupoForm({ id: null, nombre: '', descripcion: '' })
      await loadGrupos()
      toast.success(t('common.save'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const deleteGrupo = async (id: number) => {
    try {
      await callApi('rrhh:grupo-delete', { id })
      if (grupoSel === id) setGrupoSel(null)
      await loadGrupos()
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const seleccionarGrupo = (g: GrupoEmpleado) => {
    setGrupoSel(g.id)
    setGrupoForm({ id: g.id, nombre: g.nombre, descripcion: g.descripcion || '' })
    setGrupoMiembrosSel(g.empleado_ids)
    setGrupoConceptosSel(g.conceptos_detalle.map((c) => ({ concepto_id: c.concepto_id, monto: String(c.monto) })))
  }

  const toggleMiembro = (id: number) =>
    setGrupoMiembrosSel((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))

  const toggleGrupoConcepto = (conceptoId: number) =>
    setGrupoConceptosSel((prev) =>
      prev.some((c) => c.concepto_id === conceptoId)
        ? prev.filter((c) => c.concepto_id !== conceptoId)
        : [...prev, { concepto_id: conceptoId, monto: '' }],
    )

  const guardarGrupoConfig = async () => {
    if (grupoSel === null) return
    try {
      await callApi('rrhh:grupo-miembros-set', { grupo_id: grupoSel, empleado_ids: grupoMiembrosSel })
      await callApi('rrhh:grupo-conceptos-set', {
        grupo_id: grupoSel,
        conceptos: grupoConceptosSel.map((c) => ({
          concepto_id: c.concepto_id,
          monto: c.monto.trim() === '' ? undefined : parseFloat(c.monto) || 0,
        })),
      })
      await loadGrupos()
      toast.success(t('common.save'))
    } catch (err: any) {
      toast.error(err?.message || t('common.error'))
    }
  }

  const imprimirRecibos = async (solo?: Nomina) => {
    let bizName = '', bizRif = '', bizAddr = '', bizPhone = ''
    try {
      const cfg = await callApi<any>('print:config')
      if (cfg) {
        bizName = cfg.razon_social || ''
        bizRif = cfg.rif || ''
        bizAddr = cfg.direccion || ''
        bizPhone = cfg.telefono || ''
      }
    } catch {
      try {
        const cfg = await callApi<any[]>('config:get')
        const get = (k: string) => cfg.find((c: any) => c.clave === k)?.valor || ''
        bizName = get('nombre_negocio'); bizAddr = get('direccion'); bizPhone = get('telefono')
      } catch {}
    }
    const header = `
      <div style="text-align:center;margin-bottom:10px">
        <div style="font-weight:bold;font-size:14px">${escapeHtml(bizName || 'TOG Admin')}</div>
        ${bizRif ? `<div style="font-size:10px;color:#555">RIF: ${escapeHtml(bizRif)}</div>` : ''}
        ${bizAddr ? `<div style="font-size:10px;color:#555">${escapeHtml(bizAddr)}</div>` : ''}
        ${bizPhone ? `<div style="font-size:10px;color:#555">Tel: ${escapeHtml(bizPhone)}</div>` : ''}
      </div>`
    const conceptBlock = (n: Nomina) => {
      if (!n.conceptos || n.conceptos.length === 0) return ''
      const rows = n.conceptos.map((c) =>
        `<div style="display:flex;justify-content:space-between;font-size:11px"><span>${escapeHtml(c.nombre)}</span><span>${c.tipo === 'asignacion' ? '+' : '-'}${escapeHtml(formatMoney(c.monto))}</span></div>`
      ).join('')
      return `<div style="margin:4px 0">${rows}</div>`
    }
    const lista = solo ? [solo] : nominas
    if (lista.length === 0) return
    const recibos = lista.map((n) => `
      <div style="page-break-after:always;font-family:'Segoe UI',Arial,sans-serif;font-size:12px;width:640px;margin:0 auto 16px;padding:16px;border:1px solid #d1d5db;border-radius:8px">
        ${header}
        <h2 style="text-align:center;margin:4px 0;font-size:14px">${t('rrhh.payrollReceipt')}</h2>
        <div style="text-align:center;font-size:10px;color:#666">${escapeHtml(n.periodo_inicio)} → ${escapeHtml(n.periodo_fin)}</div>
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <div><strong>${escapeHtml(n.empleado_nombre)}</strong></div>
        ${n.empleado_documento ? `<div style="font-size:11px">${escapeHtml(n.empleado_documento)}</div>` : ''}
        ${n.empleado_cargo ? `<div style="font-size:11px">${escapeHtml(n.empleado_cargo)}</div>` : ''}
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.baseSalary')}</span><span>${formatMoney(n.salario_base)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.daysWorked')}</span><span>${n.dias_trabajados}</span></div>
        ${conceptBlock(n)}
        ${(n.conceptos && n.conceptos.length > 0) ? `<div style="display:flex;justify-content:space-between;font-size:11px"><span>${t('rrhh.assignments')}</span><span>+${formatMoney(n.bonos)}</span></div>
        <div style="display:flex;justify-content:space-between;font-size:11px"><span>${t('rrhh.deductions')}</span><span>-${formatMoney(n.deducciones)}</span></div>` : `
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.bonuses')}</span><span>${formatMoney(n.bonos)}</span></div>
        <div style="display:flex;justify-content:space-between"><span>${t('rrhh.deductions')}</span><span>-${formatMoney(n.deducciones)}</span></div>`}
        <hr style="border:none;border-top:1px dashed #000;margin:8px 0">
        <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:13px"><span>${t('rrhh.totalToPay')}</span><span>${formatMoney(n.total_pagar)}</span></div>
        <div style="text-align:center;font-size:10px;color:#666;margin-top:20px">${t('rrhh.receiptSignature')}</div>
      </div>
    `).join('')
    abrirDocumento({
      titulo: t('rrhh.payrollReceipt'),
      ancho: 900,
      alto: 900,
      cuerpo: recibos,
    })
  }

  const imprimirAsistencias = async () => {
    if (histAsistencia.length === 0) { toast.info(t('rrhh.noRecords')); return }
    let bizName = '', bizRif = '', bizAddr = '', bizPhone = ''
    try {
      const cfg = await callApi<any>('print:config')
      if (cfg) { bizName = cfg.razon_social || ''; bizRif = cfg.rif || ''; bizAddr = cfg.direccion || ''; bizPhone = cfg.telefono || '' }
    } catch {
      try {
        const cfg = await callApi<any[]>('config:get')
        const get = (k: string) => cfg.find((c: any) => c.clave === k)?.valor || ''
        bizName = get('nombre_negocio'); bizAddr = get('direccion'); bizPhone = get('telefono')
      } catch {}
    }
    const filas = histAsistencia.map((h) => `<tr>
      <td>${escapeHtml(h.fecha)}</td>
      <td>${escapeHtml(h.empleado_nombre)}</td>
      <td>${escapeHtml(h.empleado_cargo || '—')}</td>
      <td>${escapeHtml(t(`rrhh.attendance.${h.estado}`))}</td>
      <td>${escapeHtml(h.notas || '')}</td>
    </tr>`).join('')
    const rango = `${histDesde || '—'} → ${histHasta || '—'}`
    abrirDocumento({
      titulo: t('rrhh.attendanceHistory'),
      ancho: 900,
      alto: 900,
      estilos: `
      @page{size:A4;margin:14mm}
      *{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Segoe UI',Arial,sans-serif;color:#111;font-size:12px}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #111;padding-bottom:10px;margin-bottom:14px}
      .biz{font-size:16px;font-weight:700;text-transform:uppercase}
      .muted{font-size:10px;color:#555}
      .doc{font-size:15px;font-weight:700;text-transform:uppercase}
      table{width:100%;border-collapse:collapse;margin-top:10px}
      th{font-size:9px;text-transform:uppercase;color:#374151;border-bottom:2px solid #111;padding:6px 5px;text-align:left}
      td{padding:5px;border-bottom:1px solid #e5e7eb;font-size:11px}
      .footer{margin-top:18px;text-align:center;font-size:9px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:8px}
      `,
      cuerpo: `
      <div class="head">
        <div>
          <div class="biz">${escapeHtml(bizName || 'TOG Admin')}</div>
          ${bizRif ? `<div class="muted">RIF: ${escapeHtml(bizRif)}</div>` : ''}
          ${bizAddr ? `<div class="muted">${escapeHtml(bizAddr)}</div>` : ''}
          ${bizPhone ? `<div class="muted">Tel: ${escapeHtml(bizPhone)}</div>` : ''}
        </div>
        <div class="doc">${escapeHtml(t('rrhh.attendanceHistory'))}</div>
      </div>
      <div class="muted">${escapeHtml(t('rrhh.period'))}: ${escapeHtml(rango)} · ${histAsistencia.length}</div>
      <table><thead><tr>
        <th>${escapeHtml(t('rrhh.date'))}</th>
        <th>${escapeHtml(t('rrhh.employee'))}</th>
        <th>${escapeHtml(t('rrhh.position'))}</th>
        <th>${escapeHtml(t('rrhh.attendanceStatus'))}</th>
        <th>${escapeHtml(t('common.notes'))}</th>
      </tr></thead><tbody>${filas}</tbody></table>
      <div class="footer">${escapeHtml(bizName || 'TOG Admin')} · ${escapeHtml(new Date().toLocaleString())}</div>
      `,
    })
  }

  const tabs = [
    { id: 'empleados' as const, icon: Users, label: t('rrhh.tabEmployees') },
    { id: 'asistencia' as const, icon: CalendarCheck, label: t('rrhh.tabAttendance') },
    { id: 'grupos' as const, icon: Users, label: t('rrhh.tabGroups') },
    { id: 'conceptos' as const, icon: FileText, label: t('rrhh.tabConcepts') },
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

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{t('rrhh.attendanceHistory')}</p>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.employee')}</label>
                <select value={histEmpleadoId} onChange={(e) => setHistEmpleadoId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="">{t('rrhh.allEmployees')}</option>
                  {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.periodFrom')}</label>
                <input type="date" value={histDesde} onChange={(e) => setHistDesde(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.periodTo')}</label>
                <input type="date" value={histHasta} onChange={(e) => setHistHasta(e.target.value)} className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <button onClick={loadHistorialAsistencia} className="px-4 py-2 text-sm font-medium text-white bg-gray-700 rounded-lg hover:bg-gray-800">{t('rrhh.applyFilter')}</button>
              <button onClick={imprimirAsistencias} title={t('common.print')}
                className="p-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
                <Printer className="w-4 h-4" />
              </button>
            </div>
            <div className="border border-gray-100 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.employee')}</th>
                    <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.date')}</th>
                    <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.attendanceStatus')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {histAsistencia.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-gray-400">{t('rrhh.noRecords')}</td></tr>
                  ) : histAsistencia.map((h) => (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{h.empleado_nombre}</td>
                      <td className="px-4 py-2 text-gray-600">{h.fecha}</td>
                      <td className="px-4 py-2 text-center text-gray-700">{t(`rrhh.attendance.${h.estado}`)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
              </div>
              <div className="flex flex-wrap items-end gap-3 pt-1 border-t border-gray-100">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.group')}</label>
                  <select value={nominaGrupoId} onChange={(e) => setNominaGrupoId(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="">{t('rrhh.allEmployees')}</option>
                    {grupos.map((g) => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.paymentType')}</label>
                  <select value={tipoPago} onChange={(e) => setTipoPago(e.target.value as 'semanal' | 'quincenal' | 'mensual')}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                    <option value="semanal">{t('rrhh.paymentTypeWeekly')}</option>
                    <option value="quincenal">{t('rrhh.paymentTypeBiweekly')}</option>
                    <option value="mensual">{t('rrhh.paymentTypeMonthly')}</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white cursor-pointer select-none">
                  <input type="checkbox" checked={salarioBaseActivo} onChange={(e) => setSalarioBaseActivo(e.target.checked)}
                    className="w-4 h-4 accent-blue-600" />
                  {t('rrhh.baseSalaryActive')}
                </label>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.globalBonuses')}</label>
                  <input type="number" step="0.01" min="0" value={bonosGlobales}
                    onChange={(e) => setBonosGlobales(e.target.value)} placeholder="0.00"
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-right text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.globalDeductions')}</label>
                  <input type="number" step="0.01" min="0" value={deduccionesGlobales}
                    onChange={(e) => setDeduccionesGlobales(e.target.value)} placeholder="0.00"
                    className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-right text-sm" />
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-3">
                {nominas.some((n) => n.estado === 'pendiente') && (
                  <>
                    <button onClick={pagarNomina}
                      className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-lg hover:bg-green-700 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> {t('rrhh.markPaid')}
                    </button>
                    <button onClick={() => imprimirRecibos()} title={t('common.print')}
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
                      <div className="flex items-center justify-center gap-1">
                        <button onClick={() => imprimirRecibos(n)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={t('common.print')}>
                          <Printer className="w-4 h-4 text-gray-500" />
                        </button>
                        {has('rrhh_nomina') && n.estado === 'pendiente' && (
                          <button onClick={() => openConceptos(n.id)} className="p-1.5 hover:bg-blue-50 rounded-lg" title={t('rrhh.conceptsTitle')}>
                            <FileText className="w-4 h-4 text-blue-500" />
                          </button>
                        )}
                        <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${
                          n.estado === 'pagada' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {n.estado === 'pagada' ? t('rrhh.payrollPaidStatus') : t('rrhh.payrollPendingStatus')}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-sm font-semibold text-gray-700">{t('rrhh.payrollHistoryByEmployee')}</p>
            <select value={histEmpleadoId} onChange={(e) => { setHistEmpleadoId(e.target.value); loadHistorialNomina(e.target.value) }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
              <option value="">{t('rrhh.selectEmployee')}</option>
              {empleados.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
            {nominaHistEmpleado && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">{t('rrhh.baseSalary')}</p><p className="font-semibold">{formatMoney(nominaHistEmpleado.totales.bruto)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">{t('rrhh.assignments')}</p><p className="font-semibold text-green-600">+{formatMoney(nominaHistEmpleado.totales.asignaciones)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">{t('rrhh.deductions')}</p><p className="font-semibold text-red-600">-{formatMoney(nominaHistEmpleado.totales.deducciones)}</p></div>
                  <div className="bg-gray-50 rounded-lg p-2"><p className="text-xs text-gray-500">{t('rrhh.totalToPay')}</p><p className="font-bold">{formatMoney(nominaHistEmpleado.totales.neto)}</p></div>
                </div>
                <div className="border border-gray-100 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50"><tr>
                      <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.period')}</th>
                      <th className="text-right px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.totalToPay')}</th>
                      <th className="text-center px-4 py-2 text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {nominaHistEmpleado.nominas.map((n) => (
                        <tr key={n.id}>
                          <td className="px-4 py-2 text-gray-600">{n.periodo_inicio} → {n.periodo_fin}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatMoney(n.total_pagar)}</td>
                          <td className="px-4 py-2 text-center text-xs text-gray-500">{n.estado}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'grupos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.groupName')}</label>
                <input value={grupoForm.nombre} onChange={(e) => setGrupoForm({ ...grupoForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.groupDescription')}</label>
                <input value={grupoForm.descripcion} onChange={(e) => setGrupoForm({ ...grupoForm, descripcion: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <button onClick={saveGrupo} disabled={!has('rrhh_edit')}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                <Save className="w-4 h-4" /> {grupoForm.id ? t('common.save') : t('rrhh.newGroup')}
              </button>
              {grupoForm.id && (
                <button onClick={() => { setGrupoForm({ id: null, nombre: '', descripcion: '' }); setGrupoSel(null) }}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.groupName')}</th>
                    <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.groupMembers')}</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {grupos.length === 0 ? (
                    <tr><td colSpan={3} className="text-center py-8 text-gray-400">{t('rrhh.noGroups')}</td></tr>
                  ) : grupos.map((g) => (
                    <tr key={g.id} onClick={() => seleccionarGrupo(g)} className={`cursor-pointer hover:bg-gray-50 ${grupoSel === g.id ? 'bg-blue-50' : ''}`}>
                      <td className="px-3 py-2">
                        <p className="font-medium text-gray-900">{g.nombre}</p>
                        {g.descripcion && <p className="text-xs text-gray-400">{g.descripcion}</p>}
                      </td>
                      <td className="px-3 py-2 text-center text-gray-600">{g.miembros}</td>
                      <td className="px-2 py-2 text-right">
                        {has('rrhh_edit') && (
                          <button onClick={(e) => { e.stopPropagation(); deleteGrupo(g.id) }} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('common.delete')}>
                            <Trash2 className="w-4 h-4 text-red-400" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-4 space-y-4">
              {grupoSel === null ? (
                <p className="text-center text-gray-400 py-10 text-sm">{t('rrhh.selectGroupHint')}</p>
              ) : (
                <>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('rrhh.groupMembers')}</p>
                    <div className="flex flex-wrap gap-2">
                      {empleados.map((e) => (
                        <button key={e.id} onClick={() => toggleMiembro(e.id)} disabled={!has('rrhh_edit')}
                          className={`px-3 py-1.5 text-xs rounded-full border ${grupoMiembrosSel.includes(e.id) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                          {e.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase mb-2">{t('rrhh.groupConcepts')}</p>
                    <div className="space-y-2">
                      {conceptos.length === 0 ? (
                        <p className="text-sm text-gray-400">{t('rrhh.noConceptsCatalog')}</p>
                      ) : conceptos.map((c) => {
                        const sel = grupoConceptosSel.find((x) => x.concepto_id === c.id)
                        return (
                          <div key={c.id} className="flex items-center gap-3">
                            <label className="flex items-center gap-2 flex-1 text-sm">
                              <input type="checkbox" checked={!!sel} onChange={() => toggleGrupoConcepto(c.id)} className="w-4 h-4 accent-blue-600" />
                              <span>{c.nombre}</span>
                              <span className={`text-xs ${c.tipo === 'asignacion' ? 'text-green-600' : 'text-red-500'}`}>{t(`rrhh.conceptType.${c.tipo}`)}</span>
                            </label>
                            {sel && (
                              <input type="number" step="0.01" min="0" value={sel.monto}
                                onChange={(e) => setGrupoConceptosSel((prev) => prev.map((x) => (x.concepto_id === c.id ? { ...x, monto: e.target.value } : x)))}
                                placeholder={String(c.monto_default)}
                                className="w-28 px-2 py-1 border border-gray-200 rounded-lg text-right text-sm" />
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {has('rrhh_nomina') && (
                    <button onClick={guardarGrupoConfig}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                      <Save className="w-4 h-4" /> {t('common.save')}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'conceptos' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-48">
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.conceptName')}</label>
                <input value={conceptoCatForm.nombre} onChange={(e) => setConceptoCatForm({ ...conceptoCatForm, nombre: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.conceptTypeLabel')}</label>
                <select value={conceptoCatForm.tipo} onChange={(e) => setConceptoCatForm({ ...conceptoCatForm, tipo: e.target.value as 'asignacion' | 'deduccion' })}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white">
                  <option value="asignacion">{t('rrhh.conceptType.asignacion')}</option>
                  <option value="deduccion">{t('rrhh.conceptType.deduccion')}</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">{t('rrhh.conceptDefaultAmount')}</label>
                <input type="number" step="0.01" min="0" value={conceptoCatForm.monto_default}
                  onChange={(e) => setConceptoCatForm({ ...conceptoCatForm, monto_default: e.target.value })} placeholder="0.00"
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-right text-sm" />
              </div>
              <button onClick={saveConceptoCatalogo} disabled={!has('rrhh_nomina')}
                className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center gap-2">
                <Plus className="w-4 h-4" /> {conceptoCatForm.id ? t('common.save') : t('common.add')}
              </button>
              {conceptoCatForm.id && (
                <button onClick={() => setConceptoCatForm({ id: null, nombre: '', tipo: 'asignacion', monto_default: '' })}
                  className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">{t('common.cancel')}</button>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.name')}</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.conceptTypeLabel')}</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('rrhh.conceptDefaultAmount')}</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-gray-500 uppercase">{t('common.status')}</th>
                  <th className="w-24" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {conceptos.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400">{t('rrhh.noConceptsCatalog')}</td></tr>
                ) : conceptos.map((c) => (
                  <tr key={c.id} className={`hover:bg-gray-50 ${!c.activo ? 'opacity-50' : ''}`}>
                    <td className="px-4 py-3 font-medium text-gray-900">{c.nombre}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium ${c.tipo === 'asignacion' ? 'text-green-600' : 'text-red-500'}`}>{t(`rrhh.conceptType.${c.tipo}`)}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{formatMoney(c.monto_default)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex text-xs font-medium px-2 py-1 rounded-full ${c.activo ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {c.activo ? t('common.active') : t('common.inactive')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {has('rrhh_nomina') && (
                        <div className="flex justify-end gap-1">
                          <button onClick={() => editConceptoCatalogo(c)} className="p-1.5 hover:bg-blue-50 rounded-lg" title={t('common.edit')}>
                            <Edit2 className="w-4 h-4 text-blue-500" />
                          </button>
                          {c.activo ? (
                            <button onClick={() => deleteConceptoCatalogo(c.id)} className="p-1.5 hover:bg-red-50 rounded-lg" title={t('common.delete')}>
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          ) : null}
                        </div>
                      )}
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

      <Modal open={conceptosNominaId !== null} onClose={() => setConceptosNominaId(null)}
        title={t('rrhh.conceptsTitle')}>
        {conceptosNominaId !== null && (() => {
          const n = nominas.find((x) => x.id === conceptosNominaId)
          if (!n) return null
          return (
            <div className="space-y-3">
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="font-medium text-gray-900">{n.empleado_nombre}</p>
                <p className="text-xs text-gray-500">{n.periodo_inicio} → {n.periodo_fin}</p>
                <p className="text-xs text-gray-500">{t('rrhh.baseSalary')}: <strong>{formatMoney(n.salario_base)}</strong></p>
              </div>

              {n.estado === 'pagada' && (
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">{t('rrhh.conceptsLockedPaid')}</p>
              )}

              <div className="space-y-1 max-h-64 overflow-y-auto">
                {(n.conceptos || []).length === 0 ? (
                  <p className="text-center text-gray-400 py-4 text-sm">{t('rrhh.noConcepts')}</p>
                ) : (n.conceptos || []).map((c) => (
                  <div key={c.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-3 py-2">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{c.nombre}</p>
                      <p className="text-xs text-gray-500">{t(`rrhh.conceptType.${c.tipo}`)}</p>
                    </div>
                    <p className={`text-sm font-semibold mr-3 ${c.tipo === 'asignacion' ? 'text-green-600' : 'text-red-600'}`}>
                      {c.tipo === 'asignacion' ? '+' : '-'}{formatMoney(c.monto)}
                    </p>
                    {n.estado === 'pendiente' && (
                      <button onClick={() => eliminarConcepto(c.id)} className="p-1 hover:bg-red-50 rounded" title={t('common.delete')}>
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {n.estado === 'pendiente' && (
                <div className="border-t border-gray-200 pt-3 space-y-2">
                  <p className="text-xs font-medium text-gray-700">{t('rrhh.addConcept')}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={conceptoForm.nombre}
                      onChange={(e) => setConceptoForm({ ...conceptoForm, nombre: e.target.value })}
                      placeholder={t('rrhh.conceptName')}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <select value={conceptoForm.tipo}
                      onChange={(e) => setConceptoForm({ ...conceptoForm, tipo: e.target.value as 'asignacion' | 'deduccion' })}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm">
                      <option value="asignacion">{t('rrhh.conceptType.asignacion')}</option>
                      <option value="deduccion">{t('rrhh.conceptType.deduccion')}</option>
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" min="0" value={conceptoForm.monto}
                      onChange={(e) => setConceptoForm({ ...conceptoForm, monto: e.target.value })}
                      placeholder="0.00"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    <button onClick={agregarConcepto}
                      className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 flex items-center gap-2">
                      <Plus className="w-4 h-4" /> {t('common.add')}
                    </button>
                  </div>
                </div>
              )}

              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <div className="flex justify-between"><span>{t('rrhh.baseSalary')}</span><span>{formatMoney(n.salario_base)}</span></div>
                <div className="flex justify-between text-green-600"><span>{t('rrhh.assignments')}</span><span>+{formatMoney(n.bonos)}</span></div>
                <div className="flex justify-between text-red-600"><span>{t('rrhh.deductions')}</span><span>-{formatMoney(n.deducciones)}</span></div>
                <hr className="my-2" />
                <div className="flex justify-between font-bold"><span>{t('rrhh.totalToPay')}</span><span>{formatMoney(n.total_pagar)}</span></div>
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
