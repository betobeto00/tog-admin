import { useTranslation } from 'react-i18next'

/**
 * Hook de traducción con fallback a string en español.
 *
 * Comportamiento:
 * - Si la key existe en el idioma activo: devuelve la traducción
 * - Si no existe: devuelve el fallback (string original en español)
 * - En modo dev (import.meta.env.DEV) y si la key no existe: loggea warning
 *
 * Esto permite migrar gradualmente las páginas sin romper la UI:
 * - Páginas no migradas: usan tc('Texto en español') y muestran el texto literal
 * - Páginas migradas: usan t('nav.dashboard') y obtienen traducciones
 */
export function useT() {
  const { t, i18n } = useTranslation()

  return {
    t,
    i18n,
    tc: (esText: string, enText?: string) => {
      if (i18n.language === 'en') {
        return enText ?? esText
      }
      return esText
    },
  }
}
