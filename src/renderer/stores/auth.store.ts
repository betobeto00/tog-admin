import { create } from 'zustand'

interface Usuario {
  id: number
  usuario: string
  nombre: string
  rol: 'admin' | 'cajero'
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

export const useAuthStore = create<AuthState>((set) => ({
  usuario: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,

  login: async (usuario: string, contrasena: string) => {
    set({ isLoading: true, error: null })

    try {
      const result = await window.api.auth.login({ usuario, contrasena })

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
          error: result.error || 'Error de autenticación',
        })
        return false
      }
    } catch (err: any) {
      set({ isLoading: false, error: err.message || 'Error de conexión' })
      return false
    }
  },

  logout: () => {
    set({ usuario: null, isAuthenticated: false, error: null })
    localStorage.removeItem('tog_user')
  },

  changePassword: async (contrasenaActual: string, contrasenaNueva: string) => {
    const user = useAuthStore.getState().usuario
    if (!user) return { success: false, error: 'No hay usuario logueado' }
    try {
      const result = await window.api.usuarios.changePassword({
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
}))

// Restaurar sesión del localStorage al cargar
const savedUser = localStorage.getItem('tog_user')
if (savedUser) {
  try {
    const usuario = JSON.parse(savedUser)
    useAuthStore.setState({ usuario, isAuthenticated: true })
  } catch {
    localStorage.removeItem('tog_user')
  }
}
