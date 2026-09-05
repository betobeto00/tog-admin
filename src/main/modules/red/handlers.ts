import os from 'os'
import { handleIpc } from '../../core/auth/ipc-guard'
import { checkPermissionOrFail } from '../../core/auth'
import { getDatabase } from '../../db/database'
import { getRedModo, getHijaConfig, isBase, isHija } from '../../services/red-config'
import { generarCodigoEnlace, isRedServerRunning, RED_SERVER_PORT } from '../../services/red-server'
import { vincularABase, desvincularDeBase, logoutEnBase, heartbeatABase } from '../../services/red-client'
import { getLicenseMaxPcs } from '../../services/license'
import { liberarSesionesDePar } from '../../services/red-session'

function localIps(): string[] {
  const ips: string[] = []
  for (const ifaces of Object.values(os.networkInterfaces())) {
    for (const iface of ifaces || []) {
      if (iface.family === 'IPv4' && !iface.internal) ips.push(iface.address)
    }
  }
  return ips
}

export function registerRedHandlers(): void {
  handleIpc('red:status', async () => {
    const modo = getRedModo()
    const hija = getHijaConfig()
    let lastHeartbeat: string | null = null
    if (modo === 'base') {
      const db = getDatabase()
      const row = db
        .prepare('SELECT MAX(last_heartbeat) AS hb FROM pcs_enlazadas')
        .get() as { hb: string | null } | undefined
      lastHeartbeat = row?.hb ?? null
    }
    return {
      modo,
      baseUrl: hija?.baseUrl || null,
      parId: hija?.parId || null,
      pcNombre: hija?.pcNombre || null,
      certFingerprint: hija?.certFingerprint || null,
      servidorActivo: modo === 'base' && isRedServerRunning(),
      puerto: RED_SERVER_PORT,
      ips: modo === 'base' ? localIps() : [],
      maxPcs: modo === 'base' ? getLicenseMaxPcs() : null,
      esHija: isHija(),
      esBase: isBase(),
      lastHeartbeat,
    }
  })

  handleIpc('red:heartbeat', async () => {
    if (!isHija()) {
      return { success: false, error: 'Solo aplica en PC Hija' }
    }
    return heartbeatABase()
  })

  handleIpc('red:vincular', async (_event, data: { baseUrl?: string; codigo?: string; nombre?: string }) => {
    const baseUrl = typeof data?.baseUrl === 'string' ? data.baseUrl.trim() : ''
    const codigo = typeof data?.codigo === 'string' ? data.codigo.trim() : ''
    const nombre = typeof data?.nombre === 'string' ? data.nombre.trim() : ''
    if (!baseUrl || !codigo || !nombre) {
      return { success: false, error: 'IP de la PC Base, código de enlace y nombre de PC son requeridos' }
    }
    return vincularABase(baseUrl, codigo, nombre)
  })

  handleIpc('red:desvincular', async () => {
    desvincularDeBase()
    return { success: true }
  })

  handleIpc('red:generar-codigo', async (_event, data: any) => {
    if (isHija()) {
      return { success: false, error: 'Esta PC es una terminal (PC Hija). Generá el código de enlace en la PC Base.' }
    }
    const fail = checkPermissionOrFail(data, 'red:generar-codigo', 'red_manage')
    if (fail) return fail
    const db = getDatabase()
    return { success: true, ...generarCodigoEnlace(db) }
  })

  handleIpc('red:listar-pcs', async (_event, data: any) => {
    if (isHija()) {
      return { success: false, error: 'Esta PC es una terminal (PC Hija). Las PCs enlazadas se ven en la PC Base.' }
    }
    const fail = checkPermissionOrFail(data, 'red:listar-pcs', 'red_manage')
    if (fail) return fail
    const db = getDatabase()
    const pcs = db
      .prepare('SELECT par_id, nombre, ip, last_seen, creado_en FROM pcs_enlazadas ORDER BY creado_en DESC')
      .all()
    return { success: true, pcs }
  })

  // Libera la sesión del usuario al cerrar sesión: en una hija se avisa a la
  // Base vía HTTP; en la Base se borra la sesión local del usuario.
  handleIpc('red:logout', async (_event, data: any) => {
    if (isHija()) {
      await logoutEnBase()
      return { success: true }
    }
    const db = getDatabase()
    if (data?.usuario_id) {
      db.prepare('DELETE FROM sesiones_activas WHERE usuario_id = ?').run(data.usuario_id)
    } else {
      // Sin usuario identificado: liberar las sesiones del par base
      liberarSesionesDePar(db, 'base')
    }
    return { success: true }
  })
}