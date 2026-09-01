import { getDatabase } from '../db/database'
import { ROLE_DEFAULTS, type PermissionKey } from '../../shared/permissions'

/**
 * Obtiene los permisos de un usuario desde la base de datos.
 * Admin siempre retorna todos los permisos.
 */
export function getUserPermissions(userId: number): PermissionKey[] {
  const db = getDatabase()
  const user = db.prepare('SELECT rol, permisos FROM usuarios WHERE id = ?').get(userId) as any
  if (!user) return []

  // Admin tiene todos los permisos
  if (user.rol === 'admin') {
    return Object.keys(ROLE_DEFAULTS.admin) as PermissionKey[]
  }

  // Parsear permisos del JSON
  if (user.permisos) {
    try {
      return JSON.parse(user.permisos) as PermissionKey[]
    } catch {
      return (ROLE_DEFAULTS[user.rol] || []) as PermissionKey[]
    }
  }

  return (ROLE_DEFAULTS[user.rol] || []) as PermissionKey[]
}

/**
 * Verifica si un usuario tiene un permiso específico.
 * Retorna true si tiene el permiso, false si no.
 */
export function checkPermission(userId: number, permission: PermissionKey): boolean {
  const permissions = getUserPermissions(userId)
  return permissions.includes(permission)
}

/**
 * Lanza un error si el usuario no tiene el permiso requerido.
 * Usar en IPC handlers para validar antes de ejecutar.
 */
export function requirePermission(userId: number, permission: PermissionKey): void {
  if (!checkPermission(userId, permission)) {
    throw new Error(`Permiso denegado: se requiere "${permission}"`)
  }
}

/**
 * Extrae el usuario_id de los argumentos IPC.
 * Los handlers reciben (event, data) donde data puede tener usuario_id.
 */
export function extractUserId(data: any): number | null {
  if (data?.usuario_id) return data.usuario_id
  if (data?.id && typeof data.id === 'number') return data.id
  return null
}

/**
 * Verifica permiso y devuelve un objeto compatible con el patrón actual de los handlers
 * ({ success: false, error: ... }) o null si pasa. Usar al inicio de cada handler:
 *
 *   const fail = checkPermissionOrFail(data, 'ventas:create', 'pos_access')
 *   if (fail) return fail
 *
 * Acepta usuario_id en `data` (prioridad), `payload`, o en `data.usuario_id`.
 */
export function checkPermissionOrFail(
  data: any,
  channel: string,
  permission: PermissionKey,
): { success: false; error: string; channel: string } | null {
  const userId = extractUserId(data)
  if (userId == null) {
    return {
      success: false,
      error: `Canal '${channel}' requiere usuario autenticado (no se proporcionó usuario_id).`,
      channel,
    }
  }
  if (!checkPermission(userId, permission)) {
    return {
      success: false,
      error: `Permiso denegado: '${permission}' requerido para '${channel}'.`,
      channel,
    }
  }
  return null
}
