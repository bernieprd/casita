import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

import en from '../locales/en/translation.json'
import es from '../locales/es/translation.json'
import ptPT from '../locales/pt-PT/translation.json'
import it from '../locales/it/translation.json'

export const SUPPORTED_LOCALES = [
  { code: 'en',    label: 'English' },
  { code: 'es',    label: 'Español' },
  { code: 'pt-PT', label: 'Português (PT)' },
  { code: 'it',    label: 'Italiano' },
] as const

export type LocaleCode = (typeof SUPPORTED_LOCALES)[number]['code']

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en:    { translation: en },
      es:    { translation: es },
      'pt-PT': { translation: ptPT },
      it:    { translation: it },
    },
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LOCALES.map(l => l.code),
    interpolation: {
      escapeValue: false,
    },
    detection: {
      // Omit 'navigator' so the app stays on 'en' until the server locale
      // resolves via LocaleSync, preventing a language flash on first load.
      order: ['localStorage'],
      caches: ['localStorage'],
      lookupLocalStorage: 'casita_locale',
    },
  })

export default i18n
