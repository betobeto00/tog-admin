import { app } from 'electron'
import { handleIpc } from '../../core/auth/ipc-guard'
import { getLang, setLang, type SupportedLang } from '../../i18n'

export function registerAppHandlers(): void {
  handleIpc('app:version', () => {
    return app.getVersion()
  })
}

export function registerI18nHandlers(): void {
  handleIpc('i18n:get-lang', () => getLang())

  handleIpc('i18n:set-lang', (_evt, payload: { lang: string }) => {
    if (payload?.lang !== 'es' && payload?.lang !== 'en') {
      return { success: false, lang: getLang() }
    }
    setLang(payload.lang as SupportedLang)
    return { success: true, lang: getLang() }
  })
}