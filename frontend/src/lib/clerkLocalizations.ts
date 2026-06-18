import { esES, itIT, ptPT } from '@clerk/localizations'
import { SUPPORTED_LOCALES, type LocaleCode } from '../i18n'

// Avoid importing @clerk/shared/types (transitive dep, not resolvable via tsc -b).
const CLERK_LOCALIZATIONS = {
  es: esES,
  'pt-PT': ptPT,
  it: itIT,
} satisfies Partial<Record<LocaleCode, typeof ptPT>>

// Maps any locale-like string to a supported LocaleCode; falls back to 'en'.
export function normalizeLocale(raw: string): LocaleCode {
  if (!raw) return 'en'
  const lower = raw.toLowerCase()
  for (const { code } of SUPPORTED_LOCALES) {
    if (lower === code.toLowerCase()) return code
    // Accept language-only prefix for locales stored without a region (e.g. 'es')
    if (!code.includes('-') && lower.startsWith(code.toLowerCase() + '-')) return code
  }
  // Accept regional variant of a supported language (e.g. pt-BR → pt-PT)
  const langPrefix = lower.split('-')[0]
  for (const { code } of SUPPORTED_LOCALES) {
    if (code.toLowerCase().startsWith(langPrefix + '-')) return code
  }
  return 'en'
}

export function getClerkLocalization(locale: LocaleCode) {
  return CLERK_LOCALIZATIONS[locale as keyof typeof CLERK_LOCALIZATIONS]
}
