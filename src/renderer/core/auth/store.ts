import { create, type StateCreator } from 'zustand'
import { callApi } from '@lib/api-client'

interface Usuario {
  id: number
  usuario: string
  nombre: string
  rol: 'admin' | 'cajero' | 'manager'
  debe_cambiar_contrasena?: number
}

interface AuthState {
  usuario: Usuario | null
  isAuthenticated: boolean
  isLoading: boolean
  error: string | null

  login: (usuario: string, contrasena: string) => Promise<boolean>
  logout: () => void
  clearError: () => void
  changePassword: (contrasenaActual: string, contrasenaNueva: string) => Promise<{ success: boolean; error?: string }>
}

const authCreator: StateCreator<AuthState> = (set) => ({
  usuario: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (usuario: string, contrasena: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await callApi<{ success: boolean; usuario?: any; error?: string }>('auth:login', { usuario, contrasena })

      if (result.success && result.usuario) {
        set({
          usuario: result.usuario,
          isAuthenticated: true,
          isLoading: false,
          error: null,
        })
        // Guardar sesión en localStorage para persistencia
        localStorage.setItem('tog_user', JSON.stringify(result.usuario))
        return true
      } else {
        set({
          isLoading: false,
          error: result.error || 'Authentication error',
        })
        return false
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Connection error' })
      return false
    }
  },

  logout: () => {
    set({ usuario: null, isAuthenticated: false, error: null })
    localStorage.removeItem('tog_user')
    // Liberar la sesión en la PC Base (red local), best-effort
    callApi<{ success: boolean }>('red:logout').catch(() => {})
  },

  changePassword: async (contrasenaActual: string, contrasenaNueva: string) => {
    const user = useAuthStore.getState().usuario
    if (!user) return { success: false, error: 'No logged in user' }
    try {
      const result = await callApi<{ success: boolean; error?: string }>('usuarios:change-password', {
        usuario_id: user.id,
        contrasena_actual: contrasenaActual,
        contrasena_nueva: contrasenaNueva,
      })
      if (result.success) {
        // Actualizar el flag en el store y localStorage
        const updatedUser = { ...user, debe_cambiar_contrasena: 0 }
        set({ usuario: updatedUser })
        localStorage.setItem('tog_user', JSON.stringify(updatedUser))
      }
      return result
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  },

  clearError: () => set({ error: null }),
})

export const useAuthStore = create<AuthState>(authCreator)

// NO restaurar sesión — siempre pedir login
localStorage.removeItem('tog_user')

// ============================================
// SESSION TIMEOUT (30 minutos de inactividad)
// ============================================
const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutos
let sessionTimer: ReturnType<typeof setTimeout> | null = null

function resetSessionTimer() {
  if (sessionTimer) clearTimeout(sessionTimer)
  sessionTimer = setTimeout(() => {
    const state = useAuthStore.getState()
    if (state.isAuthenticated) {
      state.logout()
      // Recargar para mostrar login
      window.location.reload()
    }
  }, SESSION_TIMEOUT_MS)
}

// Escuchar actividad del usuario para resetear timer
const activityEvents = ['mousedown', 'keydown', 'scroll', 'touchstart']
function setupSessionTimeout() {
  activityEvents.forEach((event) => {
    window.addEventListener(event, resetSessionTimer, { passive: true })
  })
  resetSessionTimer()
}

// Iniciar timeout si hay sesión activa
if (useAuthStore.getState().isAuthenticated) {
  setupSessionTimeout()
}

// Reiniciar timer cuando se inicie sesión
useAuthStore.subscribe((state, prevState) => {
  if (state.isAuthenticated && !prevState.isAuthenticated) {
    setupSessionTimeout()
  } else if (!state.isAuthenticated && prevState.isAuthenticated) {
    if (sessionTimer) clearTimeout(sessionTimer)
    activityEvents.forEach((event) => {
      window.removeEventListener(event, resetSessionTimer)
    })
  }
})
