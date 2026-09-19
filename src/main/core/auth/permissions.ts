import { getDatabase } from '../../db/database'
import { ROLE_DEFAULTS, type PermissionKey } from '../../../shared/permissions'
import { getUsuarioDeToken, liberarSesionPorToken } from '../../services/red-session'

const CACHE_TTL_MS = 5000
const permissionsCache = new Map<string, { permissions: PermissionKey[]; expiresAt: number }>()

function getCachedPermissions(userId: number): PermissionKey[] | null {
  const key = String(userId)
  const cached = permissionsCache.get(key)
  if (cached && Date.now() < cached.expiresAt) return cached.permissions
  permissionsCache.delete(key)
  return null
}

function setCachedPermissions(userId: number, permissions: PermissionKey[]): void {
  permissionsCache.set(String(userId), {
    permissions,
    expiresAt: Date.now() + CACHE_TTL_MS,
  })
}

export function getUserPermissions(userId: number): PermissionKey[] {
  const cached = getCachedPermissions(userId)
  if (cached) return cached

  const db = getDatabase()
  const user = db.prepare('SELECT rol, permisos FROM usuarios WHERE id = ?').get(userId) as any
  if (!user) return []

  let permissions: PermissionKey[]
  if (user.rol === 'admin') {
    permissions = ROLE_DEFAULTS.admin
  } else if (user.permisos) {
    try {
      permissions = JSON.parse(user.permisos) as PermissionKey[]
    } catch {
      permissions = (ROLE_DEFAULTS[user.rol] || []) as PermissionKey[]
    }
  } else {
    permissions = (ROLE_DEFAULTS[user.rol] || []) as PermissionKey[]
  }

  setCachedPermissions(userId, permissions)
  return permissions
}

export function checkPermission(userId: number, permission: PermissionKey): boolean {
  const permissions = getUserPermissions(userId)
  return permissions.includes(permission)
}

/**
 * ¿La sesión pertenece a un administrador?
 *
 * Se usa para cambios irreversibles que afectan a todos los comprobantes
 * (numeración de facturas y N° de control fiscal): ni siquiera un usuario al
 * que le regalen `print_config` debería poder renumerar la facturación.
 */
export function isAdminUser(userId: number): boolean {
  const usuario = getDatabase().prepare('SELECT rol FROM usuarios WHERE id = ?').get(userId) as any
  return usuario?.rol === 'admin'
}

export function extractSessionToken(data: any): string | null {
  if (data && typeof data.session_token === 'string' && data.session_token) return data.session_token
  return null
}

/**
 * usuario_id del actor, resuelto **solo** desde el token de sesión.
 *
 * Antes se leía `data.usuario_id`, que lo elegía el cliente: cualquier renderer
 * comprometido podía reclamar ser el admin. El token lo emite
 * `registrarSesion()` en `auth:login` y vive en `sesiones_activas`, así que se
 * valida contra la BD **local** (sin red: TOG Admin es offline-first salvo
 * activación y feedback).
 *
 * Falla cerrado: sin token, o con token que no existe (logout, sesión
 * expulsada), devuelve `null` — nunca cae al `usuario_id` del cliente.
 */
export function resolveAuthenticatedUserId(data: any): number | null {
  const token = extractSessionToken(data)
  if (!token) return null
  try {
    return getUsuarioDeToken(getDatabase(), token)
  } catch {
    return null
  }
}

export function checkPermissionOrFail(
  data: any,
  channel: string,
  permission: PermissionKey,
): { success: false; error: string; channel: string } | null {
  const userId = resolveAuthenticatedUserId(data)
  if (userId == null) {
    return {
      success: false,
      error: `Canal '${channel}' requiere sesión activa (token de sesión ausente o inválido).`,
      channel,
    }
  }

  // El actor real viene de la sesión, no del cliente: se normaliza en el propio
  // objeto para que los handlers que persisten `usuario_id` (ventas, caja,
  // ajustes de stock, auditoría) tampoco puedan ser suplantados. `data` es el
  // mismo objeto que el handler sigue usando después del chequeo.
  if (data && typeof data === 'object' && !Array.isArray(data)) {
    data.usuario_id = userId
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

/** Cierra la sesión del token actual (lo usa el logout local). */
export function endSession(data: any): void {
  liberarSesionPorToken(getDatabase(), extractSessionToken(data))
}
