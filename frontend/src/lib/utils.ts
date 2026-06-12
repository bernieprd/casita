import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function memberInitials(member: { displayName?: string | null; email?: string | null }): string {
  const name = member.displayName ?? member.email ?? ''
  return name.split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
}
