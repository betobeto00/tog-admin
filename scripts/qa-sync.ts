/**
 * QA end-to-end del flujo "Sincronizar licencia" (sin UI, headless):
 *
 *   1. Levanta el backend TOG Platform (../tog-platform) con la clave privada real.
 *   2. Crea una empresa internacional (pais + documento) vía API admin.
 *   3. Emite una licencia con el módulo Distribuidor.
 *   4. Simula el lado app (canal license:sync): descarga con la api_key de la
 *      empresa y verifica la firma con la clave pública EMBEBIDA en la app.
 *
 * Pasos que requieren pantalla (clic en Electron) quedan en docs/QA-SYNC.md.
 *
 * Uso:  npx tsx scripts/qa-sync.ts   (desde la raíz de tog-admin)
 * Salida: 0 = OK · 1 = falló
 */
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { LICENSE_PUBLIC_KEY, verifyLicenseSignature } from '../src/main/services/license-crypto'

const HERE = path.dirname(fileURLToPath(import.meta.url)) // <repo>/scripts
const REPO = path.resolve(HERE, '..')
const PLATFORM = path.resolve(REPO, '..', 'tog-platform')
const PRIVATE_KEY = path.join(REPO, 'keys', 'private.key')

function assertFile(file: string, label: string): void {
  assert.ok(fs.existsSync(file), `${label} no existe: ${file}`)
}

async function main(): Promise<void> {
  assertFile(PRIVATE_KEY, 'Clave privada (keys/private.key)')
  assertFile(path.join(PLATFORM, 'src', 'server.js'), 'Backend tog-platform')

  // 0. La clave pública embebida DEBE ser la pareja de keys/private.key
  const priv = crypto.createPrivateKey(fs.readFileSync(PRIVATE_KEY, 'utf8'))
  const pubDeLaPrivada = crypto.createPublicKey(priv).export({ type: 'spki', format: 'pem' }).toString()
  const pubEmbebida = crypto.createPublicKey(LICENSE_PUBLIC_KEY).export({ type: 'spki', format: 'pem' }).toString()
  assert.equal(pubEmbebida, pubDeLaPrivada, 'La clave pública embebida NO es pareja de keys/private.key')
  console.log('✔  Clave pública embebida = pareja de keys/private.key')

  // 1. Backend con entorno aislado (DB temporal)
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'qa-tog-platform-'))
  process.env.TOG_PLATFORM_DATA = path.join(tmpDir, 'data')
  process.env.LICENSE_PRIVATE_KEY_PATH = PRIVATE_KEY
  process.env.ADMIN_API_KEY = 'qa-admin-key'
  process.env.STRIPE_SECRET_KEY = '' // QA sin Stripe

  const { startServer } = await import(pathToFileURL(path.join(PLATFORM, 'src', 'server.js')).href)
  const server = startServer({ port: 0 })
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`

  try {
    // 2. Empresa internacional + licencia con módulo Distribuidor
    const empresaRes = await fetch(base + '/api/empresas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'qa-admin-key' },
      body: JSON.stringify({ nombre: 'Flocos MX SA', pais: 'MX', documento: 'RFC-XYZ010203ABC', email_contacto: 'ops@flocos.mx' }),
    })
    assert.equal(empresaRes.status, 201, 'No se pudo crear la empresa')
    const { id, api_key: apiKey } = await empresaRes.json()

    const licRes = await fetch(base + `/api/empresas/${id}/licencias`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': 'qa-admin-key' },
      body: JSON.stringify({ cliente: 'Flocos MX SA', expira: '2027-12-31', modules: ['distribuidor'] }),
    })
    assert.equal(licRes.status, 201, 'No se pudo emitir la licencia')
    console.log('✔  Empresa MX creada y licencia con módulo distribuidor emitida')

    // 3. Simula el lado app: GET licencia activa con la api_key de la empresa
    const syncRes = await fetch(base + `/api/empresas/${id}/licencia`, {
      headers: { 'x-api-key': apiKey, Accept: 'application/json' },
    })
    assert.equal(syncRes.status, 200, 'El endpoint de licencia activa falló')
    const { licencia } = await syncRes.json()

    // 4. Validación exacta que hace la app (misma función de src/main)
    assert.ok(licencia && typeof licencia.firma === 'string', 'La respuesta no trae licencia firmada')
    assert.equal(verifyLicenseSignature(licencia), true, 'La firma NO valida con la clave pública de la app')
    assert.ok((licencia.modules || []).includes('distribuidor'), 'La licencia no incluye el módulo distribuidor')
    assert.ok(licencia.expira >= '2027-12-31', 'Fecha de expiración inesperada')
    console.log('✔  Firma RSA válida contra la clave pública embebida — módulo distribuidor presente')

    console.log('\n✅ QA sync OK: backend + firma + módulos (distribuidor) listos para el botón “Sincronizar”.')
  } finally {
    server.close()
    const { closeDatabase } = await import(pathToFileURL(path.join(PLATFORM, 'src', 'db.js')).href)
    closeDatabase()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}

main().catch((err) => {
  console.error('\n❌ QA sync FALLÓ:', err?.message || err)
  process.exit(1)
})
