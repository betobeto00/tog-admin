import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'
import { getActiveModules } from '../../services/license'

function checkModuleOrFail(): { success: false; error: string } | null {
  if (!getActiveModules().includes('rrhh')) {
    return { success: false, error: 'El módulo Recursos Humanos no está activo en la licencia' }
  }
  return null
}

const DIAS_NOMINA = 30

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
    periodo_inicio: string; periodo_fin: string; bonos?: Record<number, number>; deducciones?: Record<number, number>; usuario_id: number
  }) => {
    const fail = checkPermissionOrFail(data, 'rrhh:nomina-generar', 'rrhh_nomina')
    if (fail) return fail
    const moduleFail = checkModuleOrFail()
    if (moduleFail) return moduleFail
    if (!data.periodo_inicio || !data.periodo_fin) return { success: false, error: 'Indica el período de la nómina' }
    if (data.periodo_fin < data.periodo_inicio) return { success: false, error: 'El período es inválido' }
    const db = getDatabase()
    const empleados = db.prepare('SELECT id, salario_mensual FROM empleados WHERE activo = 1').all() as any[]
    if (empleados.length === 0) return { success: false, error: 'No hay empleados activos' }
    const generar = db.transaction(() => {
      const ids: number[] = []
      for (const e of empleados) {
        const dias = db.prepare(`
          SELECT COUNT(*) as dias FROM asistencia
          WHERE empleado_id = ? AND fecha BETWEEN ? AND ? AND estado IN ('presente', 'tarde')
        `).get(e.id, data.periodo_inicio, data.periodo_fin) as any
        const bonos = data.bonos?.[e.id] || 0
        const deducciones = data.deducciones?.[e.id] || 0
        const proporcional = (e.salario_mensual / DIAS_NOMINA) * dias.dias
        const total = proporcional + bonos - deducciones
        db.prepare(`
          INSERT INTO nominas (empleado_id, periodo_inicio, periodo_fin, salario_base, dias_trabajados, bonos, deducciones, total_pagar, usuario_id)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(empleado_id, periodo_inicio, periodo_fin) DO UPDATE SET
            salario_base = excluded.salario_base, dias_trabajados = excluded.dias_trabajados,
            bonos = excluded.bonos, deducciones = excluded.deducciones, total_pagar = excluded.total_pagar,
            usuario_id = excluded.usuario_id
        `).run(e.id, data.periodo_inicio, data.periodo_fin, e.salario_mensual, dias.dias, bonos, deducciones, total, data.usuario_id)
        ids.push(e.id)
      }
      return ids
    })
    generar()
    const nominas = db.prepare(`
      SELECT n.*, e.nombre as empleado_nombre, e.documento as empleado_documento, e.cargo as empleado_cargo
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
      return db.prepare(`
        SELECT n.*, e.nombre as empleado_nombre, e.documento as empleado_documento, e.cargo as empleado_cargo
        FROM nominas n JOIN empleados e ON e.id = n.empleado_id
        WHERE n.periodo_inicio = ? AND n.periodo_fin = ?
        ORDER BY e.nombre
      `).all(data.periodo_inicio, data.periodo_fin)
    }
    return db.prepare(`
      SELECT n.*, e.nombre as empleado_nombre, e.documento as empleado_documento, e.cargo as empleado_cargo
      FROM nominas n JOIN empleados e ON e.id = n.empleado_id
      ORDER BY n.periodo_inicio DESC, e.nombre
      LIMIT 200
    `).all()
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
