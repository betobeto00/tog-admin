import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'
import { logger } from '../services/logger'

let loaded = false

export function loadEnv(): void {
  if (loaded) return
  loaded = true

  if (app.isPackaged) {
    const userDataFile = path.join(app.getPath('userData'), '.env')
    const resourcesFile = path.join(process.resourcesPath, '.env')

    if (fs.existsSync(resourcesFile)) {
      try {
        fs.mkdirSync(path.dirname(userDataFile), { recursive: true })
        fs.copyFileSync(resourcesFile, userDataFile)
        logger.info('env', `Synced .env from installer to ${userDataFile}`)
      } catch (err: any) {
        logger.warn('env', `Could not sync .env: ${err?.message || err}`)
      }
    }

    if (fs.existsSync(userDataFile)) {
      dotenv.config({ path: userDataFile, quiet: true })
      logger.info('env', `Loaded .env from ${userDataFile}`)
    }
  } else {
    const cwdFile = path.join(process.cwd(), '.env')
    if (fs.existsSync(cwdFile)) {
      dotenv.config({ path: cwdFile, quiet: true })
      logger.info('env', `Loaded .env from ${cwdFile}`)
    }
  }
}
