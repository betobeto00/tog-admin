import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

let loaded = false

export function loadEnv(): void {
  if (loaded) return
  loaded = true

  if (app.isPackaged) {
    const userDataFile = path.join(app.getPath('userData'), '.env')
    const resourcesFile = path.join(process.resourcesPath, '.env')

    if (!fs.existsSync(userDataFile) && fs.existsSync(resourcesFile)) {
      try {
        fs.mkdirSync(path.dirname(userDataFile), { recursive: true })
        fs.copyFileSync(resourcesFile, userDataFile)
        console.log(`[env] Seeded .env in userData from ${resourcesFile}`)
      } catch (err: any) {
        console.warn(`[env] Could not seed .env: ${err?.message || err}`)
      }
    }

    if (fs.existsSync(userDataFile)) {
      dotenv.config({ path: userDataFile, quiet: true })
      console.log(`[env] Loaded .env from ${userDataFile}`)
    } else if (fs.existsSync(resourcesFile)) {
      dotenv.config({ path: resourcesFile, quiet: true })
      console.log(`[env] Loaded .env from ${resourcesFile}`)
    }
  } else {
    const cwdFile = path.join(process.cwd(), '.env')
    if (fs.existsSync(cwdFile)) {
      dotenv.config({ path: cwdFile, quiet: true })
      console.log(`[env] Loaded .env from ${cwdFile}`)
    }
  }
}
