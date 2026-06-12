import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function memberInitials(member: { displayName?: string | null; email?: string | null }): string {
  const name = member.displayName ?? member.email ?? ''
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
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
