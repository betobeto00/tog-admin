import { describe, it, expect, vi, beforeEach } from 'vitest'

const configValues: Record<string, string> = {}
const fetchMock = vi.fn()

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.8' },
  ipcMain: {
    handle: (channel: string, fn: any) => {
      handles[channel] = fn
    },
  },
}))

vi.mock('../../services/configCache', () => ({
  getConfig: (key: string, fallback = '') => configValues[key] ?? fallback,
}))

const handles: Record<string, (event: any, data: any) => Promise<any>> = {}
const { registerFeedbackHandlers } = await import('./feedback')
registerFeedbackHandlers()

// global.fetch con tipado mínimo
vi.stubGlobal('fetch', fetchMock)

describe('feedback:send', () => {
  beforeEach(() => {
    delete configValues.telegram_bot_token
    delete configValues.telegram_chat_id
    fetchMock.mockReset()
  })

  it('rechaza si no hay token/chat configurados', async () => {
    const res = await handles['feedback:send'](null, { mensaje: 'hola' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('no configurado')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza mensaje vacío', async () => {
    configValues.telegram_bot_token = 'TOKEN'
    configValues.telegram_chat_id = 'CHAT'
    const res = await handles['feedback:send'](null, { mensaje: '   ' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('vacío')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía el mensaje al bot de Telegram y devuelve success', async () => {
    configValues.telegram_bot_token = 'TOKEN'
    configValues.telegram_chat_id = 'CHAT'
    fetchMock.mockResolvedValue({ ok: true })

    const res = await handles['feedback:send'](null, {
      mensaje: 'Todo funciona perfecto',
      contacto: 'cliente@mail.com',
    })
    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://api.telegram.org/botTOKEN/sendMessage')
    const body = JSON.parse(opts.body)
    expect(body.chat_id).toBe('CHAT')
    expect(body.text).toContain('Todo funciona perfecto')
    expect(body.text).toContain('cliente@mail.com')
    expect(body.text).toContain('1.0.8')
  })

  it('traduce el error de la API de Telegram', async () => {
    configValues.telegram_bot_token = 'TOKEN'
    configValues.telegram_chat_id = 'CHAT'
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ description: 'Bad Request: chat not found' }) })

    const res = await handles['feedback:send'](null, { mensaje: 'prueba' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Bad Request: chat not found')
  })

  it('usa las variables de entorno como fallback', async () => {
    const prevToken = process.env.TELEGRAM_BOT_TOKEN
    const prevChat = process.env.TELEGRAM_CHAT_ID
    process.env.TELEGRAM_BOT_TOKEN = 'ENV_TOKEN'
    process.env.TELEGRAM_CHAT_ID = 'ENV_CHAT'
    fetchMock.mockResolvedValue({ ok: true })

    const res = await handles['feedback:send'](null, { mensaje: 'desde env' })
    expect(res.success).toBe(true)
    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('botENV_TOKEN')

    if (prevToken === undefined) delete process.env.TELEGRAM_BOT_TOKEN
    else process.env.TELEGRAM_BOT_TOKEN = prevToken
    if (prevChat === undefined) delete process.env.TELEGRAM_CHAT_ID
    else process.env.TELEGRAM_CHAT_ID = prevChat
  })
})