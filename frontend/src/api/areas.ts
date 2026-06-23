export type AreaId = 'calendar' | 'todos' | 'shopping' | 'recipes'

export type HouseholdAreasConfig = {
  [key in AreaId]?: { enabled: boolean }
}

export function isAreaEnabled(
  config: HouseholdAreasConfig | null | undefined,
  area: AreaId,
): boolean {
  if (!config) return true
  return config[area]?.enabled !== false
}
