import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { registerFeedbackHandlers } from './feedback'

const fetchMock = vi.fn()

const { handles } = vi.hoisted(() => ({
  handles: {} as Record<string, (event: any, data: any) => Promise<any>>,
}))

vi.mock('electron', () => ({
  app: { getVersion: () => '1.0.8' },
}))

vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (channel: string, fn: any) => {
    handles[channel] = fn
  },
}))

registerFeedbackHandlers()

vi.stubGlobal('fetch', fetchMock)

describe('feedback:send → endpoint interno (el token de Telegram no vive en el cliente)', () => {
  beforeEach(() => {
    delete process.env.TOG_FEEDBACK_URL
    fetchMock.mockReset()
  })

  it('rechaza mensaje vacío sin llamar a la red', async () => {
    const res = await handles['feedback:send'](null, { mensaje: '   ' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('vacío')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('manda el feedback al endpoint interno, no a la API de Telegram', async () => {
    fetchMock.mockResolvedValue({ ok: true })

    const res = await handles['feedback:send'](null, {
      mensaje: 'Todo funciona perfecto',
      contacto: 'cliente@mail.com',
    })

    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, opts] = fetchMock.mock.calls[0]
    expect(url).toBe('https://omnimargen.site/api/feedback')
    expect(url).not.toContain('telegram')
    expect(url).not.toContain('bot')

    const body = JSON.parse(opts.body)
    expect(body.mensaje).toBe('Todo funciona perfecto')
    expect(body.contacto).toBe('cliente@mail.com')
    expect(body.version).toBe('1.0.8')
  })

  it('respeta TOG_FEEDBACK_URL y normaliza la barra final', async () => {
    process.env.TOG_FEEDBACK_URL = 'http://localhost:3000/api/feedback/'
    fetchMock.mockResolvedValue({ ok: true })

    await handles['feedback:send'](null, { mensaje: 'hola' })

    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3000/api/feedback')
  })

  it('traduce un fallo del endpoint a un mensaje claro', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 502 })

    const res = await handles['feedback:send'](null, { mensaje: 'prueba' })

    expect(res.success).toBe(false)
    expect(res.error).toContain('No pudimos enviar')
  })

  it('ningún archivo de producción habla con Telegram ni conoce su token', () => {
    // Guarda de árbol completo (no de un archivo suelto): el invariante es "el
    // cliente nunca habla con Telegram", y el token sólo puede vivir en el
    // backend de la landing. Se revisan `src/main` y `src/renderer` salvo los
    // tests (sus fixtures plantan un `.env` justamente para probar la carga).
    const raiz = process.cwd()
    const sospechosos: string[] = []

    const revisar = (dir: string) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) {
          revisar(p)
          continue
        }
        if (!/\.(ts|tsx)$/.test(entry.name) || /\.test\.(ts|tsx)$/.test(entry.name)) continue
        const contenido = readFileSync(p, 'utf8')
        for (const prohibido of ['TELEGRAM_BOT_TOKEN', 'TELEGRAM_CHAT_ID', 'api.telegram.org']) {
          if (contenido.includes(prohibido)) sospechosos.push(`${p} → ${prohibido}`)
        }
      }
    }
    revisar(join(raiz, 'src', 'main'))
    revisar(join(raiz, 'src', 'renderer'))

    expect(sospechosos).toEqual([])
  })
})
