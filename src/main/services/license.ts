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

interface SignedLicenseState extends LicenseState {
  hmac: string
}

interface LicenseValidation {
  valid: boolean
  license: LicenseData | null
  error: string | null
  daysRemaining: number | null
}

function getLicensePath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'license.key')
  }
  return path.join(process.cwd(), 'license.key')
}

function getLicenseDbPath(): string {
  if (app.isPackaged) {
    return path.join(app.getPath('userData'), 'license.json')
  }
  return path.join(process.cwd(), 'data', 'license.json')
}

function getHmacKey(): string {
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
  return crypto.createHash('sha256').update(mac || 'unknown-license-state').digest('hex')
}

function signState(state: LicenseState): string {
  const payload = JSON.stringify(state)
  return crypto.createHmac('sha256', getHmacKey()).update(payload).digest('hex')
}

function verifyStateHmac(signed: SignedLicenseState): boolean {
  const { hmac, ...state } = signed
  return hmac === signState(state)
}

function isLicenseExpired(license: LicenseData): boolean {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fechaExpiracion = new Date(license.expira + 'T23:59:59')
  return hoy > fechaExpiracion
}

export function validateLicense(): LicenseValidation {
  const licensePath = getLicensePath()

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

    if (!license.cliente || !license.expira || !license.firma || !license.id) {
      return {
        valid: false,
        license,
        error: t('errors.licenseNotValid'),
        daysRemaining: null,
      }
    }

    const dateCheck = detectDateManipulation()
    if (dateCheck.tampered) {
      return {
        valid: false,
        license,
        error: dateCheck.message,
        daysRemaining: null,
      }
    }

    const firmaValida = verifyLicenseSignature(license)

    if (!firmaValida) {
      return {
        valid: false,
        license,
        error: t('errors.licenseSignatureInvalid'),
        daysRemaining: null,
      }
    }

    if (isLicenseExpired(license)) {
      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)
      const fechaExpiracion = new Date(license.expira + 'T23:59:59')
      const diasPasados = Math.floor((hoy.getTime() - fechaExpiracion.getTime()) / (1000 * 60 * 60 * 24))
      return {
        valid: false,
        license,
        error: `Licencia expirada hace ${diasPasados} día(s)`,
        daysRemaining: 0,
      }
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)
    const fechaExpiracion = new Date(license.expira + 'T23:59:59')
    const diasRestantes = Math.ceil((fechaExpiracion.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))

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

function readLicenseState(): LicenseState {
  const statePath = getLicenseDbPath()
  try {
    if (fs.existsSync(statePath)) {
      const raw = fs.readFileSync(statePath, 'utf8')
      const parsed = JSON.parse(raw) as SignedLicenseState
      if (!verifyStateHmac(parsed)) {
        return { lastKnownDate: null, totalDaysUsed: 0, lastCheckTimestamp: 0 }
      }
      const { hmac: _, ...state } = parsed
      return state
    }
  } catch {}
  return { lastKnownDate: null, totalDaysUsed: 0, lastCheckTimestamp: 0 }
}

function writeLicenseState(state: LicenseState): void {
  const statePath = getLicenseDbPath()
  const dir = path.dirname(statePath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const signed: SignedLicenseState = { ...state, hmac: signState(state) }
  fs.writeFileSync(statePath, JSON.stringify(signed, null, 2))
}

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
  return crypto.createHash('sha256').update(mac || 'unknown').digest('hex').slice(0, 16)
}

export function saveLicense(fileContent: string): { success: boolean; error?: string } {
  try {
    const license: LicenseData = JSON.parse(fileContent)

    if (!license.cliente || !license.expira || !license.firma || !license.id) {
      return { success: false, error: t('errors.licenseNotValid') }
    }

    const firmaValida = verifyLicenseSignature(license)
    if (!firmaValida) {
      return { success: false, error: t('errors.licenseSignatureInvalid') }
    }

    if (isLicenseExpired(license)) {
      return { success: false, error: 'No se puede importar una licencia expirada' }
    }

    const licensePath = getLicensePath()
    const dir = path.dirname(licensePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

    fs.writeFileSync(licensePath, JSON.stringify(license, null, 2))
    resetLicenseState()
    return { success: true }
  } catch (err: any) {
    return { success: false, error: `Error: ${err.message}` }
  }
}

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
  modulos: normalizeModules(license?.modules) as ModuleId[],
  maxPcs: readMaxPcs(license),
    declaraModulos: Array.isArray(license?.modules),
  }
}

function readMaxPcs(license: LicenseData | null): number {
  const maxPcs = (license as any)?.max_pcs
  if (typeof maxPcs === 'number' && Number.isInteger(maxPcs) && maxPcs >= 1 && maxPcs <= 20) return maxPcs
  return 1
}

export function getLicenseMaxPcs(): number {
  return readMaxPcs(validateLicense().license)
}

export function getActiveModules(): ModuleId[] {
  const validation = validateLicense()
  const modulos = normalizeModules(validation.license?.modules)
  if (!modulos.includes('comercializador')) {
    modulos.unshift('comercializador')
  }
  return modulos
}

export function resetLicenseState(): void {
  writeLicenseState({ lastKnownDate: null, totalDaysUsed: 0, lastCheckTimestamp: 0 })
}
