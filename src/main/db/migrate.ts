/**
 * Script standalone para ejecutar migraciones.
 * Uso: npx tsx src/main/db/migrate.ts
 */
import { initializeDatabase, closeDatabase } from './database'

try {
  console.log('[TOG Admin] Ejecutando migraciones...')
  initializeDatabase()
  console.log('[TOG Admin] Migraciones completadas.')
} catch (err) {
  console.error('[TOG Admin] Error en migraciones:', err)
  process.exit(1)
} finally {
  closeDatabase()
}
