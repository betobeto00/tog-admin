import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import os from 'os'

vi.mock('electron', () => ({
  app: {
    isPackaged: false,
    getPath: () => '/tmp/mock-userdata',
  },
}))

vi.mock('./license-crypto', () => ({
  LICENSE_PUBLIC_KEY: '',
  verifyLicenseSignature: () => true,
}))

const TMP_DIR = path.join(os.tmpdir(), `license-test-${Date.now()}`)

beforeEach(() => {
  fs.mkdirSync(TMP_DIR, { recursive: true })
  process.cwd = () => TMP_DIR
})

afterEach(() => {
  fs.rmSync(TMP_DIR, { recursive: true, force: true })
})

function crearLicenciaValida(overrides: Record<string, unknown> = {}) {
  const payload = {
    cliente: 'Test Corp',
    expira: '2099-12-31',
    version: '1.0.0',
    machineId: null,
    modules: ['distribuidor'],
    emitida: new Date().toISOString(),
    id: crypto.randomBytes(6).toString('hex'),
    firma: 'fake-signature',
    ...overrides,
  }
  return payload
}

describe('license integrity — saveLicense rejects expired', () => {
  it('rechaza licencia expirada al importar', async () => {
    const { saveLicense } = await import('./license')
    const licencia = crearLicenciaValida({ expira: '2020-01-01' })
    const result = saveLicense(JSON.stringify(licencia))
    expect(result.success).toBe(false)
    expect(result.error).toContain('expirada')
  })

  it('acepta licencia vigente', async () => {
    const { saveLicense } = await import('./license')
    const licencia = crearLicenciaValida({ expira: '2099-12-31' })
    const result = saveLicense(JSON.stringify(licencia))
    expect(result.success).toBe(true)
  })
})

describe('license integrity — HMAC state file', () => {
  it('readLicenseState retorna estado por defecto si el archivo no tiene HMAC', async () => {
    const statePath = path.join(TMP_DIR, 'data', 'license.json')
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    fs.writeFileSync(statePath, JSON.stringify({ lastKnownDate: '2026-01-01', totalDaysUsed: 5, lastCheckTimestamp: 1000 }))

    const { getLicenseStatus } = await import('./license')
    const status = getLicenseStatus()
    expect(status.totalDaysUsed).toBe(0)
  })

  it('readLicenseState descarta archivo con HMAC inválido', async () => {
    const statePath = path.join(TMP_DIR, 'data', 'license.json')
    fs.mkdirSync(path.dirname(statePath), { recursive: true })
    fs.writeFileSync(statePath, JSON.stringify({
      lastKnownDate: '2026-01-01',
      totalDaysUsed: 999,
      lastCheckTimestamp: 1000,
      hmac: 'deadbeef',
    }))

    const { getLicenseStatus } = await import('./license')
    const status = getLicenseStatus()
    expect(status.totalDaysUsed).toBe(0)
  })
})
