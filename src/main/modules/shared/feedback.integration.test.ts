// Verificación end-to-end del botón de feedback SIN depender de internet:
// se levanta un servidor HTTP local que hace de endpoint interno
// (landing-page → /api/feedback) y se ejercita el handler real.
//
// Cubre lo que pidió el rediseño: la app manda el mensaje a un backend y NUNCA
// un token de Telegram. Y como TOG Admin es offline-first, cubre también qué ve
// el usuario cuando no hay conexión.

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import http from 'node:http'
import type { AddressInfo } from 'node:net'

const { handles } = vi.hoisted(() => ({
  handles: {} as Record<string, (event: any, data: any) => Promise<any>>,
}))

vi.mock('electron', () => ({ app: { getVersion: () => '1.2.1' } }))
vi.mock('../../core/auth/ipc-guard', () => ({
  handleIpc: (channel: string, fn: any) => {
    handles[channel] = fn
  },
}))

import { registerFeedbackHandlers } from './feedback'

registerFeedbackHandlers()

let server: http.Server
let endpoint: string
const recibidos: Array<{ url: string; body: any; method?: string }> = []
let respuesta: { status: number; payload: unknown } = { status: 200, payload: { ok: true } }

beforeAll(async () => {
  server = http.createServer((req, res) => {
    let data = ''
    req.on('data', (chunk) => (data += chunk))
    req.on('end', () => {
      recibidos.push({ url: req.url || '', method: req.method, body: data ? JSON.parse(data) : null })
      res.writeHead(respuesta.status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(respuesta.payload))
    })
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  endpoint = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  process.env.TOG_FEEDBACK_URL = endpoint
})

afterAll(async () => {
  delete process.env.TOG_FEEDBACK_URL
  await new Promise<void>((resolve) => server.close(() => resolve()))
})

beforeEach(() => {
  recibidos.length = 0
  respuesta = { status: 200, payload: { ok: true } }
})

describe('feedback:send contra el endpoint interno (sin internet real)', () => {
  it('envía el mensaje por POST y no manda ningún secreto', async () => {
    const res = await handles['feedback:send'](null, {
      mensaje: 'La caja cerró bien',
      contacto: 'dueño@negocio.com',
    })

    expect(res).toEqual({ success: true })
    expect(recibidos).toHaveLength(1)

    const peticion = recibidos[0]
    expect(peticion.method).toBe('POST')
    expect(peticion.url).toBe('/')
    expect(peticion.body).toEqual({
      mensaje: 'La caja cerró bien',
      contacto: 'dueño@negocio.com',
      version: '1.2.1',
    })

    // Ni token, ni chat id, ni nada con pinta de credencial viajando desde el cliente.
    const serializado = JSON.stringify(peticion.body).toLowerCase()
    for (const prohibido of ['token', 'telegram', 'chat_id', 'bot']) {
      expect(serializado).not.toContain(prohibido)
    }
  })

  it('un error del endpoint se traduce a un mensaje claro para el usuario', async () => {
    respuesta = { status: 502, payload: { ok: false, error: 'No pudimos enviar tu mensaje.' } }

    const res = await handles['feedback:send'](null, { mensaje: 'prueba' })

    expect(res.success).toBe(false)
    expect(res.error).toBe('No pudimos enviar el mensaje. Revisá tu conexión e intentá de nuevo.')
    // No se filtra el detalle del backend
    expect(res.error).not.toContain('502')
  })

  it('sin conexión (servidor caído) avisa igual y no rompe la app', async () => {
    const puertoCerrado = `http://127.0.0.1:${(server.address() as AddressInfo).port + 1}`
    process.env.TOG_FEEDBACK_URL = puertoCerrado
    try {
      const res = await handles['feedback:send'](null, { mensaje: 'sin red' })
      expect(res.success).toBe(false)
      expect(res.error).toContain('No pudimos enviar')
    } finally {
      process.env.TOG_FEEDBACK_URL = endpoint
    }
  })

  it('recorta mensajes y contactos demasiado largos antes de enviarlos', async () => {
    const res = await handles['feedback:send'](null, {
      mensaje: 'x'.repeat(9000),
      contacto: 'y'.repeat(500),
    })

    expect(res.success).toBe(true)
    expect(recibidos[0].body.mensaje).toHaveLength(4000)
    expect(recibidos[0].body.contacto).toHaveLength(200)
  })
})
