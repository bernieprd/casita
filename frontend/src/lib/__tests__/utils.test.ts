import { describe, it, expect, vi } from 'vitest'
import { memberInitials, safeUrl, formatFrequency } from '../utils'
import type { TFunction } from 'i18next'

const t = vi.fn((key: string, opts?: Record<string, unknown>) => {
  if (opts && 'defaultValue' in opts) return opts.defaultValue as string
  if (opts && 'days' in opts) return `${key}:${opts.days}`
  if (opts && 'n' in opts) return `${key}:${opts.n}`
  return key
}) as unknown as TFunction

describe('memberInitials', () => {
  it('returns first letter of a single name', () => {
    expect(memberInitials({ displayName: 'Alice' })).toBe('A')
  })

  it('returns two initials from a full name', () => {
    expect(memberInitials({ displayName: 'Alice Smith' })).toBe('AS')
  })

  it('truncates to 2 initials for long names', () => {
    expect(memberInitials({ displayName: 'Alice Marie Smith' })).toBe('AM')
  })

  it('falls back to email when displayName is null', () => {
    expect(memberInitials({ displayName: null, email: 'alice@example.com' })).toBe('A')
  })

  it('returns empty string when both fields are null', () => {
    expect(memberInitials({ displayName: null, email: null })).toBe('')
  })

  it('uppercases initials', () => {
    expect(memberInitials({ displayName: 'alice smith' })).toBe('AS')
  })
})

describe('safeUrl', () => {
  it('returns https urls unchanged', () => {
    expect(safeUrl('https://example.com')).toBe('https://example.com')
  })

  it('returns http urls unchanged', () => {
    expect(safeUrl('http://example.com')).toBe('http://example.com')
  })

  it('rejects javascript: protocol', () => {
    expect(safeUrl('javascript:alert(1)')).toBeUndefined()
  })

  it('rejects data: protocol', () => {
    expect(safeUrl('data:text/html,<h1>hi</h1>')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(safeUrl('')).toBeUndefined()
  })

  it('returns undefined for null', () => {
    expect(safeUrl(null)).toBeUndefined()
  })

  it('returns undefined for malformed url', () => {
    expect(safeUrl('not a url')).toBeUndefined()
  })
})

describe('formatFrequency', () => {
  it('returns null when frequency is null', () => {
    expect(formatFrequency(null, null, null, t)).toBeNull()
  })

  it('handles daily', () => {
    expect(formatFrequency('daily', null, null, t)).toBe('frequency.daily')
  })

  it('handles weekly with days', () => {
    const result = formatFrequency('weekly', 1, ['Monday', 'Friday'], t)
    expect(result).toContain('Mon')
    expect(result).toContain('Fri')
  })

  it('handles weekly without days', () => {
    expect(formatFrequency('weekly', 1, [], t)).toBe('frequency.weekly')
  })

  it('handles every N weeks', () => {
    expect(formatFrequency('weekly', 3, null, t)).toBe('frequency.everyNWeeks:3')
  })

  it('handles monthly', () => {
    expect(formatFrequency('monthly', 1, null, t)).toBe('frequency.monthly')
  })

  it('handles every N months', () => {
    expect(formatFrequency('monthly', 3, null, t)).toBe('frequency.everyNMonths:3')
  })

  it('handles biweekly', () => {
    expect(formatFrequency('biweekly', null, null, t)).toBe('frequency.biweekly')
  })

  it('handles quarterly', () => {
    expect(formatFrequency('quarterly', null, null, t)).toBe('frequency.quarterly')
  })

  it('handles yearly', () => {
    expect(formatFrequency('yearly', null, null, t)).toBe('frequency.yearly')
  })

  it('returns the raw frequency string for unknown values', () => {
    expect(formatFrequency('custom', null, null, t)).toBe('custom')
  })
})
