import { describe, it, expect } from 'vitest'
import crypto from 'crypto'
import { LICENSE_PUBLIC_KEY, verifyLicenseSignature } from './license-crypto'

function firmar(payload: Record<string, unknown>, privateKey: crypto.KeyObject): string {
  const sign = crypto.createSign('SHA256')
  sign.update(JSON.stringify(payload))
  return sign.sign(privateKey, 'base64')
}

describe('LICENSE_PUBLIC_KEY', () => {
  it('es una clave RSA pública válida', () => {
    expect(() => crypto.createPublicKey(LICENSE_PUBLIC_KEY)).not.toThrow()
  })
})

describe('verifyLicenseSignature', () => {
  it('acepta una firma correcta firmada sobre el payload sin la clave firma', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

    const payload = {
      cliente: 'AgroMaíz C.A.',
      expira: '2099-12-31',
      version: '1.0.0',
      machineId: null,
      modules: ['distribuidor'],
      emitida: '2026-09-02T00:00:00.000Z',
      id: 'abc123',
    }
    const licencia = { ...payload, firma: firmar(payload, privateKey) }
    expect(verifyLicenseSignature(licencia, publicPem)).toBe(true)
  })

  it('rechaza el payload manipulado después de firmar', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()
    const payload = { cliente: 'Original', expira: '2026-12-31', machineId: null, emitida: '2026-09-01', id: 'x1' }
    const manipulada = { ...payload, cliente: 'Original MODIFICADO', firma: firmar(payload, privateKey) }
    expect(verifyLicenseSignature(manipulada, publicPem)).toBe(false)
  })

  it('rechaza entradas sin firma o malformadas', () => {
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const publicPem = publicKey.export({ type: 'spki', format: 'pem' }).toString()

    expect(verifyLicenseSignature(null, publicPem)).toBe(false)
    expect(verifyLicenseSignature(undefined, publicPem)).toBe(false)
    expect(verifyLicenseSignature({ cliente: 'X', expira: '2026-12-31' }, publicPem)).toBe(false)
    expect(verifyLicenseSignature({ cliente: 'X', firma: '' }, publicPem)).toBe(false)
    expect(verifyLicenseSignature([1, 2] as any, publicPem)).toBe(false)

    const payload = { cliente: 'X', expira: '2026-12-31', machineId: null, emitida: '2026-09-01', id: 'x1' }
    const licencia = { ...payload, firma: firmar(payload, privateKey) }
    // firma válida pero con OTRA clave pública
    const { publicKey: otra } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 })
    const otraPem = otra.export({ type: 'spki', format: 'pem' }).toString()
    expect(verifyLicenseSignature(licencia, otraPem)).toBe(false)
  })
})
