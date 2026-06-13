import { useTranslation } from 'react-i18next'
import { enUS, es, pt, it } from 'date-fns/locale'
import type { Locale } from 'date-fns'

const DATE_FNS_LOCALES: Record<string, Locale> = {
  en: enUS,
  es,
  'pt-PT': pt,
  it,
}

export function useDateFnsLocale(): Locale {
  const { i18n } = useTranslation()
  return DATE_FNS_LOCALES[i18n.language] ?? enUS
}
