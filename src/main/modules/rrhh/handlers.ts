import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

type DatabaseLike = {
  prepare(sql: string): { get(...args: unknown[]): unknown; all(...args: unknown[]): unknown; run(...args: unknown[]): unknown }
}

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('rrhh')) {
    return { success: false, error: 'El módulo Recursos Humanos no está activo en la licencia' }
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
      VALUES (?, ?, ?, ?, ?, ?, COALESCE(?, date('now')))
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
    const fecha = data.fecha || new Date().toISOString().slice(0, 10)
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
    const fecha = data.fecha || new Date().toISOString().slice(0, 10)
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
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-generar', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.periodo_inicio || !data.periodo_fin) return { success: false, error: 'Indica el período de la nómina' }
    if (data.periodo_fin < data.periodo_inicio) return { success: false, error: 'El período es inválido' }
    const db = getDatabase()
    const empleados = db.prepare('SELECT id, salario_mensual, experiencia, anos_servicio, nivel_academico FROM empleados WHERE activo = 1').all() as any[]
    if (empleados.length === 0) return { success: false, error: 'No hay empleados activos' }
    const factorMap: Record<string, number> = { mensual: 1, quincenal: 0.5, semanal: 0.25 }
    const factor = (data.tipo_pago && factorMap[data.tipo_pago]) || 1
    const generar = db.transaction(() => {
      const ids: number[] = []
      for (const e of empleados) {
        const dias = db.prepare(`
          SELECT COUNT(*) as dias FROM asistencia
          WHERE empleado_id = ? AND fecha BETWEEN ? AND ? AND estado IN ('presente', 'tarde')
        `).get(e.id, data.periodo_inicio, data.periodo_fin) as any
        const dias_trabajados = dias.dias || 0
        let salario_base = 0
        if (data.salario_base_activo && e.salario_mensual) {
          salario_base = e.salario_mensual * factor * (dias_trabajados / DIAS_NOMINA)
        }
        const bonos = data.bonos?.[e.id] || 0
        const deducciones = data.deducciones?.[e.id] || 0
        const bonosGlobales = data.bonos_globales !== undefined ? data.bonos_globales : 0
        const deduccionesGlobales = data.deducciones_globales !== undefined ? data.deducciones_globales : 0
        const total = salario_base + bonos + bonosGlobales - deducciones - deduccionesGlobales
        db.prepare(`
          INSERT INTO nominas (empleado_id, periodo_inicio, periodo_fin, salario_base, dias_trabajados, bonos, deducciones, total_pagar, usuario_id, tipo_pago, salario_base_activo)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(empleado_id, periodo_inicio, periodo_fin) DO UPDATE SET
            salario_base = excluded.salario_base, dias_trabajados = excluded.dias_trabajados,
            bonos = excluded.bonos, deducciones = excluded.deducciones, total_pagar = excluded.total_pagar,
            usuario_id = excluded.usuario_id, tipo_pago = excluded.tipo_pago, salario_base_activo = excluded.salario_base_activo
        `).run(e.id, data.periodo_inicio, data.periodo_fin, salario_base, dias_trabajados, bonos + bonosGlobales, deducciones + deduccionesGlobales, total, data.usuario_id, data.tipo_pago ?? null, data.salario_base_activo ? 1 : 0)
        ids.push(e.id)
      }
      return ids
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
}
