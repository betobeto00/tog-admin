import { describe, it, expect, vi, beforeEach } from 'vitest'
import { registerFeedbackHandlers } from './feedback'

const fetchMock = vi.fn()

const { handles } = vi.hoisted(() => ({
  handles: {} as Record<string, (event: any, data: any) => Promise<any>>,
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.8' },
}))

vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (channel: string, fn: any) => { handles[channel] = fn },
}))

registerFeedbackHandlers()

vi.stubGlobal('fetch', fetchMock)

function clearTelegramEnv() {
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_CHAT_ID
}

describe('feedback:send', () => {
  beforeEach(() => {
    clearTelegramEnv()
    fetchMock.mockReset()
  })

  it('rechaza si no hay token/chat configurados', async () => {
    const res = await handles['feedback:send'](null, { mensaje: 'hola' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('no configurado')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rechaza mensaje vacío', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'TOKEN'
    process.env.TELEGRAM_CHAT_ID = 'CHAT'
    const res = await handles['feedback:send'](null, { mensaje: '   ' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('vacío')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envía el mensaje al bot de Telegram y devuelve success', async () => {
    process.env.TELEGRAM_BOT_TOKEN = 'TOKEN'
    process.env.TELEGRAM_CHAT_ID = 'CHAT'
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
    process.env.TELEGRAM_BOT_TOKEN = 'TOKEN'
    process.env.TELEGRAM_CHAT_ID = 'CHAT'
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({ description: 'Bad Request: chat not found' }) })

    const res = await handles['feedback:send'](null, { mensaje: 'prueba' })
    expect(res.success).toBe(false)
    expect(res.error).toBe('Bad Request: chat not found')
  })
})
