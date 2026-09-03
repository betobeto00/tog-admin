import { app, ipcMain } from 'electron'
import { getLang, setLang, type SupportedLang } from '../../i18n'

export function registerAppHandlers(): void {
  ipcMain.handle('app:version', () => {
    return app.getVersion()
  })
}

export function registerI18nHandlers(): void {
  ipcMain.handle('i18n:get-lang', () => getLang())

  ipcMain.handle('i18n:set-lang', (_evt, payload: { lang: string }) => {
    if (payload?.lang !== 'es' && payload?.lang !== 'en') {
      return { success: false, lang: getLang() }
    }
    setLang(payload.lang as SupportedLang)
    return { success: true, lang: getLang() }
  })
}