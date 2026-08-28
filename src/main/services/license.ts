import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'
import { app } from 'electron'

interface LicenseData {
  cliente: string
  expira: string
  version: string
  machineId: string | null
  emitida: string
  id: string
  firma: string
}

interface LicenseValidation {
  valid: boolean
  license: LicenseData | null
  error: string | null
  daysRemaining: number | null
}

// Public key embebida en la app (generada con generate-keys.js)
// Esta key se integra en el código fuente y viaja con el .exe
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA39zIsIGhsA5K+BgIT03C
l96QmwXiDykF5KXj7vmMqXwE6am9bPbcAKBC+pBRdiGHreo+ND8Bpjt0MOSCC5pJ
RLIwU9VreGvyMoD+gFoLiIVWbYNUaxG57RvCOjDfwKhz0cGUmy7ahe2YY/gsGK8J
p2lpCrKA9hf7VoevShjyKCpGYYBYPAWdWZ6scebodH9KDEMpk9fV4V9mjjD44Ouz
7pXWCKBNYEUQa02FcnhX5ff+W9GSdvfzT3ID8wayKac93IP8nOczY9nSirOC+0TJ
DvZrxqLgZP9h4uAeYeZAlUn4SbtDahbJfA2tolW6punhkKZSXgtsMw5tIeYzqPl1
TQIDAQAB
-----END PUBLIC KEY-----`

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
      error: 'No se encontró archivo de licencia (license.key)',
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
        error: 'Archivo de licencia corrupto o incompleto',
        daysRemaining: null,
      }
    }

    // Verificar firma RSA
    const { firma, ...dataToVerify } = license
    const verify = crypto.createVerify('SHA256')
    verify.update(JSON.stringify(dataToVerify))
    const firmaValida = verify.verify(PUBLIC_KEY, firma, 'base64')

    if (!firmaValida) {
      return {
        valid: false,
        license,
        error: 'Firma de licencia inválida — archivo manipulado',
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
          error: 'Licencia vinculada a otra máquina',
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
      return { success: false, error: 'Archivo no es una licencia válida' }
    }

    // Verificar firma
    const { firma, ...dataToVerify } = license
    const verify = crypto.createVerify('SHA256')
    verify.update(JSON.stringify(dataToVerify))
    const firmaValida = verify.verify(PUBLIC_KEY, firma, 'base64')

    if (!firmaValida) {
      return { success: false, error: 'Firma de licencia inválida' }
    }

    // Guardar
    const licensePath = getLicensePath()
    const dir = path.dirname(licensePath)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    
    fs.writeFileSync(licensePath, JSON.stringify(license, null, 2))
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
  return {
    valid: validation.valid,
    cliente: validation.license?.cliente || null,
    expira: validation.license?.expira || null,
    diasRestantes: validation.daysRemaining,
    error: validation.error,
    machineId: getMachineId(),
  }
}
