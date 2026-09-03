/**
 * Genera el par de claves RSA (2048 bits) para firmar licencias.
 * Uso: node scripts/generate-keys.js [--force]
 * - Escribe keys/private.key (secreta) y keys/public.key (embebida en la app).
 * - Si ya existen claves, aborta a menos que se pase --force.
 */
const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const keysDir = path.resolve(__dirname, '..', 'keys')
const privatePath = path.join(keysDir, 'private.key')
const publicPath = path.join(keysDir, 'public.key')

const privateExists = fs.existsSync(privatePath)
const publicExists = fs.existsSync(publicPath)

if ((privateExists || publicExists) && !process.argv.includes('--force')) {
  console.error('⚠️  Ya existen claves en keys/:')
  if (privateExists) console.error(`   - ${path.relative(process.cwd(), privatePath)}`)
  if (publicExists) console.error(`   - ${path.relative(process.cwd(), publicPath)}`)
  console.error('')
  console.error('   Regenerarlas INVALIDARÁ todas las licencias emitidas y la')
  console.error('   PUBLIC_KEY embebida en src/main/services/license.ts.')
  console.error('   Si estás seguro, ejecuta: node scripts/generate-keys.js --force')
  process.exit(1)
}

console.log('🔐 Generando par de claves RSA (2048 bits)...')

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
})

fs.mkdirSync(keysDir, { recursive: true })
fs.writeFileSync(privatePath, privateKey)
fs.writeFileSync(publicPath, publicKey)

console.log('✅ Claves generadas:')
console.log(`   🔑 keys/private.key  (${Buffer.byteLength(privateKey)} bytes) — NUNCA compartir`)
console.log(`   🔓 keys/public.key   (${Buffer.byteLength(publicKey)} bytes)  — Va dentro del .exe`)
console.log('')
console.log('⚠️  IMPORTANTE:')
console.log('   - La private.key NUNCA debe salir de tu PC')
console.log('   - La public.key se integra en el código fuente (src/main/services/license.ts)')
console.log('   - Ambas se ignoran en .gitignore')
