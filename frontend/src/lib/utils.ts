import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { TFunction } from 'i18next'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function memberInitials(member: { displayName?: string | null; email?: string | null }): string {
  const name = member.displayName ?? member.email ?? ''
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}

export function formatFrequency(
  frequency: string | null,
  interval: number | null,
  days: string[] | null,
  t: TFunction,
): string | null {
  if (!frequency) return null
  const n = interval ?? 1
  if (frequency === 'daily') return t('frequency.daily')
  if (frequency === 'weekly') {
    const translatedDays = days && days.length > 0
      ? days.map(d => t(`days.${d.slice(0, 3).toLowerCase()}`, { defaultValue: d.slice(0, 3) })).join(', ')
      : ''
    if (n === 1 && translatedDays) return t('frequency.weeklyWithDays', { days: translatedDays })
    if (n === 1) return t('frequency.weekly')
    if (translatedDays) return `${t('frequency.everyNWeeks', { n })} · ${translatedDays}`
    return t('frequency.everyNWeeks', { n })
  }
  if (frequency === 'biweekly') return t('frequency.biweekly')
  if (frequency === 'monthly') return n === 1 ? t('frequency.monthly') : t('frequency.everyNMonths', { n })
  if (frequency === 'quarterly') return t('frequency.quarterly')
  if (frequency === 'yearly') return t('frequency.yearly')
  return frequency
}

export function safeUrl(url: string | null): string | undefined {
  if (!url) return undefined
  try {
    const { protocol } = new URL(url)
    return protocol === 'http:' || protocol === 'https:' ? url : undefined
  } catch {
    return undefined
  }
}
