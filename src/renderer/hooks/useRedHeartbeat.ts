import { useEffect } from 'react'
import { callApi } from '../lib/api-client'

const HEARTBEAT_INTERVAL_MS = 60_000

export interface RedStatusLite {
  modo: 'base' | 'hija' | 'local'
  esHija: boolean
}

export function useRedHeartbeat(intervalMs: number = HEARTBEAT_INTERVAL_MS): void {
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | null = null
    let active = false

    const tick = async (): Promise<void> => {
      if (cancelled || !active) return
      try {
        await callApi('red:heartbeat')
      } catch {
        // best-effort: la Base ya marca al par como inactivo y expulsa sesiones tras TTL
      }
    }

    const ensureRunning = async (): Promise<void> => {
      try {
        const status = await callApi<RedStatusLite>('red:status')
        const shouldRun = status?.modo === 'hija'
        if (shouldRun && !active && !cancelled) {
          active = true
          timer = setInterval(tick, intervalMs)
        } else if (!shouldRun && active) {
          active = false
          if (timer) clearInterval(timer)
          timer = null
        }
      } catch {
        // sin estado: no iniciar heartbeat
      }
    }

    ensureRunning()
    const pollStatus = setInterval(ensureRunning, intervalMs)

    return () => {
      cancelled = true
      if (timer) clearInterval(timer)
      clearInterval(pollStatus)
    }
  }, [intervalMs])
}
