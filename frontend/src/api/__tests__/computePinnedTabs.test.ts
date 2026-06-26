import { describe, it, expect } from 'vitest'
import { computePinnedTabs, DEFAULT_PINNED_TABS } from '../areas'
import { makeAreasConfig } from '@/test/fixtures/areasConfig'

describe('computePinnedTabs', () => {
  it('null tabConfig returns the default pinned tabs', () => {
    expect(computePinnedTabs(null, null)).toEqual(DEFAULT_PINNED_TABS)
  })

  it('user-pinned tabs override the default', () => {
    const result = computePinnedTabs({ pinned: ['recipes', 'shopping'] }, null)
    expect(result).toEqual(['recipes', 'shopping'])
  })

  it('disabled areas are excluded from pinned tabs', () => {
    const areasConfig = makeAreasConfig({ todos: { enabled: false } })
    // Default pinned includes todos — it should be filtered out
    const result = computePinnedTabs(null, areasConfig)
    expect(result).not.toContain('todos')
    expect(result).toContain('calendar')
    expect(result).toContain('shopping')
  })

  it('disabled pinned area is excluded even when explicitly pinned', () => {
    const areasConfig = makeAreasConfig({ recipes: { enabled: false } })
    const result = computePinnedTabs({ pinned: ['recipes', 'shopping'] }, areasConfig)
    expect(result).not.toContain('recipes')
    expect(result).toContain('shopping')
  })

  it('max 3 tabs enforced', () => {
    const result = computePinnedTabs(
      { pinned: ['calendar', 'todos', 'shopping', 'recipes'] },
      null,
    )
    expect(result.length).toBeLessThanOrEqual(3)
  })

  it('two users with different configs produce different results', () => {
    const userA = computePinnedTabs({ pinned: ['recipes'] }, null)
    const userB = computePinnedTabs({ pinned: ['calendar', 'todos'] }, null)
    expect(userA).toEqual(['recipes'])
    expect(userB).toEqual(['calendar', 'todos'])
    expect(userA).not.toEqual(userB)
  })
})
