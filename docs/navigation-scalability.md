# Navigation Scalability — Design Options

## Context

The current bottom nav has 5 fixed tabs (Home, Calendar, Todos, Shopping, Recipes). As the app grows (e.g. Finance), this doesn't scale. We also want to let households disable areas they don't use (e.g. "we don't need Todos"). This document covers two navigation approaches and the shared foundation both require.

---

## Shared Foundation (both options need this)

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
  [key: AreaId]: { enabled: boolean }
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

### Area settings UI

New page `components/settings/AreasSettings.tsx`:
- Owner section: toggle switches to enable/disable each area
- User section: tab configuration (differs between the two options below)
- Linked from `HouseholdSettings.tsx` via an "Areas & Tabs" row

---

## Option A: Menu Tab

### Concept

Replace the Settings gear icon in the Home header with a permanent **Menu** tab (always the last tab). The Menu tab hosts non-tab areas + all existing Settings entries. Maximum 5 tabs: Home · [up to 3 area slots] · Menu.

**Default tab bar:** Home · Todos · Shopping · Recipes · Menu  
**Calendar:** lives in the Menu by default (requires Google Calendar connection, so less essential out of the box); accessible there until the user pins it to a tab slot.

### Tab configurability (per-user)

New JSON column on `users` table:

```sql
ALTER TABLE users ADD COLUMN tab_config TEXT DEFAULT NULL;
```

```typescript
interface TabConfig { pinned: AreaId[] }  // ordered, max 3
```

Default when null: `['todos', 'shopping', 'recipes']`.  
Returned by `GET /me`, updated via `PATCH /me`.

### New components

- `components/Menu.tsx` — the `/menu` route. Top section: non-pinned enabled areas as nav cards. Bottom section: existing `SettingsMenu` content.
- `components/settings/AreasSettings.tsx` — enable/disable (owner) + tab-pin toggles (per-user, max 3 slots)

### App.tsx changes

- Add `'menu'` to `TabId` union and `TAB_PATHS`
- Tab array computed dynamically from `useMe().tabConfig` + `useHouseholdSettings().areasConfig`
- `/menu/*` route added, mounting `MenuLayout`
- Settings gear icon removed from Home header (~line 173)
- `pathnameToTab()` handles `/menu`
- `isSettings` guard also catches `/menu/settings`

### Pro / Con

| Pro | Con |
|-----|-----|
| Settings gets first-class navigation real estate as a tab | Current navigation changes (Calendar moves out of tabs) |
| Easy to add future areas (start in Menu, graduate to a tab) | New routing and layout complexity |
| Clean separation: tab = primary, menu = secondary | Users lose direct Calendar tab by default |

---

## Option B: Home as Hub

### Concept

Keep the current 5-tab structure and Settings gear icon exactly as they are. Home already aggregates all areas as widgets. When a new area (Finance) is introduced, it starts as a **Home widget**. Users can **elevate** any area to a dedicated tab — but doing so swaps out an existing tab (that area remains reachable via its Home widget).

**Default tab bar:** Home · Calendar · Todos · Shopping · Recipes (unchanged)  
**Finance (future):** appears as a Home widget; user promotes it to a tab by demoting one existing area.

### Tab configurability (per-user)

Same data model as Option A but with 4 slots (no Menu tab consuming one):

```typescript
interface TabConfig { pinned: AreaId[] }  // ordered, max 4
```

Default when null: `['calendar', 'todos', 'shopping', 'recipes']` (preserves current experience).

### Home widget navigation

The Home area sections are summary cards. When an area is not a tab, the only way to reach its full UI is via the Home widget. Each section header must navigate to the area route (e.g. `/todos`) when tapped — this may already work implicitly but needs to be verified and made explicit.

### New components

- `components/settings/AreasSettings.tsx` — enable/disable (owner) + tab-slot assignment (per-user, max 4 slots)
- No new routing or layout changes needed

### App.tsx changes

- `TabId` union stays at 5 members (no `menu`)
- Tab array computed dynamically from `useMe().tabConfig` + `useHouseholdSettings().areasConfig`
- Settings and header unchanged

### Pro / Con

| Pro | Con |
|-----|-----|
| No disruption to current navigation | Settings stays as a gear icon — less discoverable |
| Settings entry point unchanged | Non-tab areas only reachable via Home widgets |
| Home is already the aggregator — natural discovery surface | "See all" links on Home sections must be verified/added |
| Clean mental model: widget = preview, tab = full-screen experience | New areas stay buried in Home until the user consciously elevates them |
| Simpler implementation (no Menu component, no route changes) | |

---

## Recommended Phasing (applies to whichever option is chosen)

These phases can be shipped independently and in order.

**Phase 1 — Area enable/disable** (household-level, no navigation changes)
- DB migration `010_areas_config.sql`
- `useHouseholdSettings()` returns `areasConfig` with safe default
- `AreasSettings.tsx` with owner-only area toggles
- Guards in `Home.tsx`, `PlanRecipeSheet.tsx`, `Recipes.tsx`

**Phase 2 — Tab configurability** (per-user)
- DB migration: `tab_config` column on `users` table
- `PATCH /me` accepts and persists `tabConfig`
- `AreasSettings.tsx` gains a per-user tab-slot section
- `App.tsx` builds tab array dynamically instead of hardcoding it

**Phase 3 — Navigation change** (Option A only)
- Add Menu tab + `Menu.tsx` component
- Route and header changes in `App.tsx`

---

## Verification

- `pnpm typecheck` must pass after every phase
- **Phase 1:** owner disables Todos → Todos tab hidden, Home TodoSection hidden, PlanRecipeSheet calendar icon hidden, Todos settings row hidden; re-enable restores everything
- **Phase 2:** change tab preferences → reload → tabs match selection; disabled areas excluded from options
- **Phase 3 (Option A):** Menu tab visible; Calendar accessible via Menu nav card; Settings reachable from Menu; gear icon gone from Home header
