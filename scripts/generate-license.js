/**
 * Genera una licencia firmada RSA para un cliente.
 * Uso: node scripts/generate-license.js "NOMBRE DEL CLIENTE" "AAAA-MM-DD" [MACHINE_ID] [--modules a,b,c]
 * - Necesita keys/private.key (generada con generate-keys.js).
 * - Escribe el .key en licenses/.
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const VERSION = '1.0.0'

// Módulos activables de TOG Platform. Mantener sincronizado con src/shared/modules.ts.
const MODULE_IDS = ['comercializador', 'distribuidor', 'productor', 'procesador', 'postventa']

const keysDir = path.resolve(__dirname, '..', 'keys')
const licensesDir = path.resolve(__dirname, '..', 'licenses')
const privateKeyPath = path.join(keysDir, 'private.key')

function fail(message) {
  console.error(`❌ ${message}`)
  process.exit(1)
}

function parseFlags(argv) {
  const out = { modules: null }
  for (const arg of argv) {
    if (arg.startsWith('--modules=')) {
      out.modules = arg.slice('--modules='.length)
    } else if (arg === '--modules') {
      fail('Formato inválido para --modules. Usa: --modules=distribuidor,productor')
    }
  }
  return out
}

function showUsage() {
  console.error('Uso: node scripts/generate-license.js "NOMBRE DEL CLIENTE" "AAAA-MM-DD" [MACHINE_ID] [--modules=a,b,c]')
  console.error('')
  console.error('Ejemplos:')
  console.error('  # Sin vincular a máquina (funciona en cualquier PC):')
  console.error('  node scripts/generate-license.js "Papelería El Sol" "2027-08-28"')
  console.error('')
  console.error('  # Vinculada a una máquina específica:')
  console.error('  node scripts/generate-license.js "Papelería El Sol" "2027-08-28" "a1b2c3d4e5f6"')
  console.error('')
  console.error('  # Con módulos adicionales activados (TOG Platform):')
  console.error('  node scripts/generate-license.js "Papelería El Sol" "2027-08-28" --modules=distribuidor')
  console.error('  node scripts/generate-license.js "Papelería El Sol" "2027-08-28" "a1b2c3d4e5f6" --modules=distribuidor,productor')
  process.exit(1)
}

const flags = parseFlags(process.argv.slice(2))
const positionals = process.argv.slice(2).filter((a) => !a.startsWith('--'))
const nombre = positionals[0]
const expira = positionals[1]
const machineId = positionals[2] || null

if (!nombre || !expira) {
  showUsage()
}

if (!/^\d{4}-\d{2}-\d{2}$/.test(expira)) {
  fail(`La fecha de expiración "${expira}" no es válida. Formato esperado: AAAA-MM-DD`)
}

const fechaExpiracion = new Date(expira + 'T00:00:00')
if (isNaN(fechaExpiracion.getTime())) {
  fail(`La fecha de expiración "${expira}" no es una fecha real.`)
}

if (!fs.existsSync(privateKeyPath)) {
  fail('No se encontró keys/private.key. Ejecuta primero: node scripts/generate-keys.js')
}

let modules = null
if (flags.modules) {
  const raw = flags.modules.split(',').map((s) => s.trim()).filter(Boolean)
  const unknown = raw.filter((m) => !MODULE_IDS.includes(m))
  if (unknown.length > 0) {
    fail(`Módulo(s) desconocido(s): ${unknown.join(', ')}. Válidos: ${MODULE_IDS.join(', ')}`)
  }
  modules = raw
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8')

// El orden de las claves es crítico: la app valida la firma con
// JSON.stringify(licencia sin "firma"), así que este orden debe coincidir
// con el orden de las claves dentro del archivo .key.
const id = crypto.randomBytes(6).toString('hex')
const payload = {
  cliente: nombre,
  expira,
  version: VERSION,
  machineId,
  ...(modules ? { modules } : {}),
  emitida: new Date().toISOString(),
  id,
}

const sign = crypto.createSign('SHA256')
sign.update(JSON.stringify(payload))
const firma = sign.sign(privateKey, 'base64')

const license = { ...payload, firma }

const sufijo = machineId ? machineId.slice(0, 8) : id.slice(0, 8)
const fileName = `license-${expira}-${sufijo}.key`

fs.mkdirSync(licensesDir, { recursive: true })
const filePath = path.join(licensesDir, fileName)
fs.writeFileSync(filePath, JSON.stringify(license, null, 2))

console.log('✅ Licencia generada:')
console.log(`   📄 ${path.join('licenses', fileName)}`)
console.log('')
console.log(`   Cliente: ${license.cliente}`)
console.log(`   Expira: ${license.expira}`)
console.log(`   Versión: ${license.version}`)
console.log(`   Machine: ${license.machineId || '— (cualquier PC)'}`)
console.log(`   Módulos: ${license.modules ? license.modules.join(', ') : '— (solo módulo base: Comercializador)'}`)
console.log(`   ID: ${license.id}`)
console.log('')
console.log('📋 Para activarla, el cliente importa el .key desde la pantalla de bloqueo de la app')
