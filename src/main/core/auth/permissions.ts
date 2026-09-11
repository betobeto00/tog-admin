import { getDatabase } from '../../db/database'
import { ROLE_DEFAULTS, type PermissionKey } from '../../../shared/permissions'

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

export function requirePermission(userId: number, permission: PermissionKey): void {
  if (!checkPermission(userId, permission)) {
    throw new Error(`Permiso denegado: se requiere "${permission}"`)
  }
}

export function extractUserId(data: any): number | null {
  if (data && typeof data.usuario_id === 'number') return data.usuario_id
  return null
}

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
