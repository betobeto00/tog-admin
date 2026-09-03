import crypto from 'crypto'

// Clave pública embebida en la app (generada con generate-keys.js).
// La pareja privada nunca viaja en el repo: la tiene el backend TOG Platform
// (o el generador local de licencias). Esta clave valida TODA licencia firmada.
export const LICENSE_PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA39zIsIGhsA5K+BgIT03C
l96QmwXiDykF5KXj7vmMqXwE6am9bPbcAKBC+pBRdiGHreo+ND8Bpjt0MOSCC5pJ
RLIwU9VreGvyMoD+gFoLiIVWbYNUaxG57RvCOjDfwKhz0cGUmy7ahe2YY/gsGK8J
p2lpCrKA9hf7VoevShjyKCpGYYBYPAWdWZ6scebodH9KDEMpk9fV4V9mjjD44Ouz
7pXWCKBNYEUQa02FcnhX5ff+W9GSdvfzT3ID8wayKac93IP8nOczY9nSirOC+0TJ
DvZrxqLgZP9h4uAeYeZAlUn4SbtDahbJfA2tolW6punhkKZSXgtsMw5tIeYzqPl1
TQIDAQAB
-----END PUBLIC KEY-----`

/**
 * Verifica la firma RSA-SHA256 (PKCS#1 v1.5, base64) de una licencia.
 * La firma se calculó sobre JSON.stringify del payload SIN la clave `firma`,
 * preservando el orden de claves usado por el firmante.
 */
export function verifyLicenseSignature(
  license: object | null | undefined,
  publicKey: string = LICENSE_PUBLIC_KEY,
): boolean {
  if (!license || typeof license !== 'object' || Array.isArray(license)) return false
  const record = license as Record<string, unknown>
  const firma = record.firma
  if (typeof firma !== 'string' || !firma) return false
  const { firma: _omitida, ...dataToVerify } = record
  const verify = crypto.createVerify('SHA256')
  verify.update(JSON.stringify(dataToVerify))
  return verify.verify(publicKey, firma, 'base64')
}
