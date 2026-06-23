# Navigation Scalability — Design Options

## Context

The current bottom nav has 5 fixed tabs (Home, Calendar, Todos, Shopping, Recipes). As the app grows (e.g. Finance), this doesn't scale. We also want to let households disable areas they don't use (e.g. "we don't need Todos"). This document covers the chosen approach and the foundation required.

---

## Decision

**Option A (Menu Tab)** is chosen. Key adjustments to the original Option A description:

- **Calendar is a default tab** (not in Menu by default). Calendar is useful even without Google Calendar integration (manual events).
- **Recipes moves to Menu by default.** It requires the most setup (ingredients, planning) and delivers value last; users who want it can pin it to a tab.
- **Default tab bar:** Home · Calendar · Todos · Shopping · Menu

### Per-household vs per-user split

| Concern | Scope | Why |
|---------|-------|-----|
| Area enable/disable | **Household** | Affects what data is even available (e.g. no Shopping list to show anyone) |
| Tab order and pinning | **Per-user** | Different household members have different workflows — one might prioritize Finance, another Shopping |
| Area settings (labels, etc.) | **Per-user** | Personal organization preference |

Household members operate independently. One person pinning Recipes to their tabs has no effect on anyone else's tab bar.

---

## Shared Foundation

### Area enable/disable (household-level)

New JSON column on `households` table:

```sql
-- worker/src/db/migrations/010_areas_config.sql
ALTER TABLE households ADD COLUMN areas_config TEXT DEFAULT NULL;
-- NULL → all areas enabled (backwards-compatible)
```

```typescript
type AreaId = 'calendar' | 'todos' | 'shopping' | 'recipes'

interface HouseholdAreasConfig {
  [key in AreaId]?: { enabled: boolean }
}
```

- Owner-only write, same pattern as existing household settings
- Returned by `GET /household`, updated via `PATCH /household`
- Frontend: `useHouseholdSettings()` returns `areasConfig` with safe default (all enabled when null)

### Cross-area feature guards

When an area is disabled, features that cross into it must react:

| Location | Change |
|----------|--------|
| `Home.tsx` | Don't render the area's section/widget |
| `PlanRecipeSheet.tsx` | Hide "Schedule as task" if `todos` disabled |
| `Recipes.tsx` ingredient list | Hide shopping toggle if `shopping` disabled |
| Area settings rows in Settings/Menu | Hide if area disabled |
| Tab slots | Disabled areas can't be pinned to tabs |

#### Tests for cross-area guards

Every guard row above must have a corresponding test. Use a shared `makeAreasConfig` fixture that starts with all areas enabled and accepts per-area overrides so individual test files stay terse:

```typescript
// frontend/src/test/fixtures/areasConfig.ts
export const makeAreasConfig = (
  overrides: Partial<HouseholdAreasConfig> = {}
): HouseholdAreasConfig =>
  Object.fromEntries(
    (['calendar', 'todos', 'shopping', 'recipes'] as AreaId[]).map((id) => [
      id,
      { enabled: true, ...overrides[id] },
    ])
  ) as HouseholdAreasConfig
```

Test locations and what they must assert:

| Test file | Scenario covered |
|-----------|-----------------|
| `Home.test.tsx` | `todos` disabled → `TodoSection` absent; re-enabled → present |
| `Home.test.tsx` | `shopping` disabled → `ShoppingSection` absent |
| `Home.test.tsx` | `calendar` disabled → `CalendarSection` absent |
| `Home.test.tsx` | `recipes` disabled → `RecipesSection` absent |
| `PlanRecipeSheet.test.tsx` | `todos` disabled → "Schedule as task" button absent |
| `Recipes.test.tsx` | `shopping` disabled → shopping toggle absent on ingredient |
| `AreasSettings.test.tsx` | Disabled area row absent from tab-pin options |
| `App.test.tsx` | Disabled area cannot appear in computed tab array |

Add a static registry of all guard locations so new guards can't be added without a corresponding test entry:

```typescript
// frontend/src/test/crossAreaGuards.registry.ts
// Add an entry here whenever a new cross-area guard is introduced.
// The AreasGuards test suite asserts this list stays fully covered.
export const CROSS_AREA_GUARDS = [
  { area: 'todos',    location: 'Home.tsx / TodoSection' },
  { area: 'shopping', location: 'Home.tsx / ShoppingSection' },
  { area: 'calendar', location: 'Home.tsx / CalendarSection' },
  { area: 'recipes',  location: 'Home.tsx / RecipesSection' },
  { area: 'todos',    location: 'PlanRecipeSheet.tsx / schedule-as-task' },
  { area: 'shopping', location: 'Recipes.tsx / shopping-toggle' },
  { area: '*',        location: 'AreasSettings.tsx / tab-pin options' },
  { area: '*',        location: 'App.tsx / computed tab array' },
] as const satisfies Array<{ area: AreaId | '*'; location: string }>
```

A lint-style test in `frontend/src/test/crossAreaGuards.registry.test.ts` imports the registry and fails if any `location` string doesn't have a matching `describe` block in the test suite. This ensures the registry stays honest as new guards are added.

### Area settings UI

New page `components/settings/AreasSettings.tsx`:
- **Owner section:** toggle switches to enable/disable each area (household-level)
- **User section:** tab configuration — pin/unpin areas and reorder (per-user, affects only the current user)
- Linked from `HouseholdSettings.tsx` via an "Areas & Tabs" row

---

## Option A: Menu Tab

### Concept

Replace the Settings gear icon in the Home header with a permanent **Menu** tab (always the last tab). The Menu tab hosts non-tab areas + all existing Settings entries. Maximum 5 tabs: Home · [up to 3 area slots] · Menu.

**Default tab bar:** Home · Calendar · Todos · Shopping · Menu  
**Recipes:** lives in the Menu by default (requires ingredient setup to deliver value; accessible there until a user pins it to their tab slot).

### Tab configurability (per-user)

New JSON column on `users` table:

```sql
ALTER TABLE users ADD COLUMN tab_config TEXT DEFAULT NULL;
```

```typescript
interface TabConfig { pinned: AreaId[] }  // ordered, max 3
```

Default when null: `['calendar', 'todos', 'shopping']`.  
Returned by `GET /me`, updated via `PATCH /me`.  
Each user's `tab_config` is independent — changing yours has no effect on other household members.

### New components

- `components/Menu.tsx` — the `/menu` route. Top section: non-pinned enabled areas as nav cards. Bottom section: existing `SettingsMenu` content.
- `components/settings/AreasSettings.tsx` — enable/disable (owner, household-wide) + tab-pin toggles (per-user, personal only, max 3 slots)

### App.tsx changes

- Add `'menu'` to `TabId` union and `TAB_PATHS`
- Tab array computed dynamically: `['home', ...userPinnedAreas.filter(areaEnabled), 'menu']`
- `/menu/*` route added, mounting `MenuLayout`
- Settings gear icon removed from Home header (~line 173)
- `pathnameToTab()` handles `/menu`
- `isSettings` guard also catches `/menu/settings`

### Pro / Con

| Pro | Con |
|-----|-----|
| Settings gets first-class navigation real estate as a tab | Navigation changes from current (Calendar was a tab; Recipes was a tab) |
| Easy to add future areas (start in Menu, graduate to a tab) | New routing and layout complexity |
| Per-user tabs accommodate different household member priorities | Menu layer adds one tap for non-pinned areas |
| Calendar pinned by default keeps it accessible for most users | |

---

## Recommended Phasing

These phases can be shipped independently and in order.

**Phase 1 — Area enable/disable** ✅ DONE (household-level, no navigation changes)
- DB migration `012_areas_config.sql` — applied to remote D1
- `useHouseholdSettings()` returns `areasConfig` with safe default
- `AreasSettings.tsx` with owner-only area toggles, linked from SettingsMenu under "Areas & Tabs"
- Guards in `Home.tsx`, `Recipes.tsx` (schedule-as-task + shopping toggle)
- Cross-area guard tests + registry — 66 frontend tests pass

**Phase 2 — Tab configurability** (per-user)
- DB migration: `tab_config` column on `users` table
- `PATCH /me` accepts and persists `tabConfig`
- `AreasSettings.tsx` gains a per-user tab-slot section (clearly labelled "Your tabs — only visible to you")
- `App.tsx` builds tab array dynamically instead of hardcoding it
- Tests: tab array computation with various `tabConfig` + `areasConfig` combinations

**Phase 3 — Navigation change** (Menu Tab)
- Add Menu tab + `Menu.tsx` component
- Route and header changes in `App.tsx`
- Default `tab_config` set to `['calendar', 'todos', 'shopping']`; Recipes entry point via Menu

---

## Verification Checklist

- `pnpm typecheck` must pass after every phase

**Phase 1:**
- Owner disables Todos → Todos tab hidden, Home TodoSection hidden, PlanRecipeSheet schedule button hidden, Todos settings row hidden; re-enable restores everything
- Non-owner cannot toggle area enable/disable
- All cross-area guard tests pass

**Phase 2:**
- User A pins Recipes → only User A's tab bar shows Recipes; User B's tab bar unchanged
- Disabled areas excluded from tab-pin options
- Reload → tabs match last saved selection

**Phase 3:**
- Menu tab visible and always last
- Calendar accessible directly in tab bar (default pinned)
- Recipes accessible via Menu nav card
- Settings reachable from Menu; gear icon gone from Home header
- `App.tsx` tab array never exceeds 5 items (Home + 3 area slots + Menu)

---

## Implementation Plan (for future agents)

> This section is the authoritative step-by-step guide. Execute phases in order. Each phase can be shipped independently.

### Notes before starting

- **Migration numbers:** Migrations `010` and `011` already exist. Use `012_areas_config.sql` and `013_tab_config.sql`.
- **Atomicity:** Steps 1.3 (frontend type) and 1.4 (worker response) must land in the same commit — TypeScript errors until both are present.
- **`ItemRow.tsx` guard:** Before implementing Step 1.11, read `frontend/src/components/ItemRow.tsx` to check whether `onToggle={undefined}` already suppresses the shopping toggle icon. If it does, no change to `ItemRow` is needed.
- **`useHouseholdSettings` in AppShell:** In Phase 2 Step 2.5, `AppShell` needs `useHouseholdSettings()` directly — it's used in child components today but not `AppShell` itself.
- **No breaking changes:** `GET /household/me` gains `areasConfig: null` by default; `GET /me` gains `tabConfig: null`. Existing consumers unaffected.

---

### Phase 1 — Area Enable/Disable (Household-Level)

**Goal:** Owners can enable/disable areas household-wide. Guards react everywhere those areas appear. No navigation changes.

#### Step 1.1 — DB migration: `areas_config` on `households`

**Create:** `worker/src/db/migrations/012_areas_config.sql`

```sql
ALTER TABLE households ADD COLUMN areas_config TEXT DEFAULT NULL;
-- NULL means all areas enabled (backwards-compatible)
```

Also update `worker/src/db/schema.sql` to include the new column.

Apply to remote:
```bash
cd worker && wrangler d1 execute casita --remote --file=src/db/migrations/012_areas_config.sql
```

---

#### Step 1.2 — Shared types

**Create:** `frontend/src/api/areas.ts`

```typescript
export type AreaId = 'calendar' | 'todos' | 'shopping' | 'recipes'

export interface HouseholdAreasConfig {
  [key in AreaId]?: { enabled: boolean }
}

export function isAreaEnabled(
  config: HouseholdAreasConfig | null | undefined,
  area: AreaId,
): boolean {
  if (!config) return true
  return config[area]?.enabled !== false
}
```

---

#### Step 1.3 — Extend `HouseholdSettings` type and add `useUpdateAreasConfig`

**Modify:** `frontend/src/api/household.ts`

1. Import `HouseholdAreasConfig` from `./areas`.
2. Add `areasConfig: HouseholdAreasConfig | null` to the `HouseholdSettings` interface.
3. Add mutation hook:

```typescript
export function useUpdateAreasConfig() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (areasConfig: HouseholdAreasConfig) =>
      api.patch<{ areasConfig: HouseholdAreasConfig }>('/household/areas', { areasConfig }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}
```

---

#### Step 1.4 — Worker: read/write `areas_config`

**Modify:** `worker/src/routes/household.ts`

**Change 1 — `getHousehold`:** Add `areas_config` to the SELECT. Parse and return as `areasConfig` in the JSON response.

**Change 2 — Add `updateAreasConfig` handler:**

```typescript
export async function updateAreasConfig(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  if (ctx.role !== 'owner') return err(403, 'ERR_FORBIDDEN')

  const body = await req.json<{ areasConfig?: unknown }>()
  const VALID_AREAS = ['calendar', 'todos', 'shopping', 'recipes'] as const

  if (!body.areasConfig || typeof body.areasConfig !== 'object' || Array.isArray(body.areasConfig))
    return err(400, 'ERR_INVALID_REQUEST')

  for (const [key, val] of Object.entries(body.areasConfig as Record<string, unknown>)) {
    if (!VALID_AREAS.includes(key as (typeof VALID_AREAS)[number])) return err(400, 'ERR_INVALID_AREA')
    if (typeof val !== 'object' || val === null || typeof (val as { enabled?: unknown }).enabled !== 'boolean')
      return err(400, 'ERR_INVALID_AREA_CONFIG')
  }

  await env.DB
    .prepare('UPDATE households SET areas_config = ? WHERE id = ?')
    .bind(JSON.stringify(body.areasConfig), ctx.householdId)
    .run()

  return Response.json({ areasConfig: body.areasConfig })
}
```

---

#### Step 1.5 — Register new worker route

**Modify:** `worker/src/index.ts`

Import `updateAreasConfig` and add to the routes array:
```typescript
['PATCH', new URLPattern({ pathname: '/household/areas', search: '*' }), updateAreasConfig],
```

---

#### Step 1.6 — Test fixture

**Create:** `frontend/src/test/fixtures/areasConfig.ts`

```typescript
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
```

---

#### Step 1.7 — Cross-area guard registry

**Create:** `frontend/src/test/crossAreaGuards.registry.ts`

```typescript
import type { AreaId } from '@/api/areas'

export const CROSS_AREA_GUARDS = [
  { area: 'todos',    location: 'Home.tsx / TodoSection' },
  { area: 'shopping', location: 'Home.tsx / ShoppingSection' },
  { area: 'calendar', location: 'Home.tsx / CalendarSection' },
  { area: 'recipes',  location: 'Home.tsx / RecipesSection' },
  { area: 'todos',    location: 'PlanRecipeSheet.tsx / schedule-as-task' },
  { area: 'shopping', location: 'Recipes.tsx / shopping-toggle' },
  { area: '*',        location: 'AreasSettings.tsx / tab-pin options' },
  { area: '*',        location: 'App.tsx / computed tab array' },
] as const satisfies Array<{ area: AreaId | '*'; location: string }>
```

---

#### Step 1.8 — Update MSW default handlers

**Modify:** `frontend/src/test/msw-server.ts`

Add `areasConfig: null` to the default `GET /household/me` response. Add a default `PATCH /household/areas` handler returning `{ areasConfig: null }`.

---

#### Step 1.9 — Guard: `Home.tsx`

**Modify:** `frontend/src/components/Home.tsx`

1. Call `useHouseholdSettings()`, extract `areasConfig`.
2. Wrap each section in `{isAreaEnabled(areasConfig, '<area>') && <Section />}`.

---

#### Step 1.10 — Guard: `PlanRecipeSheet.tsx` / `Recipes.tsx` (schedule-as-task)

**Modify:** `frontend/src/components/Recipes.tsx`

In `RecipeDetail`, call `useHouseholdSettings()`. Only render the `CalendarPlus` header button and `<PlanRecipeSheet>` when `isAreaEnabled(areasConfig, 'todos')` is true. Add `data-testid="schedule-as-task-btn"` to the `CalendarPlus` button.

---

#### Step 1.11 — Guard: `Recipes.tsx` ingredient shopping toggle

**Modify:** `frontend/src/components/Recipes.tsx`

In `RecipeDetail`, call `useHouseholdSettings()`. When `!isAreaEnabled(areasConfig, 'shopping')`, pass `onToggle={undefined}` to each ingredient `ItemRow`. First verify in `ItemRow.tsx` that `onToggle={undefined}` already suppresses the icon — if not, add a null guard there. Add `data-testid="shopping-toggle"` to the toggle control in `ItemRow`.

---

#### Step 1.12 — New component: `AreasSettings.tsx`

**Create:** `frontend/src/components/settings/AreasSettings.tsx`

Mirror the pattern of `TodosSettings.tsx` / `ShoppingSettings.tsx` (`setHeader` prop, `useEffect` sets header).

- **Owner section** (when `role === 'owner'`): a `Switch` per `AreaId` that calls `useUpdateAreasConfig()`. Add `data-testid="areas-settings-[areaId]-toggle"` to each switch.
- **Non-owner**: read-only display of which areas are enabled.
- Tab-pin section is added in Phase 2.

---

#### Step 1.13 — Link `AreasSettings` from `SettingsMenu` and `SettingsLayout`

**Modify:** `frontend/src/components/settings/SettingsMenu.tsx`

Add a row in the "Your Household" group pointing to `/settings/areas` with a `LayoutGrid` icon and i18n key `settings.menu.areasAndTabs`.

**Modify:** `frontend/src/components/settings/SettingsLayout.tsx`

Add lazy import and route: `<Route path="areas" element={<AreasSettings setHeader={setHeader} />} />`.

---

#### Step 1.14 — i18n keys

**Modify:** all four locale files under `frontend/src/locales/*/translation.json`

Add under `settings.menu`:
```json
"areasAndTabs": "Areas & Tabs",
"areasAndTabsDescription": "Enable or disable household areas"
```

Add new `settings.areas` object:
```json
"areas": {
  "title": "Areas & Tabs",
  "ownerSection": "Household areas",
  "ownerSectionDescription": "Disabled areas are hidden from all members.",
  "calendar": "Calendar",
  "todos": "To-Dos",
  "shopping": "Shopping",
  "recipes": "Recipes"
}
```

Use English as placeholder for non-English locales if translations aren't ready.

---

#### Step 1.15 — Export new symbols from `api/index.ts`

**Modify:** `frontend/src/api/index.ts`

```typescript
export type { AreaId, HouseholdAreasConfig } from './areas'
export { isAreaEnabled } from './areas'
export { useUpdateAreasConfig } from './household'
```

---

#### Step 1.16 — Tests: `Home.test.tsx`

**Modify:** `frontend/src/components/__tests__/Home.test.tsx`

Add a `withAreasConfig(areasConfig)` helper that uses `server.use(...)` to override `GET /household/me`. Add one `it` per guard row:

- `todos` disabled → `TodoSection` absent; re-enabled → present
- `shopping` disabled → `ShoppingSection` absent
- `calendar` disabled → `CalendarSection` absent
- `recipes` disabled → `RecipeSection` absent

---

#### Step 1.17 — Tests: `PlanRecipeSheet.test.tsx`

**Create:** `frontend/src/components/__tests__/PlanRecipeSheet.test.tsx`

Assert `data-testid="schedule-as-task-btn"` is absent when `todos` is disabled.

---

#### Step 1.18 — Tests: `Recipes.test.tsx`

**Create:** `frontend/src/components/__tests__/Recipes.test.tsx`

Assert `data-testid="shopping-toggle"` is absent when `shopping` is disabled.

---

#### Step 1.19 — Tests: `AreasSettings.test.tsx`

**Create:** `frontend/src/components/__tests__/AreasSettings.test.tsx`

Assert all 4 area toggles render when all areas are enabled. Assert a disabled area's toggle is in off state.

---

#### Step 1.20 — Registry lint test

**Create:** `frontend/src/test/crossAreaGuards.registry.test.ts`

```typescript
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
```

---

#### Phase 1 Verification

```bash
pnpm typecheck       # zero errors
pnpm test            # all new tests pass
```

Manual smoke: owner disables Todos → Todos section gone from Home, "Add to To-Dos" gone from recipe detail; re-enable restores everything. Non-owner cannot toggle area switches.

---

### Phase 2 — Per-User Tab Configurability

**Prerequisite:** Phase 1 complete and deployed.

**Goal:** Each user independently chooses which (up to 3) enabled areas appear as tabs. `App.tsx` builds the tab array dynamically.

---

#### Step 2.1 — DB migration: `tab_config` on `household_members`

**Create:** `worker/src/db/migrations/013_tab_config.sql`

```sql
ALTER TABLE household_members ADD COLUMN tab_config TEXT DEFAULT NULL;
-- NULL → default pinned tabs: ['calendar', 'todos', 'shopping']
```

Also update `worker/src/db/schema.sql`. Apply to remote:
```bash
cd worker && wrangler d1 execute casita --remote --file=src/db/migrations/013_tab_config.sql
```

---

#### Step 2.2 — Add `TabConfig` and `computePinnedTabs` to `areas.ts`

**Modify:** `frontend/src/api/areas.ts`

```typescript
export interface TabConfig {
  pinned: AreaId[]  // ordered, max 3
}

export const DEFAULT_PINNED_TABS: AreaId[] = ['calendar', 'todos', 'shopping']

export function computePinnedTabs(
  tabConfig: TabConfig | null | undefined,
  areasConfig: HouseholdAreasConfig | null | undefined,
): AreaId[] {
  const pinned = tabConfig?.pinned ?? DEFAULT_PINNED_TABS
  return pinned.filter((area) => isAreaEnabled(areasConfig, area)).slice(0, 3)
}
```

---

#### Step 2.3 — Worker: read/write `tab_config` on `GET /me` and `PATCH /me`

**Modify:** `worker/src/routes/me.ts`

- `getMe`: add `tab_config` to SELECT from `household_members`; return as `tabConfig: row.tab_config ? JSON.parse(row.tab_config) : null`.
- `updateMe`: accept optional `tabConfig` in PATCH body. Validate: `pinned` must be an array of `AreaId` strings, max 3, no duplicates. Persist as `JSON.stringify(tabConfig)` in `household_members`.

---

#### Step 2.4 — Extend `MeResponse` and add `useUpdateTabConfig`

**Modify:** `frontend/src/api/me.ts`

1. Import `TabConfig` from `./areas`.
2. Add `tabConfig: TabConfig | null` to `MeResponse`.
3. Add `useUpdateTabConfig` mutation hook that calls `PATCH /me` with `{ tabConfig }` and updates the `['me']` query cache on success.

Export `useUpdateTabConfig` from `api/index.ts`.

---

#### Step 2.5 — `App.tsx`: dynamic tab array

**Modify:** `frontend/src/components/App.tsx`

1. Import `computePinnedTabs` from `./api/areas`.
2. In `AppShell`, call `useMe()` and `useHouseholdSettings()`. Derive `pinnedAreas = computePinnedTabs(me?.tabConfig, settings?.areasConfig)`.
3. Build nav tabs as `['home', ...pinnedAreas]` using a `TAB_META` lookup map for icons/labels.
4. Add `data-testid={`nav-tab-${id}`}` to each tab button.

---

#### Step 2.6 — `AreasSettings.tsx`: per-user tab-slot section

**Modify:** `frontend/src/components/settings/AreasSettings.tsx`

Below the owner section, add a section labeled **"Your tabs — only visible to you"**:

- Call `useMe()` and `useUpdateTabConfig()`.
- List only enabled areas. Show a `Switch` per area for pinning. Disable the switch for unpinned areas when `pinnedAreas.length >= 3`.
- Add `data-testid="areas-settings-tab-pin-[areaId]"` to each pin switch.
- Disabled household areas are not listed here at all.

---

#### Step 2.7 — MSW: add default `/me` handlers

**Modify:** `frontend/src/test/msw-server.ts`

Add default handlers for `GET /me` (returns `tabConfig: null`) and `PATCH /me` (returns `{ ok: true, tabConfig: null }`).

---

#### Step 2.8 — Tests: `computePinnedTabs` unit tests

**Create:** `frontend/src/api/__tests__/computePinnedTabs.test.ts`

```typescript
describe('computePinnedTabs', () => {
  it('null tabConfig returns default pinned tabs')              // → ['calendar','todos','shopping']
  it('user pinned tabs override default')
  it('disabled areas are excluded from pinned tabs')
  it('max 3 tabs enforced')
  it('two users with different configs produce different results')
})
```

---

#### Step 2.9 — Tests: `App.test.tsx` (computed tab array guard)

**Create/extend:** `frontend/src/components/__tests__/App.test.tsx`

```typescript
describe('App.tsx / computed tab array', () => {
  it('disabled area cannot appear in computed tab array')  // recipes disabled, pinned → not in nav
})
```

---

#### Phase 2 Verification

```bash
pnpm typecheck
pnpm test
```

Manual smoke: User A pins Recipes → User A sees Recipes tab; User B (default) sees Calendar/Todos/Shopping. Disabled area excluded from pin options. Reload → tabs persist.

---

### Phase 3 — Menu Tab Navigation

**Prerequisite:** Phase 2 complete and deployed.

**Goal:** Permanent Menu tab replaces the Settings gear icon. Non-pinned areas accessible via Menu. Recipes defaults to Menu only.

---

#### Step 3.1 — New component: `Menu.tsx`

**Create:** `frontend/src/components/Menu.tsx`

- Call `useMe()` and `useHouseholdSettings()`.
- Compute `unpinnedEnabledAreas = allEnabledAreas.filter(not in pinnedSet)`.
- Render a nav card list for each unpinned enabled area using a `AREA_META` map (label, icon, path).
- Add `data-testid="menu-area-card-[areaId]"` to each card.
- Below the nav cards, render `<SettingsMenu />` (existing component, unchanged).

---

#### Step 3.2 — `App.tsx`: add `menu` tab and route

**Modify:** `frontend/src/App.tsx`

1. Add `'menu'` to `TabId` union and `TAB_PATHS` (`/menu`).
2. Update `pathnameToTab` to return `'menu'` for `/menu*`.
3. Update `isSettings` to also catch `/menu/settings`.
4. Remove the Settings gear icon button from the Home header.
5. Add `<Route path="/menu" element={<Menu />} />` inside `<Routes>`.
6. Append `{ id: 'menu', label: t('nav.menu'), icon: <LayoutGrid /> }` to the nav tabs array (always last).
7. Import `Menu` as a lazy component.

---

#### Step 3.3 — i18n: `nav.menu`

**Modify:** all four locale `translation.json` files

```json
"nav": {
  "menu": "Menu"
}
```

---

#### Step 3.4 — Tests: Phase 3 nav invariants

**Extend:** `frontend/src/components/__tests__/App.test.tsx`

```typescript
describe('Phase 3 nav invariants', () => {
  it('Menu tab is always last')
  it('tab array never exceeds 5 items')
  it('Recipes accessible via Menu when not pinned')   // assert data-testid="menu-area-card-recipes"
  it('gear icon absent from Home header')
})
```

---

#### Phase 3 Verification

```bash
pnpm typecheck
pnpm test
```

Manual smoke (from Verification Checklist above): Menu tab visible and last; Calendar in tab bar; Recipes in Menu nav card; Settings in Menu; no gear icon; tab bar ≤ 5 items.

---

### Step Sequencing Reference

| Order | Steps | Constraint |
|-------|-------|------------|
| 1 | 1.1 → deploy migration | Must deploy before worker reads the column |
| 2 | 1.3 + 1.4 | Land in same commit (types + worker response together) |
| 3 | 1.5 | After 1.4 |
| 4 | 1.2, 1.6, 1.7, 1.8 | Independent; can land together |
| 5 | 1.9–1.13 | After types and MSW handlers are ready |
| 6 | 1.14, 1.15 | Anytime during Phase 1 |
| 7 | 1.16–1.20 | After all guards are implemented |
| 8 | 2.1 → deploy migration | Before worker reads `tab_config` |
| 9 | 2.2–2.5 | 2.3 before 2.4; 2.5 after 2.2 and 2.4 |
| 10 | 2.6–2.9 | After 2.2–2.5 |
| 11 | 3.1–3.4 | All Phase 2 steps complete |
