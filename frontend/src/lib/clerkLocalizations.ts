import { esES, itIT, ptPT } from '@clerk/localizations'
import { SUPPORTED_LOCALES, type LocaleCode } from '../i18n'

// TypeScript infers the value type from the imported constants — no need to
// reference @clerk/shared/types (a transitive dep not resolvable via tsc -b).
const CLERK_LOCALIZATIONS = {
  es: esES,
  'pt-PT': ptPT,
  it: itIT,
} satisfies Partial<Record<LocaleCode, typeof ptPT>>

/**
 * Maps any locale-like string to one of our supported LocaleCodes.
 * Handles case differences (pt-pt → pt-PT) and language-only prefixes
 * (es-ES → es). Falls back to 'en' for unrecognised codes.
 */
export function normalizeLocale(raw: string): LocaleCode {
  if (!raw) return 'en'
  const lower = raw.toLowerCase()
  for (const { code } of SUPPORTED_LOCALES) {
    if (lower === code.toLowerCase()) return code
    // Accept language-only prefix for locales stored without a region (e.g. 'es')
    if (!code.includes('-') && lower.startsWith(code.toLowerCase() + '-')) return code
  }
  return 'en'
}

export function getClerkLocalization(locale: LocaleCode) {
  return CLERK_LOCALIZATIONS[locale as keyof typeof CLERK_LOCALIZATIONS]
}
