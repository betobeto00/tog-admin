import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import esTranslation from './locales/es/translation.json'
import enTranslation from './locales/en/translation.json'
import { callApi } from '../lib/api-client'

export const SUPPORTED_LANGS = ['es', 'en'] as const
export type Lang = (typeof SUPPORTED_LANGS)[number]

let initialLang: Lang = 'en'

export async function getInitialLang(): Promise<Lang> {
  try {
    const lang = await callApi<'es' | 'en'>('i18n:get-lang')
    if (lang === 'es' || lang === 'en') return lang
  } catch (err) {
    console.warn('[i18n] Could not get lang from main:', err)
  }
  return 'en'
}

export async function initI18n(): Promise<typeof i18n> {
  initialLang = await getInitialLang()

  await i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources: {
        es: { translation: esTranslation as any },
        en: { translation: enTranslation as any },
      },
      lng: initialLang,
      fallbackLng: 'en',
      supportedLngs: ['es', 'en'],
      interpolation: { escapeValue: false },
      detection: {
        order: ['htmlTag', 'localStorage', 'navigator'],
        caches: ['localStorage'],
        lookupLocalStorage: 'tog.lang',
      },
      react: { useSuspense: false },
    })

  // Persist language on every change so reloads keep the choice
  i18n.on('languageChanged', (lang) => {
    try { localStorage.setItem('tog.lang', lang) } catch {}
  })

  return i18n
}

export async function changeLang(lang: Lang): Promise<void> {
  await i18n.changeLanguage(lang)
  try {
    await callApi('i18n:set-lang', { lang })
  } catch (err) {
    console.warn('[i18n] Could not persist lang to main:', err)
  }
}

export default i18n
