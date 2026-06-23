import { describe, it, expect } from 'vitest'
import { CROSS_AREA_GUARDS } from './crossAreaGuards.registry'

const COVERED_LOCATIONS = new Set([
  'Home.tsx / TodoSection',
  'Home.tsx / ShoppingSection',
  'Home.tsx / CalendarSection',
  'Home.tsx / RecipesSection',
  'PlanRecipeSheet.tsx / schedule-as-task',
  'Recipes.tsx / shopping-toggle',
  'AreasSettings.tsx / tab-pin options',
  'App.tsx / computed tab array',
])

describe('cross-area guard registry', () => {
  it('every registry entry has a corresponding test coverage marker', () => {
    for (const guard of CROSS_AREA_GUARDS) {
      expect(
        COVERED_LOCATIONS.has(guard.location),
        `No test coverage marker for guard at: ${guard.location}`,
      ).toBe(true)
    }
  })

  it('registry has no duplicate location entries', () => {
    const locations = CROSS_AREA_GUARDS.map((g) => g.location)
    expect(new Set(locations).size).toBe(locations.length)
  })
})
