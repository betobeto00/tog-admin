import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import dotenv from 'dotenv'

let loaded = false

export function loadEnv(): void {
  if (loaded) return
  loaded = true

  const file = app.isPackaged
    ? path.join(app.getPath('userData'), '.env')
    : path.join(process.cwd(), '.env')

  if (fs.existsSync(file)) {
    dotenv.config({ path: file, quiet: true })
    console.log(`[env] Loaded .env from ${file}`)
  }
}
