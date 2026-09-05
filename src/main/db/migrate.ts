/**
 * Script standalone para ejecutar migraciones.
 * Uso: npx tsx src/main/db/migrate.ts
 */
import { initializeDatabase, closeDatabase } from './database'
import { logger } from '../services/logger'

try {
  logger.info('db', 'Ejecutando migraciones...')
  initializeDatabase()
  logger.info('db', 'Migraciones completadas.')
} catch (err) {
  logger.error('db', 'Error en migraciones:', err)
  process.exit(1)
} finally {
  closeDatabase()
}
