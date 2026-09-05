import bcrypt from 'bcryptjs'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { registrarSesion } from '../../services/red-session'

const MAX_LOGIN_ATTEMPTS = 5
const LOGIN_LOCKOUT_MS = 15 * 60 * 1000

const loginAttempts = new Map<string, { count: number; lastAttempt: number }>()

function recordFailedAttempt(usuario: string): void {
  const prev = loginAttempts.get(usuario) || { count: 0, lastAttempt: 0 }
  loginAttempts.set(usuario, { count: prev.count + 1, lastAttempt: Date.now() })
}

export function clearLoginAttempts(usuario: string): void {
  loginAttempts.delete(usuario)
}

export interface LoginInput {
  usuario: string
  contrasena: string
}

export interface LoginResult {
  success: boolean
  usuario?: any
  error?: string
}

/**
 * Login con sesión única: al autenticar se registra la sesión del usuario en
 * el par (PC) que hizo login. Si el usuario ya tiene sesión activa en OTRO
 * par, el login se rechaza. El par 'base' es la propia PC Base.
 */
export async function login(input: LoginInput, parId = 'base'): Promise<LoginResult> {
  const { usuario, contrasena } = input
  const attempts = loginAttempts.get(usuario)
  if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS && Date.now() - attempts.lastAttempt < LOGIN_LOCKOUT_MS) {
    const remaining = Math.ceil((LOGIN_LOCKOUT_MS - (Date.now() - attempts.lastAttempt)) / 60000)
    return { success: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${remaining} minutos.` }
  }

  const db = getDatabase()
  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario) as any
  if (!user) {
    recordFailedAttempt(usuario)
    return { success: false, error: t('errors.notFound') }
  }

  const validPassword = bcrypt.compareSync(contrasena, user.contrasena)
  if (!validPassword) {
    recordFailedAttempt(usuario)
    return { success: false, error: t('errors.wrongPassword') }
  }

  clearLoginAttempts(usuario)
  const { contrasena: _, ...usuarioSinPass } = user

  const sesion = registrarSesion(getDatabase(), user.id, parId)
  if (!sesion.ok) {
    return { success: false, error: sesion.error }
  }

  return { success: true, usuario: usuarioSinPass }
}