import { describe, it, expect, vi } from 'vitest'
import crypto from 'node:crypto'
import os from 'node:os'
import path from 'node:path'

vi.mock('electron', () => ({
  app: { getPath: () => path.join(os.tmpdir(), 'tog-admin-test') },
}))

import { generateCert, materialFromPem } from './red-cert'

describe('red-cert — certificado TLS del servidor de red', () => {
  it('genera un certificado autofirmado válido con los datos del negocio', async () => {
    const mat = await generateCert({ commonName: 'tog-admin-red-base', validityDays: 30 })
    const cert = new crypto.X509Certificate(mat.certPem)

    // El subject se arma desde los atributos: si un nombre de atributo no es
    // reconocido, la generación falla y el servidor de red no arranca en producción.
    expect(cert.subject).toContain('CN=tog-admin-red-base')
    expect(cert.subject).toContain('OU=Red Local')
    expect(cert.subject).toContain('O=OmniMargen / TOG Admin')
    // Autofirmado y usable: las PCs hijas conectan por IP local y localhost.
    expect(cert.verify(cert.publicKey)).toBe(true)
    expect(cert.subjectAltName).toContain('DNS:localhost')
    expect(cert.subjectAltName).toContain('127.0.0.1')
    expect(cert.publicKey.asymmetricKeyType).toBe('rsa')
  })

  it('materialFromPem devuelve la clave y el huella que usa el servidor', async () => {
    const mat = await generateCert({ commonName: 'tog-admin-red-base', validityDays: 30 })
    const material = materialFromPem(mat.certPem, mat.keyPem)

    expect(material.cert.subject).toBe(mat.cert.subject)
    expect(material.fingerprintSha256).toBe(mat.cert.fingerprint256)
    expect(material.key.asymmetricKeyType).toBe('rsa')
    // La clave privada corresponde al certificado.
    const publica = crypto.createPublicKey(material.key).export({ type: 'spki', format: 'pem' })
    const delCert = material.cert.publicKey.export({ type: 'spki', format: 'pem' })
    expect(publica).toBe(delCert)
  })
})
