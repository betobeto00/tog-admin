import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { app } from 'electron'
import selfsigned from 'selfsigned'
import { logger } from './logger'

export interface TlsMaterial {
  key: crypto.KeyObject
  cert: crypto.X509Certificate
  certPem: string
  keyPem: string
  fingerprintSha256: string
}

export interface CertPaths {
  dir: string
  certFile: string
  keyFile: string
}

export const CERT_VALIDITY_DAYS = 365 * 5
export const CERT_KEY_SIZE = 2048

export function getCertPaths(): CertPaths {
  const dir = path.join(app.getPath('userData'), 'certs')
  return {
    dir,
    certFile: path.join(dir, 'red-base.pem'),
    keyFile: path.join(dir, 'red-base.key'),
  }
}

export function ensureCertDir(): void {
  const { dir } = getCertPaths()
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

export function certExists(): boolean {
  const { certFile, keyFile } = getCertPaths()
  return fs.existsSync(certFile) && fs.existsSync(keyFile)
}

export function loadCert(): TlsMaterial | null {
  if (!certExists()) return null
  const { certFile, keyFile } = getCertPaths()
  const certPem = fs.readFileSync(certFile, 'utf8')
  const keyPem = fs.readFileSync(keyFile, 'utf8')
  return materialFromPem(certPem, keyPem)
}

export interface GenerateCertOptions {
  commonName?: string
  validityDays?: number
}

export async function generateCert(opts: GenerateCertOptions = {}): Promise<TlsMaterial> {
  const validityDays = opts.validityDays ?? CERT_VALIDITY_DAYS
  const cn = opts.commonName ?? 'tog-admin-red-base'
  const attrs: Array<{ name: string; value: string }> = [
    { name: 'commonName', value: cn },
    { name: 'organizationName', value: 'OmniMargen / TOG Admin' },
    { name: 'organizationalUnitName', value: 'Red Local' },
  ]
  const pems = await selfsigned.generate(attrs, {
    keySize: CERT_KEY_SIZE,
    algorithm: 'sha256',
    notAfterDate: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
    extensions: [
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
      {
        name: 'subjectAltName',
        altNames: [
          { type: 2, value: cn },
          { type: 2, value: 'localhost' },
          { type: 7, ip: '127.0.0.1' },
          { type: 7, ip: '::1' },
        ],
      },
    ],
  })
  return materialFromPem(pems.cert, pems.private)
}

export function materialFromPem(certPem: string, keyPem: string): TlsMaterial {
  const cert = new crypto.X509Certificate(certPem)
  const key = crypto.createPrivateKey(keyPem)
  return {
    key,
    cert,
    certPem,
    keyPem,
    fingerprintSha256: cert.fingerprint256,
  }
}

export function saveCert(material: TlsMaterial): void {
  ensureCertDir()
  const { certFile, keyFile } = getCertPaths()
  fs.writeFileSync(certFile, material.certPem, { mode: 0o644 })
  fs.writeFileSync(keyFile, material.keyPem, { mode: 0o600 })
  logger.info(
    'red',
    `Certificado TLS persistido en ${path.dirname(certFile)} (fp=${material.fingerprintSha256.slice(0, 12)}…)`,
  )
}

export async function getOrCreateCert(): Promise<TlsMaterial> {
  const loaded = loadCert()
  if (loaded) return loaded
  const mat = await generateCert()
  saveCert(mat)
  return mat
}
