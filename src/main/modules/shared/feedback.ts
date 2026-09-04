import { app } from 'electron'
import { handleIpc } from '../../core/auth/ipc-guard'
import { getConfig } from '../../services/configCache'

export function registerFeedbackHandlers(): void {
  handleIpc('feedback:send', async (_event, data: { mensaje: string; contacto?: string }) => {
    const botToken = getConfig('telegram_bot_token') || process.env.TELEGRAM_BOT_TOKEN || ''
    const chatId = getConfig('telegram_chat_id') || process.env.TELEGRAM_CHAT_ID || ''

    if (!botToken || !chatId) {
      return { success: false, error: 'Feedback no configurado (token/chat de Telegram)' }
    }
    if (!data?.mensaje || !data.mensaje.trim()) {
      return { success: false, error: 'El mensaje no puede estar vacío' }
    }

    const texto = [
      '📩 *Feedback TOG Admin*',
      `Versión: ${app.getVersion()}`,
      data.contacto ? `Contacto: ${data.contacto}` : '',
      '',
      data.mensaje.trim(),
    ].filter(Boolean).join('\n')

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text: texto, parse_mode: 'Markdown' }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return { success: false, error: (err as any)?.description || 'Error enviando feedback' }
      }
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message || 'Error de red enviando feedback' }
    }
  })
}