import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

type DatabaseLike = {
  prepare(sql: string): { get(...args: unknown[]): unknown; all(...args: unknown[]): unknown; run(...args: unknown[]): unknown }
}

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('administracion')) {
    return { success: false, error: 'El módulo Administración no está activo en la licencia' }
  }
  return null
}

const DIAS_NOMINA = 30

const NOMINA_SELECT = `
  SELECT n.*, e.nombre as empleado_nombre, e.documento as empleado_documento, e.cargo as empleado_cargo,
    e.experiencia, e.anos_servicio, e.nivel_academico,
    (SELECT json_group_array(json_object('id', c.id, 'nomina_id', c.nomina_id, 'nombre', c.nombre, 'tipo', c.tipo, 'monto', c.monto, 'orden', c.orden))
      FROM nomina_conceptos c WHERE c.nomina_id = n.id) as conceptos_json
  FROM nominas n JOIN empleados e ON e.id = n.empleado_id
`

function listarNominas(db: DatabaseLike, periodo_inicio?: string, periodo_fin?: string) {
  const rows = periodo_inicio && periodo_fin
    ? db.prepare(`${NOMINA_SELECT} WHERE n.periodo_inicio = ? AND n.periodo_fin = ? ORDER BY e.nombre`).all(periodo_inicio, periodo_fin) as any[]
    : db.prepare(`${NOMINA_SELECT} ORDER BY n.periodo_inicio DESC, e.nombre LIMIT 200`).all() as any[]
  return rows.map((row) => {
    let conceptos: any[] = []
    try { conceptos = JSON.parse(row.conceptos_json || '[]') } catch { conceptos = [] }
    const { conceptos_json: _ignored, ...rest } = row
    return { ...rest, conceptos }
  })
}

type NominaInput = {
  periodo_inicio: string
  periodo_fin: string
  tipo_pago?: 'semanal' | 'quincenal' | 'mensual'
  salario_base_activo?: boolean
  bonos_globales?: number
  deducciones_globales?: number
  bonos?: Record<number, number>
  deducciones?: Record<number, number>
  grupo_id?: number
}

type ConceptoNomina = { nombre: string; tipo: 'asignacion' | 'deduccion'; monto: number; orden: number }

type FilaNomina = {
  empleado_id: number
  empleado_nombre: string
  empleado_documento: string | null
  empleado_cargo: string | null
  salario_base: number
  dias_trabajados: number
  bonos: number
  deducciones: number
  total_pagar: number
  conceptos: ConceptoNomina[]
}

const FACTOR_TIPO_PAGO: Record<string, number> = { mensual: 1, quincenal: 0.5, semanal: 0.25 }

/**
 * Calcula las filas de una nómina SIN escribir en la base (dry-run).
 * `rrhh:nomina-preview` las muestra para confirmar y `rrhh:nomina-generar` persiste
 * exactamente estos mismos valores, así que la vista previa nunca puede diferir de
 * la nómina que se guarda.
 */
function calcularFilasNomina(db: DatabaseLike, data: NominaInput): { filas: FilaNomina[]; error?: string } {
  // Con grupo: la nómina solo incluye los miembros del grupo y se le aplican
  // los conceptos asignados al grupo (capa 3). Sin grupo: todos los activos.
  const empleados = (data.grupo_id
    ? db.prepare(`SELECT e.id, e.nombre, e.documento, e.cargo, e.salario_mensual
        FROM empleados e JOIN empleado_grupo_miembros m ON m.empleado_id = e.id
        WHERE m.grupo_id = ? AND e.activo = 1 ORDER BY e.nombre`).all(data.grupo_id)
    : db.prepare('SELECT id, nombre, documento, cargo, salario_mensual FROM empleados WHERE activo = 1 ORDER BY nombre').all()) as any[]
  if (empleados.length === 0) return { filas: [], error: 'No hay empleados activos' }

  const grupoConceptos = (data.grupo_id
    ? db.prepare(`SELECT gc.monto, c.nombre, c.tipo, c.monto_default
        FROM grupo_conceptos gc JOIN conceptos_catalogo c ON c.id = gc.concepto_id
        WHERE gc.grupo_id = ? AND c.activo = 1 ORDER BY c.tipo, c.nombre`).all(data.grupo_id)
    : []) as any[]

  const factor = (data.tipo_pago && FACTOR_TIPO_PAGO[data.tipo_pago]) || 1
  const bonosGlobales = data.bonos_globales !== undefined ? data.bonos_globales : 0
  const deduccionesGlobales = data.deducciones_globales !== undefined ? data.deducciones_globales : 0
  const contarDias = db.prepare(`
    SELECT COUNT(*) as dias FROM asistencia
    WHERE empleado_id = ? AND fecha BETWEEN ? AND ? AND estado IN ('presente', 'tarde')
  `)

  const filas = empleados.map((e) => {
    const dias = contarDias.get(e.id, data.periodo_inicio, data.periodo_fin) as any
    const dias_trabajados = dias?.dias || 0
    const salario_base = data.salario_base_activo && e.salario_mensual
      ? Number(e.salario_mensual) * factor * (dias_trabajados / DIAS_NOMINA)
      : 0
    let bonos = (data.bonos?.[e.id] || 0) + bonosGlobales
    let deducciones = (data.deducciones?.[e.id] || 0) + deduccionesGlobales
    const conceptos: ConceptoNomina[] = grupoConceptos.map((c, i) => ({
      nombre: c.nombre as string,
      tipo: c.tipo as 'asignacion' | 'deduccion',
      monto: c.monto !== null && c.monto !== undefined ? Number(c.monto) : (Number(c.monto_default) || 0),
      orden: i + 1,
    }))
    if (data.grupo_id) {
      // Capa 3: los conceptos del grupo reemplazan a los globales y a los mapas por empleado.
      bonos = conceptos.filter((c) => c.tipo === 'asignacion').reduce((s, c) => s + c.monto, 0)
      deducciones = conceptos.filter((c) => c.tipo !== 'asignacion').reduce((s, c) => s + c.monto, 0)
    }
    return {
      empleado_id: e.id as number,
      empleado_nombre: e.nombre as string,
      empleado_documento: (e.documento ?? null) as string | null,
      empleado_cargo: (e.cargo ?? null) as string | null,
      salario_base,
      dias_trabajados,
      bonos,
      deducciones,
      total_pagar: salario_base + bonos - deducciones,
      conceptos,
    }
  })
  return { filas }
}

export function registerRrhhHandlers(): void {
  handleIpc('rrhh:empleados-list', async (_event, data?: { incluirInactivos?: boolean; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:empleados-list', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const filtro = data?.incluirInactivos ? '' : 'WHERE activo = 1'
    return db.prepare(`SELECT * FROM empleados ${filtro} ORDER BY nombre`).all()
  })

  handleIpc('rrhh:empleado-create', async (_event, data: {
    nombre: string; documento?: string; cargo?: string; salario_mensual?: number
    telefono?: string; direccion?: string; fecha_ingreso?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:empleado-create', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.nombre?.trim()) return { success: false, error: 'El nombre del empleado es obligatorio' }
    const db = getDatabase()
    const result = db.prepare(`
      INSERT INTO empleados (nombre, documento, cargo, salario_mensual, telefono, direccion, fecha_ingreso)
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, date('now','localtime')))
    `).run(
      data.nombre.trim(), data.documento?.trim() || null, data.cargo?.trim() || null,
      data.salario_mensual || 0, data.telefono?.trim() || null, data.direccion?.trim() || null,
      data.fecha_ingreso || null,
    )
    return { id: result.lastInsertRowid }
  })

  handleIpc('rrhh:empleado-update', async (_event, data: {
    id: number
    data: { nombre?: string; documento?: string; cargo?: string; salario_mensual?: number; telefono?: string; direccion?: string; activo?: number }
    usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:empleado-update', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const d = data.data
    db.prepare(`
      UPDATE empleados SET
        nombre = COALESCE(?, nombre), documento = COALESCE(?, documento), cargo = COALESCE(?, cargo),
        salario_mensual = COALESCE(?, salario_mensual), telefono = COALESCE(?, telefono),
        direccion = COALESCE(?, direccion), activo = COALESCE(?, activo)
      WHERE id = ?
    `).run(
      d.nombre?.trim() ?? null, d.documento ?? null, d.cargo ?? null, d.salario_mensual ?? null,
      d.telefono ?? null, d.direccion ?? null, d.activo ?? null, data.id,
    )
    return { success: true }
  })

  handleIpc('rrhh:empleado-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:empleado-delete', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const tieneNomina = db.prepare('SELECT 1 FROM nominas WHERE empleado_id = ? LIMIT 1').get(data.id)
    if (tieneNomina) {
      db.prepare('UPDATE empleados SET activo = 0 WHERE id = ?').run(data.id)
      return { success: true, desactivado: true }
    }
    db.prepare('DELETE FROM asistencia WHERE empleado_id = ?').run(data.id)
    db.prepare('DELETE FROM empleados WHERE id = ?').run(data.id)
    return { success: true, desactivado: false }
  })

  handleIpc('rrhh:asistencia-list', async (_event, data: { fecha?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:asistencia-list', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const fecha = data.fecha || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    const registros = db.prepare(`
      SELECT e.id as empleado_id, e.nombre, e.cargo,
        a.id as asistencia_id, a.estado, a.notas
      FROM empleados e
      LEFT JOIN asistencia a ON a.empleado_id = e.id AND a.fecha = ?
      WHERE e.activo = 1
      ORDER BY e.nombre
    `).all(fecha)
    return { fecha, registros }
  })

  handleIpc('rrhh:asistencia-registrar', async (_event, data: {
    empleado_id: number; fecha?: string; estado: string; notas?: string; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:asistencia-registrar', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const allowed = ['presente', 'ausente', 'tarde', 'permiso', 'descanso']
    if (!allowed.includes(data.estado)) return { success: false, error: 'Estado de asistencia inválido' }
    const db = getDatabase()
    const fecha = data.fecha || (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })()
    db.prepare(`
      INSERT INTO asistencia (empleado_id, fecha, estado, notas) VALUES (?, ?, ?, ?)
      ON CONFLICT(empleado_id, fecha) DO UPDATE SET estado = excluded.estado, notas = excluded.notas
    `).run(data.empleado_id, fecha, data.estado, data.notas?.trim() || null)
    return { success: true }
  })

  handleIpc('rrhh:nomina-generar', async (_event, data: {
    periodo_inicio: string; periodo_fin: string; tipo_pago?: 'semanal' | 'quincenal' | 'mensual'; usuario_id: number
    salario_base_activo?: boolean; bonos_globales?: number; deducciones_globales?: number
    bonos?: Record<number, number>; deducciones?: Record<number, number>
    grupo_id?: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-generar', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.periodo_inicio || !data.periodo_fin) return { success: false, error: 'Indica el período de la nómina' }
    if (data.periodo_fin < data.periodo_inicio) return { success: false, error: 'El período es inválido' }
    const db = getDatabase()
    const { filas, error: errorCalculo } = calcularFilasNomina(db, data)
    if (errorCalculo) return { success: false, error: errorCalculo }

    const generar = db.transaction(() => {
      const upsert = db.prepare(`
        INSERT INTO nominas (empleado_id, periodo_inicio, periodo_fin, salario_base, dias_trabajados, bonos, deducciones, total_pagar, usuario_id, tipo_pago, salario_base_activo)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(empleado_id, periodo_inicio, periodo_fin) DO UPDATE SET
          salario_base = excluded.salario_base, dias_trabajados = excluded.dias_trabajados,
          bonos = excluded.bonos, deducciones = excluded.deducciones, total_pagar = excluded.total_pagar,
          usuario_id = excluded.usuario_id, tipo_pago = excluded.tipo_pago, salario_base_activo = excluded.salario_base_activo
      `)
      const buscarNomina = db.prepare('SELECT id FROM nominas WHERE empleado_id = ? AND periodo_inicio = ? AND periodo_fin = ?')
      const borrarConceptos = db.prepare('DELETE FROM nomina_conceptos WHERE nomina_id = ?')
      const insC = db.prepare('INSERT INTO nomina_conceptos (nomina_id, nombre, tipo, monto, orden) VALUES (?, ?, ?, ?, ?)')
      for (const f of filas) {
        upsert.run(f.empleado_id, data.periodo_inicio, data.periodo_fin, f.salario_base, f.dias_trabajados, f.bonos, f.deducciones, f.total_pagar, data.usuario_id, data.tipo_pago ?? null, data.salario_base_activo ? 1 : 0)
        // Capa 3: conceptos del grupo → filas de detalle de la nómina.
        if (data.grupo_id) {
          const nominaRow = buscarNomina.get(f.empleado_id, data.periodo_inicio, data.periodo_fin) as any
          borrarConceptos.run(nominaRow.id)
          for (const c of f.conceptos) insC.run(nominaRow.id, c.nombre, c.tipo, c.monto, c.orden)
        }
      }
    })
    generar()
    const nominas = db.prepare(`
      SELECT n.*, e.nombre as empleado_nombre, e.documento as empleado_documento, e.cargo as empleado_cargo, e.experiencia, e.anos_servicio, e.nivel_academico
      FROM nominas n JOIN empleados e ON e.id = n.empleado_id
      WHERE n.periodo_inicio = ? AND n.periodo_fin = ?
      ORDER BY e.nombre
    `).all(data.periodo_inicio, data.periodo_fin)
    return { success: true, nominas }
  })

  // Vista previa (dry-run): mismos números que `rrhh:nomina-generar`, sin escribir nada.
  handleIpc('rrhh:nomina-preview', async (_event, data: NominaInput & { usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-preview', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.periodo_inicio || !data.periodo_fin) return { success: false, error: 'Indica el período de la nómina' }
    if (data.periodo_fin < data.periodo_inicio) return { success: false, error: 'El período es inválido' }
    const { filas, error } = calcularFilasNomina(getDatabase(), data)
    if (error) return { success: false, error }
    const totales = filas.reduce((acc, f) => ({
      bruto: acc.bruto + f.salario_base + f.bonos,
      deducciones: acc.deducciones + f.deducciones,
      neto: acc.neto + f.total_pagar,
    }), { bruto: 0, deducciones: 0, neto: 0 })
    return { success: true, filas, totales }
  })

  handleIpc('rrhh:nomina-list', async (_event, data: { periodo_inicio?: string; periodo_fin?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-list', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    if (data.periodo_inicio && data.periodo_fin) {
      return listarNominas(db, data.periodo_inicio, data.periodo_fin)
    }
    return listarNominas(db)
  })

  handleIpc('rrhh:nomina-conceptos-list', async (_event, data: { nomina_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-conceptos-list', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    return db.prepare('SELECT * FROM nomina_conceptos WHERE nomina_id = ? ORDER BY orden, id').all(data.nomina_id)
  })

  handleIpc('rrhh:nomina-concepto-add', async (_event, data: {
    nomina_id: number; nombre: string; tipo: 'asignacion' | 'deduccion'; monto: number; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-concepto-add', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.nombre?.trim()) return { success: false, error: 'Indica el nombre del concepto' }
    if (!(data.monto >= 0)) return { success: false, error: 'El monto del concepto es inválido' }
    const db = getDatabase()
    const nomina = db.prepare('SELECT id, estado FROM nominas WHERE id = ?').get(data.nomina_id) as any
    if (!nomina) return { success: false, error: 'La nómina no existe' }
    if (nomina.estado === 'pagada') return { success: false, error: 'No se pueden agregar conceptos a una nómina pagada' }
    const recalcular = db.transaction(() => {
      const maxOrden = db.prepare('SELECT COALESCE(MAX(orden), 0) as max FROM nomina_conceptos WHERE nomina_id = ?').get(data.nomina_id) as any
      db.prepare('INSERT INTO nomina_conceptos (nomina_id, nombre, tipo, monto, orden) VALUES (?, ?, ?, ?, ?)').run(
        data.nomina_id, data.nombre.trim(), data.tipo, data.monto, (maxOrden.max || 0) + 1,
      )
      const sumas = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo = 'asignacion' THEN monto ELSE 0 END), 0) as bonos,
          COALESCE(SUM(CASE WHEN tipo = 'deduccion' THEN monto ELSE 0 END), 0) as deducciones
        FROM nomina_conceptos WHERE nomina_id = ?
      `).get(data.nomina_id) as any
      const nominaActual = db.prepare('SELECT salario_base FROM nominas WHERE id = ?').get(data.nomina_id) as any
      const total = (nominaActual.salario_base || 0) + (sumas.bonos || 0) - (sumas.deducciones || 0)
      db.prepare('UPDATE nominas SET bonos = ?, deducciones = ?, total_pagar = ? WHERE id = ?').run(
        sumas.bonos || 0, sumas.deducciones || 0, total, data.nomina_id,
      )
    })
    recalcular()
    return { success: true }
  })

  handleIpc('rrhh:nomina-concepto-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-concepto-delete', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const concepto = db.prepare(`
      SELECT c.id, c.nomina_id, n.estado FROM nomina_conceptos c JOIN nominas n ON n.id = c.nomina_id WHERE c.id = ?
    `).get(data.id) as any
    if (!concepto) return { success: false, error: 'El concepto no existe' }
    if (concepto.estado === 'pagada') return { success: false, error: 'No se pueden eliminar conceptos de una nómina pagada' }
    const recalcular = db.transaction(() => {
      db.prepare('DELETE FROM nomina_conceptos WHERE id = ?').run(data.id)
      const sumas = db.prepare(`
        SELECT COALESCE(SUM(CASE WHEN tipo = 'asignacion' THEN monto ELSE 0 END), 0) as bonos,
          COALESCE(SUM(CASE WHEN tipo = 'deduccion' THEN monto ELSE 0 END), 0) as deducciones
        FROM nomina_conceptos WHERE nomina_id = ?
      `).get(concepto.nomina_id) as any
      const nominaActual = db.prepare('SELECT salario_base FROM nominas WHERE id = ?').get(concepto.nomina_id) as any
      const total = (nominaActual.salario_base || 0) + (sumas.bonos || 0) - (sumas.deducciones || 0)
      db.prepare('UPDATE nominas SET bonos = ?, deducciones = ?, total_pagar = ? WHERE id = ?').run(
        sumas.bonos || 0, sumas.deducciones || 0, total, concepto.nomina_id,
      )
    })
    recalcular()
    return { success: true }
  })

  handleIpc('rrhh:nomina-pagar', async (_event, data: { ids: number[]; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-pagar', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!Array.isArray(data.ids) || data.ids.length === 0) return { success: false, error: 'Selecciona nóminas a pagar' }
    const db = getDatabase()
    const pagar = db.transaction(() => {
      for (const id of data.ids) {
        db.prepare(`
          UPDATE nominas SET estado = 'pagada', pagado_en = datetime('now') WHERE id = ? AND estado = 'pendiente'
        `).run(id)
      }
    })
    pagar()
    return { success: true }
  })

  // ============ Histórico de asistencias ============
  handleIpc('rrhh:asistencia-historial', async (_event, data: { empleado_id?: number; desde?: string; hasta?: string; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:asistencia-historial', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const empleadoId = data?.empleado_id ?? null
    const desde = data?.desde || null
    const hasta = data?.hasta || null
    return db.prepare(`
      SELECT a.id, a.fecha, a.estado, a.notas,
        e.id as empleado_id, e.nombre as empleado_nombre, e.cargo as empleado_cargo
      FROM asistencia a JOIN empleados e ON e.id = a.empleado_id
      WHERE (? IS NULL OR a.empleado_id = ?)
        AND (? IS NULL OR a.fecha >= ?)
        AND (? IS NULL OR a.fecha <= ?)
      ORDER BY a.fecha DESC, e.nombre
      LIMIT 500
    `).all(empleadoId, empleadoId, desde, desde, hasta, hasta)
  })

  // ============ Histórico de nómina por trabajador ============
  handleIpc('rrhh:nomina-por-empleado', async (_event, data: { empleado_id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-por-empleado', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.empleado_id) return { success: false, error: 'Indica el empleado' }
    const db = getDatabase()
    const nominas = listarNominas(db).filter((n: any) => n.empleado_id === data.empleado_id)
    const totales = nominas.reduce(
      (acc: any, n: any) => ({
        bruto: acc.bruto + (n.salario_base || 0),
        asignaciones: acc.asignaciones + (n.bonos || 0),
        deducciones: acc.deducciones + (n.deducciones || 0),
        neto: acc.neto + (n.total_pagar || 0),
      }),
      { bruto: 0, asignaciones: 0, deducciones: 0, neto: 0 },
    )
    return { nominas, totales }
  })

  // ============ Catálogo de conceptos globales (capa 3) ============
  handleIpc('rrhh:conceptos-list', async (_event, data?: { incluirInactivos?: boolean; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:conceptos-list', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const filtro = data?.incluirInactivos ? '' : 'WHERE activo = 1'
    return db.prepare(`SELECT * FROM conceptos_catalogo ${filtro} ORDER BY tipo, nombre`).all()
  })

  handleIpc('rrhh:concepto-save', async (_event, data: {
    id?: number; nombre: string; tipo: 'asignacion' | 'deduccion'; monto_default?: number; activo?: number; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:concepto-save', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.nombre?.trim()) return { success: false, error: 'Indica el nombre del concepto' }
    if (data.tipo !== 'asignacion' && data.tipo !== 'deduccion') return { success: false, error: 'Tipo de concepto inválido' }
    const monto = Number(data.monto_default) || 0
    if (!(monto >= 0)) return { success: false, error: 'El monto no puede ser negativo' }
    const db = getDatabase()
    if (data.id) {
      const existe = db.prepare('SELECT id FROM conceptos_catalogo WHERE id = ?').get(data.id)
      if (!existe) return { success: false, error: 'El concepto no existe' }
      db.prepare(`UPDATE conceptos_catalogo SET nombre = ?, tipo = ?, monto_default = ?, activo = COALESCE(?, activo), actualizado_en = datetime('now') WHERE id = ?`)
        .run(data.nombre.trim(), data.tipo, monto, data.activo ?? null, data.id)
      return { success: true, id: data.id }
    }
    const result = db.prepare('INSERT INTO conceptos_catalogo (nombre, tipo, monto_default, activo) VALUES (?, ?, ?, COALESCE(?, 1))')
      .run(data.nombre.trim(), data.tipo, monto, data.activo ?? null)
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('rrhh:concepto-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:concepto-delete', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const usado = db.prepare('SELECT 1 FROM grupo_conceptos WHERE concepto_id = ? LIMIT 1').get(data.id)
    if (usado) {
      db.prepare('UPDATE conceptos_catalogo SET activo = 0 WHERE id = ?').run(data.id)
      return { success: true, desactivado: true }
    }
    db.prepare('DELETE FROM conceptos_catalogo WHERE id = ?').run(data.id)
    return { success: true, desactivado: false }
  })

  // ============ Grupos de empleados (capa 2) ============
  handleIpc('rrhh:grupos-list', async (_event, data?: { usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:grupos-list', 'rrhh_view')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const grupos = db.prepare(`
      SELECT g.*,
        (SELECT COUNT(*) FROM empleado_grupo_miembros m WHERE m.grupo_id = g.id) as miembros,
        (SELECT COUNT(*) FROM grupo_conceptos gc WHERE gc.grupo_id = g.id) as conceptos
      FROM empleado_grupos g ORDER BY g.nombre
    `).all() as any[]
    const miembros = db.prepare('SELECT grupo_id, empleado_id FROM empleado_grupo_miembros').all() as any[]
    const conceptos = db.prepare(`
      SELECT gc.grupo_id, gc.concepto_id, gc.monto, c.nombre, c.tipo, c.monto_default
      FROM grupo_conceptos gc JOIN conceptos_catalogo c ON c.id = gc.concepto_id
      ORDER BY c.tipo, c.nombre
    `).all() as any[]
    return grupos.map((g) => ({
      ...g,
      empleado_ids: miembros.filter((m) => m.grupo_id === g.id).map((m) => m.empleado_id),
      conceptos_detalle: conceptos.filter((c) => c.grupo_id === g.id),
    }))
  })

  handleIpc('rrhh:grupo-save', async (_event, data: { id?: number; nombre: string; descripcion?: string; activo?: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:grupo-save', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.nombre?.trim()) return { success: false, error: 'Indica el nombre del grupo' }
    const db = getDatabase()
    if (data.id) {
      const existe = db.prepare('SELECT id FROM empleado_grupos WHERE id = ?').get(data.id)
      if (!existe) return { success: false, error: 'El grupo no existe' }
      const dup = db.prepare('SELECT id FROM empleado_grupos WHERE nombre = ? AND id <> ?').get(data.nombre.trim(), data.id)
      if (dup) return { success: false, error: 'Ya existe un grupo con ese nombre' }
      db.prepare('UPDATE empleado_grupos SET nombre = ?, descripcion = COALESCE(?, descripcion), activo = COALESCE(?, activo) WHERE id = ?')
        .run(data.nombre.trim(), data.descripcion?.trim() ?? null, data.activo ?? null, data.id)
      return { success: true, id: data.id }
    }
    const dup = db.prepare('SELECT id FROM empleado_grupos WHERE nombre = ?').get(data.nombre.trim())
    if (dup) return { success: false, error: 'Ya existe un grupo con ese nombre' }
    const result = db.prepare('INSERT INTO empleado_grupos (nombre, descripcion, activo) VALUES (?, ?, COALESCE(?, 1))')
      .run(data.nombre.trim(), data.descripcion?.trim() ?? null, data.activo ?? null)
    return { success: true, id: result.lastInsertRowid }
  })

  handleIpc('rrhh:grupo-delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:grupo-delete', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    const db = getDatabase()
    const borrar = db.transaction(() => {
      db.prepare('DELETE FROM grupo_conceptos WHERE grupo_id = ?').run(data.id)
      db.prepare('DELETE FROM empleado_grupo_miembros WHERE grupo_id = ?').run(data.id)
      db.prepare('DELETE FROM empleado_grupos WHERE id = ?').run(data.id)
    })
    borrar()
    return { success: true }
  })

  handleIpc('rrhh:grupo-miembros-set', async (_event, data: { grupo_id: number; empleado_ids: number[]; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:grupo-miembros-set', 'rrhh_edit')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.grupo_id) return { success: false, error: 'Indica el grupo' }
    const ids = Array.isArray(data.empleado_ids) ? data.empleado_ids.filter((n) => Number.isInteger(n)) : []
    const db = getDatabase()
    if (!db.prepare('SELECT id FROM empleado_grupos WHERE id = ?').get(data.grupo_id)) {
      return { success: false, error: 'El grupo no existe' }
    }
    const aplicar = db.transaction(() => {
      db.prepare('DELETE FROM empleado_grupo_miembros WHERE grupo_id = ?').run(data.grupo_id)
      const ins = db.prepare('INSERT OR IGNORE INTO empleado_grupo_miembros (grupo_id, empleado_id) VALUES (?, ?)')
      for (const id of ids) {
        if (db.prepare('SELECT 1 FROM empleados WHERE id = ?').get(id)) ins.run(data.grupo_id, id)
      }
    })
    aplicar()
    return { success: true }
  })

  handleIpc('rrhh:grupo-conceptos-set', async (_event, data: { grupo_id: number; conceptos: { concepto_id: number; monto?: number }[]; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:grupo-conceptos-set', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data?.grupo_id) return { success: false, error: 'Indica el grupo' }
    const db = getDatabase()
    if (!db.prepare('SELECT id FROM empleado_grupos WHERE id = ?').get(data.grupo_id)) {
      return { success: false, error: 'El grupo no existe' }
    }
    const lista = Array.isArray(data.conceptos) ? data.conceptos : []
    const aplicar = db.transaction(() => {
      db.prepare('DELETE FROM grupo_conceptos WHERE grupo_id = ?').run(data.grupo_id)
      const ins = db.prepare('INSERT OR IGNORE INTO grupo_conceptos (grupo_id, concepto_id, monto) VALUES (?, ?, ?)')
      for (const c of lista) {
        const cat = db.prepare('SELECT id, monto_default FROM conceptos_catalogo WHERE id = ? AND activo = 1').get(c.concepto_id) as any
        if (!cat) continue
        const monto = c.monto !== undefined && c.monto !== null ? Number(c.monto) : (cat.monto_default || 0)
        if (!(monto >= 0)) continue
        ins.run(data.grupo_id, c.concepto_id, monto)
      }
    })
    aplicar()
    return { success: true }
  })
}
