import bcrypt from 'bcryptjs'
import { getDatabase } from '../../db/database'
import { t } from '../../i18n'
import { registrarSesion } from '../../services/red-session'

const LOCKOUT_THRESHOLDS = [
  { maxAttempts: 5, lockoutMs: 5 * 60 * 1000 },
  { maxAttempts: 10, lockoutMs: 15 * 60 * 1000 },
  { maxAttempts: 30, lockoutMs: 60 * 60 * 1000 },
]

const CLEANUP_AGE_MS = 24 * 60 * 60 * 1000

function getLockoutMs(attempts: number): number {
  for (const tier of LOCKOUT_THRESHOLDS) {
    if (attempts >= tier.maxAttempts) return tier.lockoutMs
  }
  return 0
}

function recordFailedAttempt(usuario: string, ip?: string): void {
  const db = getDatabase()
  db.prepare('INSERT INTO login_attempts (usuario, ip, exitoso) VALUES (?, ?, 0)').run(usuario, ip || null)
}

function clearLoginAttempts(usuario: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM login_attempts WHERE usuario = ? AND exitoso = 0').run(usuario)
}

function getFailedAttemptCount(usuario: string): number {
  const db = getDatabase()
  const row = db.prepare(
    "SELECT COUNT(*) AS c FROM login_attempts WHERE usuario = ? AND exitoso = 0 AND creado_en > datetime('now', '-1 day')",
  ).get(usuario) as { c: number }
  return row.c
}

function getLastFailedAttempt(usuario: string): number {
  const db = getDatabase()
  const row = db.prepare(
    "SELECT MAX(creado_en) AS last FROM login_attempts WHERE usuario = ? AND exitoso = 0",
  ).get(usuario) as { last: string | null }
  if (!row.last) return 0
  return new Date(row.last + 'Z').getTime()
}

function cleanupOldAttempts(): void {
  const db = getDatabase()
  db.prepare(
    "DELETE FROM login_attempts WHERE creado_en < datetime('now', '-1 day')",
  ).run()
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

export async function login(input: LoginInput, parId = 'base', ip?: string): Promise<LoginResult> {
  const { usuario, contrasena } = input

  cleanupOldAttempts()

  const failedCount = getFailedAttemptCount(usuario)
  if (failedCount > 0) {
    const lastAttempt = getLastFailedAttempt(usuario)
    const lockoutMs = getLockoutMs(failedCount)
    if (lockoutMs > 0 && Date.now() - lastAttempt < lockoutMs) {
      const remaining = Math.ceil((lockoutMs - (Date.now() - lastAttempt)) / 60000)
      return { success: false, error: `Demasiados intentos fallidos. Intenta de nuevo en ${remaining} minutos.` }
    }
  }

  const db = getDatabase()
  const user = db.prepare('SELECT * FROM usuarios WHERE usuario = ? AND activo = 1').get(usuario) as any
  if (!user) {
    recordFailedAttempt(usuario, ip)
    return { success: false, error: t('errors.wrongCredentials') }
  }

  const validPassword = bcrypt.compareSync(contrasena, user.contrasena)
  if (!validPassword) {
    recordFailedAttempt(usuario, ip)
    return { success: false, error: t('errors.wrongCredentials') }
  }

  clearLoginAttempts(usuario)
  const { contrasena: _, ...usuarioSinPass } = user

  const sesion = registrarSesion(getDatabase(), user.id, parId)
  if (!sesion.ok) {
    return { success: false, error: sesion.error }
  }

  return { success: true, usuario: usuarioSinPass }
}
