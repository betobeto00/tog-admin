import { useState, useEffect, useCallback } from 'react'
import { callApi } from '../lib/api-client'
import { normalizeModules, type ModuleId } from '@shared/modules'

const BASE_MODULE: ModuleId = 'comercializador'

export function useActiveModules() {
  const [modulos, setModulos] = useState<ModuleId[]>([BASE_MODULE])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    callApi<{ modulos?: string[] }>('license:status')
      .then((s) => {
        if (!mounted) return
        const active = normalizeModules(s?.modulos)
        if (!active.includes(BASE_MODULE)) active.unshift(BASE_MODULE)
        setModulos(active)
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const isActive = useCallback((modulo: ModuleId) => modulos.includes(modulo), [modulos])

  return { modulos, loading, isActive }
}