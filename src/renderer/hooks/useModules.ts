import { useState, useEffect, useCallback } from 'react'
import { callApi } from '../lib/api-client'
import { normalizeModules, type ModuleId } from '@shared/modules'

const BASE_MODULE: ModuleId = 'comercializador'
const LICENSE_UPDATED_EVENT = 'tog:license-updated'

export function useActiveModules() {
  const [modulos, setModulos] = useState<ModuleId[]>([BASE_MODULE])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      const s = await callApi<{ modulos?: string[] }>('license:status')
      const active = normalizeModules(s?.modulos)
      if (!active.includes(BASE_MODULE)) active.unshift(BASE_MODULE)
      setModulos(active)
    } catch {
      // sin licencia/status: quedan los módulos base
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Al sincronizar/importar una licencia nueva, refrescar los módulos en vivo
  useEffect(() => {
    window.addEventListener(LICENSE_UPDATED_EVENT, load)
    return () => window.removeEventListener(LICENSE_UPDATED_EVENT, load)
  }, [load])

  const isActive = useCallback((modulo: ModuleId) => modulos.includes(modulo), [modulos])

  return { modulos, loading, isActive }
}
