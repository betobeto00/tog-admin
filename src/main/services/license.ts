import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'
import { t } from '../i18n'
import { normalizeModules, type ModuleId } from '../../shared/modules'
import { LICENSE_PUBLIC_KEY, verifyLicenseSignature } from './license-crypto'

interface LicenseData {
  cliente: string
  expira: string
  version: string
  machineId: string | null
  emitida: string
  id: string
  /** Módulos activados (TOG Platform). Opcional: las licencias v1 no lo traen. */
  modules?: string[]
  firma: string
}

// Estado local de licencia (protección anti-tampering)
interface LicenseState {
  lastKnownDate: string | null  // Última fecha del sistema registrada
  totalDaysUsed: number         // Días totales de uso
  lastCheckTimestamp: number    // Timestamp del último check
}

interface LicenseValidation {
  valid: boolean
  license: LicenseData | null
  error: string | null
  daysRemaining: number | null
}

// Ruta del archivo de licencia
function getLicensePath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'license.key')
  }
  return path.join(process.cwd(), 'license.key')
}

// Ruta de la DB para guardar estado de licencia
function getLicenseDbPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'license.json')
  }
  return path.join(process.cwd(), 'data', 'license.json')
}

/**
 * Valida el archivo de licencia
 */
export function validateLicense(): LicenseValidation {
  const licensePath = getLicensePath()

  // No hay archivo de licencia
  if (!fs.existsSync(licensePath)) {
    return {
      valid: false,
      license: null,
      error: t('errors.licenseFileNotFound'),
      daysRemaining: null,
    }
  }

  try {
    const raw = fs.readFileSync(licensePath, 'utf8')
    const license: LicenseData = JSON.parse(raw)

    // Verificar campos requeridos
    if (!license.cliente || !license.expira || !license.firma || !license.id) {
      return {
        valid: false,
        license,
        error: t('errors.licenseNotValid'),
        daysRemaining: null,
      }
    }

    // 🔒 Anti-tampering: detectar manipulación del reloj del sistema
    const dateCheck = detectDateManipulation()
    if (dateCheck.tampered) {
      return {
        valid: false,
        license,
        error: dateCheck.message,
        daysRemaining: null,
      }
    }

    // Verificar firma RSA
    const firmaValida = verifyLicenseSignature(license)

    if (!firmaValida) {
      return {
        valid: false,
        license,
        error: t('errors.licenseSignatureInvalid'),
        daysRemaining: null,
      }
    }

    // Verificar expiración
    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaExpiracion = new Date(license.expira + 'T23:59:59')
    
    if (hoy > fechaExpiracion) {
      const diasPasados = Math.floor((hoy.getTime() - fechaExpiracion.getTime()) / (1000 * 60 * 60 * 24))
      return {
        valid: false,
        license,
        error: `Licencia expirada hace ${diasPasados} día(s)`,
        daysRemaining: 0,
      }
    }

    // Calcular días restantes
    const diasRestantes = Math.ceil((fechaExpiracion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

    // Verificar máquina (opcional)
    if (license.machineId) {
      const currentMachineId = getMachineId()
      if (currentMachineId !== license.machineId) {
        return {
          valid: false,
          license,
          error: t('errors.licenseWrongMachine'),
          daysRemaining: diasRestantes,
        }
      }
    }

    return {
      valid: true,
      license,
      error: null,
      daysRemaining: diasRestantes,
    }
  } catch (err: any) {
    return {
      valid: false,
      license: null,
      error: `Error leyendo licencia: ${err.message}`,
      daysRemaining: null,
    }
  }
}

/**
 * Lee el estado local de la licencia (anti-tampering)
 */
function readLicenseState(): LicenseState {
  const statePath = getLicenseDbPath()
  try {
    if (fs.existsSync(statePath)) {
      const raw = fs.readFileSync(statePath, 'utf8')
      return JSON.parse(raw)
    }
  } catch {}
  return { lastKnownDate: null, totalDaysUsed: 0, lastCheckTimestamp: 0 }
}

/**
 * Guarda el estado local de la licencia
 */
function writeLicenseState(state: LicenseState): void {
  const statePath = getLicenseDbPath()
  const dir = path.dirname(statePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2))
}

/**
 * Protección anti-tampering: detecta si el usuario retrocedió la fecha del sistema
 */
function detectDateManipulation(): { tampered: boolean; message: string } {
  const state = readLicenseState()
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  if (state.lastKnownDate) {
    const lastDate = new Date(state.lastKnownDate)
    const currentDate = new Date(todayStr)

    if (currentDate < lastDate) {
      return {
        tampered: true,
        message: `Fecha del sistema manipulada. Última fecha registrada: ${state.lastKnownDate}, fecha actual: ${todayStr}. Restaure la fecha correcta del sistema.`,
      }
    }
  }

  writeLicenseState({
    ...state,
    lastKnownDate: todayStr,
    lastCheckTimestamp: Date.now(),
    totalDaysUsed: state.totalDaysUsed + (state.lastKnownDate && todayStr !== state.lastKnownDate ? 1 : 0),
  })

  return { tampered: false, message: '' }
}

/**
 * Obtiene un ID único de la máquina
 */
export function getMachineId(): string {
  const interfaces = os.networkInterfaces()
  let mac = ''
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] || []) {
      if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
        mac = iface.mac
        break
      }
    }
    if (mac) break
  }
  // Hash del MAC address para ID estable
  return crypto.createHash('sha256').update(mac || 'unknown').digest('hex').slice(0, 16)
}

/**
 * Guarda la licencia desde el renderer (importar archivo)
 */
export function saveLicense(fileContent: string): { success: boolean; error?: string } {
  try {
    const license: LicenseData = JSON.parse(fileContent)
    
    // Validar que sea una licencia válida antes de guardar
    if (!license.cliente || !license.expira || !license.firma || !license.id) {
      return { success: false, error: t('errors.licenseNotValid') }
    }

    // Verificar firma
    const firmaValida = verifyLicenseSignature(license)

    if (!firmaValida) {
      return { success: false, error: t('errors.licenseSignatureInvalid') }
    }

    // Guardar
    const licensePath = getLicensePath()
    const dir = path.dirname(licensePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    
    fs.writeFileSync(licensePath, JSON.stringify(license, null, 2))
    // Resetear estado de tracking para la nueva licencia
    resetLicenseState()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: `Error: ${err.message}` }
  }
}

/**
 * Obtiene el estado actual de la licencia para el renderer
 */
export function getLicenseStatus() {
  const validation = validateLicense()
  const state = readLicenseState()
  const license = validation.license
  return {
    valid: validation.valid,
    cliente: license?.cliente || null,
    expira: license?.expira || null,
    diasRestantes: validation.daysRemaining,
    error: validation.error,
    machineId: getMachineId(),
    totalDaysUsed: state.totalDaysUsed || 0,
  /** Módulos activos declarados por la licencia (vacío = solo el módulo base) */
  modulos: normalizeModules(license?.modules) as ModuleId[],
  /** Máximo de PCs en red local (Base + hijas). Default 1 = solo la Base. */
  maxPcs: readMaxPcs(license),
    /** true si la licencia declara el campo modules (v2) */
    declaraModulos: Array.isArray(license?.modules),
  }
}

function readMaxPcs(license: LicenseData | null): number {
  const maxPcs = (license as any)?.max_pcs
  if (typeof maxPcs === 'number' && Number.isInteger(maxPcs) && maxPcs >= 1 && maxPcs <= 20) return maxPcs
  return 1
}

/**
 * Máximo de PCs que puede servir esta licencia en red local (Base + hijas).
 */
export function getLicenseMaxPcs(): number {
  return readMaxPcs(validateLicense().license)
}

/**
 * Módulos activos según la licencia vigente (el módulo base siempre está activo).
 */
export function getActiveModules(): ModuleId[] {
  const validation = validateLicense()
  const modulos = normalizeModules(validation.license?.modules)
  if (!modulos.includes('comercializador')) {
    modulos.unshift('comercializador')
  }
  return modulos
}

/**
 * Resetea el estado de tracking (al importar nueva licencia)
 */
export function resetLicenseState(): void {
  writeLicenseState({ lastKnownDate: null, totalDaysUsed: 0, lastCheckTimestamp: 0 })
}
