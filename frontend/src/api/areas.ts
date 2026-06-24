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

export interface TabConfig {
  pinned: AreaId[]  // ordered, max 3
}

export const ALL_AREA_IDS: AreaId[] = ['calendar', 'todos', 'shopping', 'recipes']

export const DEFAULT_PINNED_TABS: AreaId[] = ['calendar', 'todos', 'shopping']

export function computePinnedTabs(
  tabConfig: TabConfig | null | undefined,
  areasConfig: HouseholdAreasConfig | null | undefined,
): AreaId[] {
  const pinned = tabConfig?.pinned ?? DEFAULT_PINNED_TABS
  return pinned.filter((area) => isAreaEnabled(areasConfig, area)).slice(0, 3)
}
