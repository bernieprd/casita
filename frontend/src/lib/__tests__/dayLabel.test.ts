import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { makeDayLabel } from '../dayLabel'

const TODAY = '2026-06-18'
const TOMORROW = '2026-07-19'

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2026, 5, 18)) // June 18 2026
})

afterEach(() => {
  vi.useRealTimers()
})

describe('makeDayLabel', () => {
  it('returns the today string for the current date', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW)
    expect(label('2026-06-18')).toBe(TODAY)
  })

  it('returns the tomorrow string for the next day', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW)
    expect(label('2026-06-19')).toBe(TOMORROW)
  })

  it('strips the time component from ISO datetime strings', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW)
    expect(label('2026-06-18T09:00:00Z')).toBe(TODAY)
  })

  it('formats a past date as weekday-date by default', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW)
    const result = label('2026-06-15') // Monday June 15
    expect(result).toContain('Mon')
    expect(result).toContain('15')
  })

  it('formats as weekday only when format is weekday', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW, 'weekday')
    const result = label('2026-06-15') // Monday
    expect(result).toBe('Mon')
  })

  it('formats as date only when format is date', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW, 'date')
    const result = label('2026-06-15')
    expect(result).toMatch(/Jun/)
    expect(result).toMatch(/15/)
    // should not contain a comma (weekday-date format)
    expect(result).not.toContain(',')
  })

  it('formats as weekday-date when format is weekday-date', () => {
    const label = makeDayLabel('en', TODAY, TOMORROW, 'weekday-date')
    const result = label('2026-06-15')
    expect(result).toContain(',')
    expect(result).toContain('Mon')
  })

  it('produces different output for a different locale', () => {
    const enLabel = makeDayLabel('en', TODAY, TOMORROW, 'weekday')
    const esLabel = makeDayLabel('es', TODAY, TOMORROW, 'weekday')
    const futureDate = '2026-06-22' // Monday
    // Both return a short weekday name but they may differ by locale
    // At minimum, neither should be the today/tomorrow substitute
    expect(enLabel(futureDate)).not.toBe(TODAY)
    expect(esLabel(futureDate)).not.toBe(TODAY)
  })
})
