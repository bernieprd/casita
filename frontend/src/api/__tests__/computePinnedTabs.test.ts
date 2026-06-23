import { describe, it, expect } from 'vitest'
import { computePinnedTabs, DEFAULT_PINNED_TABS } from '../areas'
import type { HouseholdAreasConfig, TabConfig } from '../areas'

describe('computePinnedTabs', () => {
  it('null tabConfig returns default pinned tabs', () => {
    const result = computePinnedTabs(null, null)
    expect(result).toEqual(DEFAULT_PINNED_TABS)
  })

  it('undefined tabConfig returns default pinned tabs', () => {
    const result = computePinnedTabs(undefined, undefined)
    expect(result).toEqual(DEFAULT_PINNED_TABS)
  })

  it('user pinned tabs override default', () => {
    const tabConfig: TabConfig = { pinned: ['recipes', 'todos', 'shopping'] }
    const result = computePinnedTabs(tabConfig, null)
    expect(result).toEqual(['recipes', 'todos', 'shopping'])
  })

  it('disabled areas are excluded from pinned tabs', () => {
    const tabConfig: TabConfig = { pinned: ['calendar', 'todos', 'shopping'] }
    const areasConfig: HouseholdAreasConfig = {
      calendar: { enabled: false },
    }
    const result = computePinnedTabs(tabConfig, areasConfig)
    expect(result).toEqual(['todos', 'shopping'])
  })

  it('disabled areas excluded from default tabs', () => {
    const areasConfig: HouseholdAreasConfig = {
      shopping: { enabled: false },
    }
    const result = computePinnedTabs(null, areasConfig)
    expect(result).toEqual(['calendar', 'todos'])
  })

  it('max 3 tabs enforced', () => {
    const tabConfig: TabConfig = { pinned: ['calendar', 'todos', 'shopping', 'recipes'] as ReturnType<typeof computePinnedTabs> }
    const result = computePinnedTabs(tabConfig, null)
    expect(result).toHaveLength(3)
    expect(result).toEqual(['calendar', 'todos', 'shopping'])
  })

  it('all areas disabled returns empty array', () => {
    const areasConfig: HouseholdAreasConfig = {
      calendar: { enabled: false },
      todos:    { enabled: false },
      shopping: { enabled: false },
      recipes:  { enabled: false },
    }
    const result = computePinnedTabs(null, areasConfig)
    expect(result).toEqual([])
  })
})
