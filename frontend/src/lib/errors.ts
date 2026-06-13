import type { TFunction } from 'i18next'

export function translateError(code: string, t: TFunction): string {
  if (!code) return t('errors.fallback')
  const key = `errors.${code}` as const
  const result = t(key)
  return result === key ? t('errors.fallback') : result
}
