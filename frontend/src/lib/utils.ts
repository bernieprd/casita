import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function memberInitials(member: { displayName?: string | null; email?: string | null }): string {
  const name = member.displayName ?? member.email ?? ''
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}

export function formatFrequency(frequency: string | null, interval: number | null, days: string[] | null): string | null {
  if (!frequency) return null
  const n = interval ?? 1
  const dayShort = (d: string) => d.slice(0, 3)
  if (frequency === 'daily') return 'Daily'
  if (frequency === 'weekly') {
    const daysStr = days && days.length > 0 ? ` · ${days.map(dayShort).join(', ')}` : ''
    return n === 1 ? `Weekly${daysStr}` : `Every ${n}w${daysStr}`
  }
  if (frequency === 'biweekly') return 'Biweekly'
  if (frequency === 'monthly') return n === 1 ? 'Monthly' : `Every ${n}mo`
  if (frequency === 'quarterly') return 'Quarterly'
  if (frequency === 'yearly') return 'Yearly'
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
