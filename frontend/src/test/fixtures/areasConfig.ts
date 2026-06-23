import type { HouseholdAreasConfig, AreaId } from '@/api/areas'

export const makeAreasConfig = (
  overrides: Partial<HouseholdAreasConfig> = {}
): HouseholdAreasConfig =>
  Object.fromEntries(
    (['calendar', 'todos', 'shopping', 'recipes'] as AreaId[]).map((id) => [
      id,
      { enabled: true, ...overrides[id] },
    ])
  ) as HouseholdAreasConfig
