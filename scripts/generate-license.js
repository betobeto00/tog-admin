#!/usr/bin/env node
/**
 * Genera un archivo de licencia para un cliente.
 * 
 * Uso:
 *   node scripts/generate-license.js "Papelería Juan" "2027-08-28"
 *   node scripts/generate-license.js "Papelería Juan" "2027-08-28" --machine ABC123
 * 
 * Opciones:
 *   --machine ID    Vincula la licencia a un ID de máquina específico
 *   --version 1.0.0 Versión mínima permitida (default: 1.0.0)
 * 
 * Archivo generado:
 *   licenses/license-YYYY-MM-DD-<hash>.key
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const args = process.argv.slice(2)
const flags = args.filter(a => a.startsWith('--'))
const positional = args.filter(a => !a.startsWith('--'))

function getFlag(name) {
  const idx = flags.indexOf(`--${name}`)
  if (idx === -1) return null
  return flags[idx + 1] || null
}

if (positional.length < 2) {
  console.log('Uso: node scripts/generate-license.js "Nombre del Cliente" "AAAA-MM-DD"')
  console.log('')
  console.log('Opciones:')
  console.log('  --machine ID    Vincular a máquina específica')
  console.log('  --version 1.0.0 Versión mínima (default: 1.0.0)')
  console.log('')
  console.log('Ejemplo:')
  console.log('  node scripts/generate-license.js "Papelería Juan" "2027-08-28"')
  process.exit(1)
}

const cliente = positional[0]
const expira = positional[1]
const machineId = getFlag('machine')
const version = getFlag('version') || '1.0.0'

// Validar formato de fecha
if (!/^\d{4}-\d{2}-\d{2}$/.test(expira)) {
  console.error('❌ Formato de fecha inválido. Usa: AAAA-MM-DD')
  process.exit(1)
}

// Verificar que la private key existe
const privateKeyPath = path.join(__dirname, '..', 'keys', 'private.key')
if (!fs.existsSync(privateKeyPath)) {
  console.error('❌ No se encontró keys/private.key')
  console.error('   Ejecuta primero: node scripts/generate-keys.js')
  process.exit(1)
}

const privateKey = fs.readFileSync(privateKeyPath, 'utf8')

// Crear payload de la licencia
const license = {
  cliente,
  expira,
  version,
  machineId: machineId || null,
  emitida: new Date().toISOString().split('T')[0],
  id: crypto.randomBytes(8).toString('hex'),
}

// Firmar con RSA
const sign = crypto.createSign('SHA256')
sign.update(JSON.stringify(license))
const firma = sign.sign(privateKey, 'base64')

// Crear archivo de licencia
const licenseFile = {
  ...license,
  firma,
}

// Guardar
const licensesDir = path.join(__dirname, '..', 'licenses')
if (!fs.existsSync(licensesDir)) fs.mkdirSync(licensesDir, { recursive: true })

const filename = `license-${expira}-${license.id.slice(0, 8)}.key`
const filepath = path.join(licensesDir, filename)
fs.writeFileSync(filepath, JSON.stringify(licenseFile, null, 2))

console.log('✅ Licencia generada:')
console.log(`   📄 ${filepath}`)
console.log('')
console.log('   Cliente:', cliente)
console.log('   Expira:', expira)
console.log('   Versión:', version)
console.log('   Machine:', machineId || 'Sin vincular')
console.log('   ID:', license.id)
console.log('')
console.log('📋 Para usarla, copia el archivo .key junto al .exe de la app')
