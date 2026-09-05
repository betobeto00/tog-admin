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

  it('siembra .env desde resourcesPath a userData en el primer arranque', async () => {
    electronMock.app.isPackaged = true
    const resourcesPath = path.join(tmp, 'resources')
    fs.mkdirSync(resourcesPath)
    fs.writeFileSync(path.join(resourcesPath, '.env'), 'TELEGRAM_BOT_TOKEN=installer-token')
    ;(process as any).resourcesPath = resourcesPath

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(fs.existsSync(path.join(userData, '.env'))).toBe(true)
    expect(fs.readFileSync(path.join(userData, '.env'), 'utf8')).toContain('installer-token')
    expect(configMock).toHaveBeenCalledWith(expect.objectContaining({ path: path.join(userData, '.env') }))
  })

  it('sobrescribe userData/.env desde resourcesPath en cada arranque (instalador gana)', async () => {
    electronMock.app.isPackaged = true
    const resourcesPath = path.join(tmp, 'resources')
    fs.mkdirSync(resourcesPath)
    fs.writeFileSync(path.join(resourcesPath, '.env'), 'TELEGRAM_BOT_TOKEN=new-installer-token')
    fs.writeFileSync(path.join(userData, '.env'), 'TELEGRAM_BOT_TOKEN=old-operator-token')
    ;(process as any).resourcesPath = resourcesPath

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(fs.readFileSync(path.join(userData, '.env'), 'utf8')).toContain('new-installer-token')
    expect(fs.readFileSync(path.join(userData, '.env'), 'utf8')).not.toContain('old-operator-token')
  })

  it('lee .env desde userData cuando no hay resourcesPath (caso edge)', async () => {
    electronMock.app.isPackaged = true
    fs.writeFileSync(path.join(userData, '.env'), 'TELEGRAM_BOT_TOKEN=userdata-token')
    ;(process as any).resourcesPath = path.join(tmp, 'no-resources-here')

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(configMock).toHaveBeenCalledWith(expect.objectContaining({ path: path.join(userData, '.env') }))
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
