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

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'tog-env-test-'))
    configMock.mockReset()
    electronMock.app.isPackaged = false
    electronMock.app.getPath.mockReset()
  })

  afterEach(() => {
    fs.rmSync(tmp, { recursive: true, force: true })
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
    electronMock.app.getPath.mockReturnValue(tmp)
    fs.writeFileSync(path.join(tmp, '.env'), 'TELEGRAM_BOT_TOKEN=prod-token')

    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(configMock).toHaveBeenCalledWith(expect.objectContaining({ path: path.join(tmp, '.env') }))
  })

  it('no llama dotenv si el archivo no existe', async () => {
    const { loadEnv } = await loadFresh()
    loadEnv()

    expect(configMock).not.toHaveBeenCalled()
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
