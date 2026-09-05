import * as fs from 'fs'
import * as path from 'path'
import { app } from 'electron'
import { logger } from '../services/logger'

export type SupportedLang = 'es' | 'en'

let currentLang: SupportedLang = 'en'
let translations: Record<string, any> = {}

const DEFAULT_LANG: SupportedLang = 'en'

function loadTranslations(lang: SupportedLang): Record<string, any> {
  const localesBase = app.isPackaged
    ? path.join(process.resourcesPath, 'i18n', 'locales')
    : path.join(__dirname, '..', '..', 'src', 'main', 'i18n', 'locales')

  const filePath = path.join(localesBase, `${lang}.json`)
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(content)
  } catch (err) {
    logger.error('i18n', `Failed to load ${filePath}, falling back to ${DEFAULT_LANG}`)
    if (lang !== DEFAULT_LANG) {
      return loadTranslations(DEFAULT_LANG)
    }
    return {}
  }
}

function getNested(obj: any, key: string): any {
  return key.split('.').reduce((acc, k) => (acc != null ? acc[k] : undefined), obj)
}

export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = getNested(translations, key)
  if (typeof raw !== 'string') {
    logger.warn('i18n', `Missing key: ${key} (lang=${currentLang})`)
    return key
  }
  if (!vars) return raw
  return raw.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    const v = vars[name]
    return v == null ? `{{${name}}}` : String(v)
  })
}

export function detectInitialLang(): SupportedLang {
  // 1) Check NSIS install marker (only present after GUI install)
  if (app.isPackaged) {
    try {
      const installLangPath = path.join(path.dirname(app.getPath('exe')), '.lang')
      if (fs.existsSync(installLangPath)) {
        const raw = fs.readFileSync(installLangPath, 'utf-8').trim()
        if (raw === 'es' || raw === 'en') {
          // First-launch: copy to userData and remove install marker
          const userLangPath = path.join(app.getPath('userData'), 'language.txt')
          fs.writeFileSync(userLangPath, raw, 'utf-8')
          try { fs.unlinkSync(installLangPath) } catch {}
          return raw
        }
      }
    } catch (err) {
      logger.warn('i18n', 'Could not read install marker:', err)
    }
  }

  // 2) Check userData language file (set by previous launch or Config UI)
  try {
    const userLangPath = path.join(app.getPath('userData'), 'language.txt')
    if (fs.existsSync(userLangPath)) {
      const raw = fs.readFileSync(userLangPath, 'utf-8').trim()
      if (raw === 'es' || raw === 'en') return raw
    }
  } catch {}

  // 3) Default
  return DEFAULT_LANG
}

export function setLang(lang: SupportedLang): void {
  if (lang !== 'es' && lang !== 'en') {
    logger.warn('i18n', `Unsupported language: ${lang}, keeping ${currentLang}`)
    return
  }
  currentLang = lang
  translations = loadTranslations(lang)
  try {
    const userLangPath = path.join(app.getPath('userData'), 'language.txt')
    fs.writeFileSync(userLangPath, lang, 'utf-8')
  } catch (err) {
    logger.warn('i18n', 'Could not persist language:', err)
  }
}

export function getLang(): SupportedLang {
  return currentLang
}

export function initI18n(): SupportedLang {
  const lang = detectInitialLang()
  setLang(lang)
  return lang
}
