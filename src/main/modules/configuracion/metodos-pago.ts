import { handleIpc } from '../../core/auth/ipc-guard'
import { getDatabase } from '../../db/database'
import { checkPermissionOrFail } from '../../core/auth'

export function registerMetodosPagoHandlers(): void {
  handleIpc('metodos-pago:list', async (_event, data: { activoOnly?: boolean; usuario_id?: number } | undefined) => {
    const perm = data?.activoOnly ? 'pos_access' : 'config_access'
    const fail = checkPermissionOrFail(data, 'metodos-pago:list', perm)
    if (fail) return fail
    const db = getDatabase()
    const rows = data?.activoOnly
      ? db.prepare('SELECT * FROM metodos_pago WHERE activo = 1 ORDER BY orden, id').all()
      : db.prepare('SELECT * FROM metodos_pago ORDER BY orden, id').all()
    return rows
  })

  handleIpc('metodos-pago:create', async (_event, data: any) => {
    const fail = checkPermissionOrFail(data, 'metodos-pago:create', 'config_edit')
    if (fail) return fail
    const db = getDatabase()
    if (!data.clave || !data.nombre) return { success: false, error: 'clave y nombre son requeridos' }
    const clave = String(data.clave).toLowerCase().replace(/\s+/g, '_')
    try {
      const result = db.prepare(
        'INSERT INTO metodos_pago (clave, nombre, icono, requiere_terminal, activo, orden) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(clave, data.nombre, data.icono || 'DollarSign', data.requiere_terminal ? 1 : 0, data.activo !== false ? 1 : 0, data.orden || 99)
      return { success: true, id: result.lastInsertRowid }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  handleIpc('metodos-pago:update', async (_event, data: { id: number; data: any; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'metodos-pago:update', 'config_edit')
    if (fail) return fail
    const db = getDatabase()
    const fields: string[] = []
    const values: any[] = []
    const upd = data.data
    for (const k of ['nombre', 'icono', 'requiere_terminal', 'activo', 'orden']) {
      if (upd[k] !== undefined) {
        fields.push(`${k} = ?`)
        values.push(k === 'requiere_terminal' || k === 'activo' ? (upd[k] ? 1 : 0) : upd[k])
      }
    }
    if (!fields.length) return { success: false, error: 'Nada que actualizar' }
    fields.push("actualizado_en = datetime('now')")
    values.push(data.id)
    db.prepare(`UPDATE metodos_pago SET ${fields.join(', ')} WHERE id = ?`).run(...values)
    return { success: true }
  })

  handleIpc('metodos-pago:delete', async (_event, data: { id: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'metodos-pago:delete', 'config_edit')
    if (fail) return fail
    const db = getDatabase()
    db.prepare('UPDATE metodos_pago SET activo = 0 WHERE id = ?').run(data.id)
    return { success: true }
  })

  handleIpc('metodos-pago:procesar-tarjeta', async (_event, data: { monto: number; usuario_id: number }) => {
    const fail = checkPermissionOrFail(data, 'metodos-pago:procesar-tarjeta', 'pos_access')
    if (fail) return fail
    const { getTerminalService } = await import('../../services/valorTerminal')
    const terminal = getTerminalService()
    if (!terminal.isConnected()) {
      return { success: false, error: 'Terminal VP800 no está conectado. Ve a Configuración → Terminal.' }
    }
    try {
      const resp = await terminal.enviarCobro(data.monto)
      return {
        success: resp.RESPONSE_CODE === '00',
        authCode: resp.AUTH_CODE,
        refNum: resp.REF_NUM,
        cardType: resp.CARD_TYPE,
        maskedPan: resp.MASKED_PAN,
        responseText: resp.RESPONSE_TEXT,
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}