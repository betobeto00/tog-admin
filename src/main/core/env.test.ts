import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import path from 'path'
import fs from 'fs'
import os from 'os'

const electronMock = { app: { isPackaged: false, getPath: vi.fn() } }
const configMock = vi.fn()

vi.mock('electron', () => electronMock)

vi.mock('dotenv', () => ({
  default: { config: configMock },
  config: configMock,
}))

async function loadFresh() {
  vi.resetModules()
  return import('./env')
}

describe('core/env loadEnv', () => {
  let tmp: string
  let userData: string
  let originalResourcesPath: string | undefined

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-env-test-'))
    userData = path.join(tmp, 'userdata')
    fs.mkdirSync(userData)
    configMock.mockReset()
    electronMock.app.isPackaged = false
    electronMock.app.getPath.mockImplementation(() => userData)
    originalResourcesPath = process.resourcesPath
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
    if (originalResourcesPath === undefined) {
      delete (process as any).resourcesPath
    } else {
      ;(process as any).resourcesPath = originalResourcesPath
    }
  })

  it('lee .env desde process.cwd() en dev', async () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'TELEGRAM_BOT_TOKEN=dev-token')
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmp)

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(configMock).toHaveBeenCalledWith(expect.objectContaining({ path: path.join(tmp, '.env') }))
    cwdSpy.mockRestore()
  })

  it('lee .env desde userData en producción (app empaquetada)', async () => {
    electronMock.app.isPackaged = true
    fs.writeFileSync(path.join(userData, '.env'), 'TELEGRAM_BOT_TOKEN=userdata-token')
    ;(process as any).resourcesPath = path.join(tmp, 'resources')

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(configMock).toHaveBeenCalledWith(expect.objectContaining({ path: path.join(userData, '.env') }))
  })

  it('copia .env desde resourcesPath a userData en el primer arranque', async () => {
    electronMock.app.isPackaged = true
    const resourcesPath = path.join(tmp, 'resources')
    fs.mkdirSync(resourcesPath)
    fs.writeFileSync(path.join(resourcesPath, '.env'), 'TELEGRAM_BOT_TOKEN=seed-token')
    ;(process as any).resourcesPath = resourcesPath

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(fs.existsSync(path.join(userData, '.env'))).toBe(true)
    expect(fs.readFileSync(path.join(userData, '.env'), 'utf8')).toContain('TELEGRAM_BOT_TOKEN=seed-token')
    expect(configMock).toHaveBeenCalledWith(expect.objectContaining({ path: path.join(userData, '.env') }))
  })

  it('respeta un .env existente en userData (no lo sobrescribe)', async () => {
    electronMock.app.isPackaged = true
    const resourcesPath = path.join(tmp, 'resources')
    fs.mkdirSync(resourcesPath)
    fs.writeFileSync(path.join(resourcesPath, '.env'), 'TELEGRAM_BOT_TOKEN=installer-token')
    fs.writeFileSync(path.join(userData, '.env'), 'TELEGRAM_BOT_TOKEN=operator-token')
    ;(process as any).resourcesPath = resourcesPath

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(fs.readFileSync(path.join(userData, '.env'), 'utf8')).toContain('operator-token')
    expect(fs.readFileSync(path.join(userData, '.env'), 'utf8')).not.toContain('installer-token')
  })

  it('en dev no llama dotenv si el archivo no existe', async () => {
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmp)

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(configMock).not.toHaveBeenCalled()
    cwdSpy.mockRestore()
  })

  it('es idempotente (carga una sola vez)', async () => {
    fs.writeFileSync(path.join(tmp, '.env'), 'TELEGRAM_BOT_TOKEN=x')
    const cwdSpy = vi.spyOn(process, 'cwd').mockReturnValue(tmp)

    const { loadEnv } = await loadFresh()
    loadEnv()
    loadEnv()
    loadEnv()

    expect(configMock).toHaveBeenCalledTimes(1)
    cwdSpy.mockRestore()
  })
})
