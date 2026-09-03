import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@core/auth/store'
import { callApi } from '../lib/api-client'

// Default permissions for cajero role (same as shared/permissions.ts ROLE_DEFAULTS)
const DEFAULT_CAJERO = [
  'pos_access', 'pos_discount', 'pos_edit_price', 'pos_quick_sale',
  'caja_access', 'caja_open', 'caja_close', 'caja_movement', 'caja_report_x',
  'inventario_access', 'inventario_create', 'inventario_edit',
  'compras_access', 'compras_create',
  'quotes_access', 'quotes_create',
  'reportes_access',
]

// All permission keys (admin has all)
const ALL_PERMISSIONS = [
  'pos_access', 'pos_void_sale', 'pos_discount', 'pos_edit_price', 'pos_quick_sale',
  'caja_access', 'caja_open', 'caja_close', 'caja_movement', 'caja_report_x',
  'inventario_access', 'inventario_create', 'inventario_edit', 'inventario_delete',
  'inventario_adjust', 'inventario_categories', 'inventario_units',
  'compras_access', 'compras_create', 'compras_suppliers',
  'quotes_access', 'quotes_create',
  'reportes_access', 'reportes_export',
  'config_access', 'config_edit', 'config_terminal', 'config_backup', 'config_db_reset',
  'usuarios_access', 'usuarios_manage_roles',
]

export function usePermissions() {
  const usuario = useAuthStore((s) => s.usuario)
  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadPermissions()
  }, [usuario?.id])

  const loadPermissions = async () => {
    if (!usuario) {
      setPermissions([])
      setLoading(false)
      return
    }

    // Admin always has all permissions
    if (usuario.rol === 'admin') {
      setPermissions(ALL_PERMISSIONS)
      setLoading(false)
      return
    }

    try {
      const result = await callApi<{ success: boolean; permisos?: string[] }>('usuarios:getPermissions', { id: usuario.id })
      if (result.success && result.permisos) {
        setPermissions(result.permisos)
      } else {
        setPermissions(DEFAULT_CAJERO)
      }
    } catch {
      setPermissions(DEFAULT_CAJERO)
    }
    setLoading(false)
  }

  const has = useCallback(
    (permission: string): boolean => {
      if (usuario?.rol === 'admin') return true
      return permissions.includes(permission)
    },
    [permissions, usuario?.rol],
  )

  const hasAny = useCallback(
    (...perms: string[]): boolean => {
      if (usuario?.rol === 'admin') return true
      return perms.some((p) => permissions.includes(p))
    },
    [permissions, usuario?.rol],
  )

  const hasAll = useCallback(
    (...perms: string[]): boolean => {
      if (usuario?.rol === 'admin') return true
      return perms.every((p) => permissions.includes(p))
    },
    [permissions, usuario?.rol],
  )

  return { permissions, loading, has, hasAny, hasAll, reload: loadPermissions }
}
