import { app } from 'electron'
import { handleIpc } from '../../core/auth/ipc-guard'

/**
 * Feedback del login.
 *
 * El token del bot de Telegram NO vive en la app: lo tenía el `.env` que el
 * instalador copiaba a `%APPDATA%/tog-admin/.env`, así que cualquier proceso
 * del equipo podía leerlo y hablar como el bot. Ahora el mensaje se manda al
 * endpoint interno (`landing-page` → `/api/feedback`), que es el único que
 * conoce el token y lo usa server-side.
 *
 * `TOG_FEEDBACK_URL` permite apuntar a un entorno distinto (staging) sin
 * tocar código.
 */
const DEFAULT_FEEDBACK_URL = 'https://omnimargen.site/api/feedback'
const FEEDBACK_TIMEOUT_MS = 15_000
const MAX_MENSAJE = 4000
const MAX_CONTACTO = 200

const ERROR_ENVIO = 'No pudimos enviar el mensaje. Revisá tu conexión e intentá de nuevo.'

export function feedbackEndpoint(): string {
  return (process.env.TOG_FEEDBACK_URL || DEFAULT_FEEDBACK_URL).trim().replace(/\/+$/, '')
}

export function registerFeedbackHandlers(): void {
  handleIpc('feedback:send', async (_event, data: { mensaje: string; contacto?: string }) => {
    if (!data?.mensaje || !data.mensaje.trim()) {
      return { success: false, error: 'El mensaje no puede estar vacío' }
    }

    const mensaje = data.mensaje.trim().slice(0, MAX_MENSAJE)
    const contacto = typeof data.contacto === 'string' ? data.contacto.trim().slice(0, MAX_CONTACTO) : ''

    try {
      const res = await fetch(feedbackEndpoint(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mensaje,
          contacto: contacto || undefined,
          version: app.getVersion(),
        }),
        signal: AbortSignal.timeout(FEEDBACK_TIMEOUT_MS),
      })
      if (!res.ok) {
        return { success: false, error: ERROR_ENVIO }
      }
      return { success: true }
    } catch {
      return { success: false, error: ERROR_ENVIO }
    }
  })
}
