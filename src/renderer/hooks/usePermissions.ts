import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@core/auth/store'
import { PERMISSIONS, ROLE_DEFAULTS } from '@shared/permissions'
import { callApi } from '../lib/api-client'

const ALL_PERMISSIONS = Object.keys(PERMISSIONS) as string[]

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
        setPermissions(ROLE_DEFAULTS.cajero as unknown as string[])
      }
    } catch {
      setPermissions(ROLE_DEFAULTS.cajero as unknown as string[])
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
