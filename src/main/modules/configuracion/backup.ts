import { dialog } from 'electron'
import { handleIpc } from '../../core/auth/ipc-guard'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { getDatabase, closeDatabase, initializeDatabase, getDbPath } from '../../db/database'
import { t } from '../../i18n'
import { checkPermissionOrFail } from '../../core/auth'
import { hasImagenesDir, getImagenesDir } from '../../services/imagenes'
import { logger } from '../../services/logger'

function copyDirRecursive(src: string, dest: string): void {
  if (!fs.existsSync(src)) return
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) {
      copyDirRecursive(from, to)
    } else {
      fs.copyFileSync(from, to)
    }
  }
}

export function registerBackupHandlers(): void {
  handleIpc('backup:create', async (_event, data?: { ruta?: string; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'backup:create', 'config_backup')
    if (fail) return fail
    try {
      const dbPath = getDbPath()
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: t('errors.dbNotFound') }
      }

      let targetPath = data?.ruta
      if (!targetPath) {
        const result = await dialog.showSaveDialog({
          title: 'Crear Backup',
          defaultPath: `tog-admin-backup-${new Date().toISOString().split('T')[0]}.db`,
          filters: [{ name: 'SQLite Database', extensions: ['db'] }],
        })
        if (result.canceled || !result.filePath) {
          return { success: false, error: t('errors.operationCancelled') }
        }
        targetPath = result.filePath
      }

      const dir = path.dirname(targetPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }

      fs.copyFileSync(dbPath, targetPath)

      if (hasImagenesDir()) {
        copyDirRecursive(getImagenesDir(), `${targetPath}.imagenes`)
      }

      return { success: true, path: targetPath }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  handleIpc('backup:restore', async (_event, data?: { ruta?: string; usuario_id?: number }) => {
    const fail = checkPermissionOrFail(data, 'backup:restore', 'config_backup')
    if (fail) return fail
    try {
      let sourcePath = data?.ruta
      if (!sourcePath) {
        const result = await dialog.showOpenDialog({
          title: 'Restaurar Backup',
          filters: [{ name: 'SQLite Database', extensions: ['db'] }],
          properties: ['openFile'],
        })
        if (result.canceled || !result.filePaths.length) {
          return { success: false, error: t('errors.operationCancelled') }
        }
        sourcePath = result.filePaths[0]
      }

      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: t('errors.fileNotFound') }
      }

      const fd = fs.openSync(sourcePath, 'r')
      const buf = Buffer.alloc(16)
      fs.readSync(fd, buf, 0, 16, 0)
      fs.closeSync(fd)
      const magic = buf.toString('utf8', 0, 16)
      if (!magic.startsWith('SQLite format')) {
        return { success: false, error: t('errors.invalidDbFile') }
      }

      const dbPath = getDbPath()

      closeDatabase()

      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, dbPath + '.bak')
      }

      fs.copyFileSync(sourcePath, dbPath)

      const imagenesSrc = `${sourcePath}.imagenes`
      if (fs.existsSync(imagenesSrc)) {
        copyDirRecursive(imagenesSrc, getImagenesDir())
      }

      initializeDatabase()

      return { success: true }
    } catch (err: any) {
      try {
        const dbPath = getDbPath()
        if (fs.existsSync(dbPath + '.bak')) {
          fs.copyFileSync(dbPath + '.bak', dbPath)
        }
        initializeDatabase()
      } catch {}
      return { success: false, error: err.message }
    }
  })

  handleIpc('db:reset', async (_event, data?: any) => {
    const fail = checkPermissionOrFail(data, 'db:reset', 'config_db_reset')
    if (fail) return fail
    try {
      const dbPath = getDbPath()
      if (!fs.existsSync(dbPath)) {
        return { success: false, error: t('errors.dbNotFound') }
      }

      closeDatabase()

      fs.copyFileSync(dbPath, dbPath + '.pre-reset')

      fs.unlinkSync(dbPath)
      try { fs.unlinkSync(dbPath + '-wal') } catch {}
      try { fs.unlinkSync(dbPath + '-shm') } catch {}
      try { fs.unlinkSync(dbPath + '-journal') } catch {}

      initializeDatabase()

      logger.info('backup', 'Base de datos reseteada por admin')
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}