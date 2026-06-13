import i18next from 'i18next'
import type { TFunction } from 'i18next'

export function translateError(code: string, t: TFunction): string {
  if (!code) return t('errors.fallback')
  const key = `errors.${code}` as const
  return i18next.exists(key) ? t(key) : t('errors.fallback')
}
