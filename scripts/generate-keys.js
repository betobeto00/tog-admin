#!/usr/bin/env node
/**
 * Genera el par de claves RSA para el sistema de licencias.
 * 
 * Ejecutar UNA VEZ:
 *   node scripts/generate-keys.js
 * 
 * Archivos generados:
 *   keys/private.key  — Tu clave privada (NUNCA compartir)
 *   keys/public.key   — Clave pública (va dentro del .exe)
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const keysDir = path.join(__dirname, '..', 'keys')

console.log('🔐 Generando par de claves RSA (2048 bits)...')

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

// Guardar claves
if (!fs.existsSync(keysDir)) fs.mkdirSync(keysDir, { recursive: true })

fs.writeFileSync(path.join(keysDir, 'private.key'), privateKey)
fs.writeFileSync(path.join(keysDir, 'public.key'), publicKey)

console.log('✅ Claves generadas:')
console.log(`   🔑 keys/private.key  (${privateKey.length} bytes) — NUNCA compartir`)
console.log(`   🔓 keys/public.key   (${publicKey.length} bytes) — Va dentro del .exe`)
console.log('')
console.log('⚠️  IMPORTANTE:')
console.log('   - La private.key NUNCA debe salir de tu PC')
console.log('   - La public.key se integra en el código fuente')
console.log('   - Ambas se ignoran en .gitignore')
