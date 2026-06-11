# Settings Subpages Redesign

## Context

The current `Settings.tsx` is a single 695-line monolithic page with six sections: Account, Appearance, Household, Google Calendar, Shopping, and Recipes. As the app grows (tipping jar, about/legal pages, per-module settings, todos settings), this pattern won't scale. Settings also needs better accessibility and a richer tag-management UX.

This plan restructures settings into a hub-and-spoke navigation model: a main Settings menu links to focused subpages, one per domain. The tag management UI (shopping categories, supermarkets, recipe types) is upgraded from badge chips to a sortable card list — consistent with the dnd-kit patterns already in RecipeFormPage.

**Outcome**: a plan file (this document) to hand off to developers; not a live implementation yet.

---

## Architecture Overview

```
/settings           → SettingsMenu (hub: list of nav items)
/settings/account   → AccountSettings (profile, appearance, danger zone)
/settings/household → HouseholdSettings (name, invite code, members, danger zone)
/settings/calendar  → CalendarSettings (Google Calendar connect + per-calendar controls)
/settings/shopping  → ShoppingSettings (categories + supermarkets via ConceptManager)
/settings/recipes   → RecipesSettings (recipe types via ConceptManager)
/settings/about     → AboutSettings (privacy, terms, version, tipping jar)
```

---

## 1. App.tsx Routing Changes

**File**: `frontend/src/App.tsx`

### 1a. Update `isSettings` detection (line 120)

```tsx
// Before
const isSettings = location.pathname === '/settings'

// After
const isSettings = location.pathname.startsWith('/settings')
```

This one-line change makes the header, bottom-nav suppression, and `pb-2` padding all work correctly for every `/settings/*` subpage automatically.

### 1b. Header handling — use `setHeader` (same as Calendar/Todos/Shopping)

The AppShell header for `/settings` keeps rendering `<h1>Settings</h1>` as the generic fallback. Each subpage overrides it by calling `setHeader(...)` in a `useEffect` — the same pattern already used by Calendar, Todos, and Shopping.

**SettingsLayout** and **SettingsMenu** do NOT call `setHeader`. Each sub-page (AccountSettings, HouseholdSettings, etc.) calls `setHeader` to render its own `<ArrowLeft> → /settings | Subpage Title` header.

**Wire `setHeader` into SettingsLayout**: App.tsx must pass `setHeader` (i.e., `setHeaderContent`) to SettingsLayout, which threads it to each subpage. This mirrors how it's already passed to `<Calendar setHeader={setHeaderContent} />` etc.

```tsx
// In AppShell's <Routes>:
<Route path="/settings/*" element={
  <TabErrorBoundary key="settings">
    <Suspense fallback={<SuspenseFallback />}>
      <SettingsLayout
        themePrefs={themePrefs}
        setThemePrefs={setThemePrefs}
        themeSaving={themeSaving}
        setHeader={setHeaderContent}
      />
    </Suspense>
  </TabErrorBoundary>
} />
```

**Subpage header pattern** (same for all 6 subpages):

```tsx
useEffect(() => {
  setHeader(
    <>
      <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} className="-ml-2" aria-label="Back to Settings">
        <ArrowLeft />
      </Button>
      <h1 className="flex-1 text-lg font-bold">Account</h1>
    </>
  )
  return () => setHeader(null)
}, [navigate, setHeader])
```

### 1c. Update the route (line 214)

```tsx
// Before
<Route path="/settings" element={...SettingsPage...} />

// After
<Route path="/settings/*" element={
  <TabErrorBoundary key="settings">
    <Suspense fallback={<SuspenseFallback />}>
      <SettingsRouter themePrefs={themePrefs} setThemePrefs={setThemePrefs} themeSaving={themeSaving} />
    </Suspense>
  </TabErrorBoundary>
} />
```

### 1d. Update `pb` class condition (line 181)

```tsx
// Before — only checks isSettings
isSettings || isRecipeDetail ? 'pb-2' : 'pb-[calc(80px+env(safe-area-inset-bottom))]'
// No change needed since isSettings now covers all /settings/* paths
```

### 1e. Update lazy import (line 25)

```tsx
// Before
const SettingsPage = lazy(() => import('./components/Settings'))

// After
const SettingsLayout = lazy(() => import('./components/settings/SettingsLayout'))
```

---

## 2. File Structure

Create `frontend/src/components/settings/` directory with these files:

```
settings/
├── SettingsRouter.tsx      ← internal <Routes> + props distribution
├── SettingsMenu.tsx        ← hub page with nav list
├── AccountSettings.tsx     ← profile, appearance, danger zone
├── HouseholdSettings.tsx   ← name, invite, members, danger zone
├── CalendarSettings.tsx    ← Google Calendar integration
├── ShoppingSettings.tsx    ← categories + supermarkets
├── RecipesSettings.tsx     ← recipe types
├── AboutSettings.tsx       ← legal, version, tipping jar
└── ConceptManager.tsx      ← new sortable card-based concept editor
```

The old `Settings.tsx` can be deleted once all sections are migrated.

### SettingsLayout.tsx

This component owns the internal routing and distributes props. Rename import from `SettingsRouter` to `SettingsLayout` in App.tsx.

```tsx
import { Routes, Route, Navigate } from 'react-router-dom'
import type { ThemePrefs } from '@/lib/theme'
import type { ReactNode } from 'react'

interface Props {
  themePrefs: ThemePrefs
  setThemePrefs: (p: ThemePrefs) => void
  themeSaving: boolean
  setHeader: (node: ReactNode | null) => void
}

export default function SettingsLayout({ themePrefs, setThemePrefs, themeSaving, setHeader }: Props) {
  return (
    <Routes>
      <Route index element={<SettingsMenu />} />
      <Route path="account"   element={<AccountSettings themePrefs={themePrefs} setThemePrefs={setThemePrefs} themeSaving={themeSaving} setHeader={setHeader} />} />
      <Route path="household" element={<HouseholdSettings setHeader={setHeader} />} />
      <Route path="calendar"  element={<CalendarSettings  setHeader={setHeader} />} />
      <Route path="shopping"  element={<ShoppingSettings  setHeader={setHeader} />} />
      <Route path="recipes"   element={<RecipesSettings   setHeader={setHeader} />} />
      <Route path="about"     element={<AboutSettings     setHeader={setHeader} />} />
      <Route path="*"         element={<Navigate to="/settings" replace />} />
    </Routes>
  )
}
```

---

## 3. SettingsMenu Design

A touch-friendly nav list in card groups. Each row: `icon | label + description | ChevronRight`. Min tap target 44px.

```
┌─────────────────────────────────┐
│  PERSONAL                       │
│  ┌───────────────────────────┐  │
│  │ 👤 Account           ›    │  │
│  │    Profile, theme, sign out│  │
│  └───────────────────────────┘  │
│                                 │
│  YOUR HOUSEHOLD                 │
│  ┌───────────────────────────┐  │
│  │ 🏠 Household         ›    │  │
│  │    Members, invite code   │  │
│  │ ─────────────────────     │  │
│  │ 📅 Calendar          ›    │  │
│  │    Google Calendar sync   │  │
│  │ ─────────────────────     │  │
│  │ 🛒 Shopping          ›    │  │ ← owner-only
│  │    Categories, stores     │  │
│  │ ─────────────────────     │  │
│  │ 🍳 Recipes           ›    │  │ ← owner-only
│  │    Recipe types           │  │
│  └───────────────────────────┘  │
│                                 │
│  ABOUT                          │
│  ┌───────────────────────────┐  │
│  │ ℹ️  About Casita      ›    │  │
│  │    Privacy, terms, support│  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

**Implementation notes**:
- Use `useNavigate()` for row `onClick`
- Use `useHousehold()` to conditionally show owner-only rows
- Import icons from `lucide-react`: `User`, `Home`, `CalendarDays`, `ShoppingCart`, `BookOpen`, `Info`, `ChevronRight`
- Card-grouped rows pattern: wrap each group in `<div className="bg-card rounded-lg border divide-y">` and each row in `<button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent transition-colors">`

---

## 4. ConceptManager Component

**File**: `frontend/src/components/settings/ConceptManager.tsx`

This replaces the existing `ConceptSection` (badge-based) with a sortable card list.

### Props
```tsx
interface ConceptManagerProps {
  type: ConceptType        // 'categories' | 'supermarkets' | 'recipe-types'
  label: string            // section heading
  addPlaceholder: string   // placeholder for new item input
  ownerOnly?: boolean      // hides add/edit/delete if not owner
}
```

### Visual Design — Each row

```
┌──────────────────────────────────────────┐
│  ⠿  Dairy             ✏️  🗑️             │
└──────────────────────────────────────────┘
│  ⠿  Produce           ✏️  🗑️             │
│  ⠿  Frozen            ✏️  🗑️             │
│                                          │
│  + Add category                          │
```

- `⠿` = `GripVertical` icon, only shown when `ownerOnly` user is owner — touch/mouse drag handle
- Name: plain text when not editing, `<Input>` when editing
- `✏️` = `Pencil` icon button, `aria-label="Edit [name]"`
- `🗑️` = `Trash2` icon button, `aria-label="Delete [name]"`
- "Add" row at bottom: click reveals an Input; Enter/blur to confirm

### State
```tsx
const [editingId, setEditingId] = useState<string | null>(null)
const [editName, setEditName] = useState('')
const [deletePending, setDeletePending] = useState<ConceptItem | null>(null)
const [deleteError, setDeleteError] = useState<string | null>(null)
const [addingNew, setAddingNew] = useState(false)
const [newName, setNewName] = useState('')
const [items, setItems] = useState<ConceptItem[]>([]) // local reordered state
```

### dnd-kit Integration

Use `@dnd-kit/sortable` (already installed):

```tsx
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, verticalListSortingStrategy,
  useSortable, arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
```

On `DragEnd`: call `arrayMove`, update local `items` state, then call `useReorderConcepts` mutation (see §5).

### Delete Flow

1. Click 🗑️ → set `deletePending = concept` → AlertDialog opens
2. AlertDialog content: `"Delete [name]? Items using this [label] will have it cleared."`
3. Confirm → call `remove(id)` → on success close dialog
4. On error → show inline amber banner below the item row with the error message (same pattern as current ConceptSection)
5. Cancel → clear `deletePending`

**Accessibility**:
- `AlertDialog` with proper `AlertDialogTitle` and `AlertDialogDescription` (currently done in the app)
- After deletion, focus the previous item or the "Add" button

### Keyboard support

- `Tab` moves between rows
- When focused on grip handle: `Space` or `Enter` could optionally enter keyboard reorder mode (stretch goal — defer)
- In edit input: `Enter` saves, `Escape` cancels

### Loading skeleton

Render 3 skeleton rows matching the row height while `isLoading`.

---

## 5. Reorder — Frontend Only, No Backend Changes

**No new backend endpoint is needed.** The existing `PATCH /concepts/:type/:id` already accepts `sort_order` in the body alongside `name`. Reorder fires N individual PATCHes — one per item with its new index. Concept lists are small in practice (typically < 20 items), so this is acceptable for v1.

Add a `useReorderConcepts` hook to `frontend/src/api/concepts.ts`:

```typescript
export function useReorderConcepts(type: ConceptType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (items: ConceptItem[]) => {
      // TODO: replace with bulk endpoint if lists grow large
      await Promise.all(
        items.map((item, idx) =>
          api.patch(`/concepts/${type}/${item.id}`, { sort_order: idx })
        )
      )
    },
    onMutate: async (items) => {
      await qc.cancelQueries({ queryKey: conceptKeys.list(type) })
      const previous = qc.getQueryData<ConceptItem[]>(conceptKeys.list(type))
      qc.setQueryData<ConceptItem[]>(
        conceptKeys.list(type),
        items.map((c, i) => ({ ...c, sort_order: i }))
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(conceptKeys.list(type), ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: conceptKeys.list(type) }),
  })
}
```

---

## 6. Per-Subpage UX Improvements

### AccountSettings
- Avatar + full name + email at top — copy from current Settings.tsx lines 284–297
- Move **Appearance** (ThemeCustomizer) here as the second section — it's a personal preference
- Sign out as a prominent secondary button (not a bare text link)
- Danger zone card at bottom: "Download my data" + "Delete account" with red styling
- `aria-label` on the Avatar fallback character

### HouseholdSettings
- Household name with pencil edit (owner only) — verbatim from current
- Invite code display in monospace badge with copy/regenerate/revoke
- Member list: each member as a card row with avatar, name, role badge
- "Transfer ownership" and "Make owner" buttons get `aria-label` context
- Danger zone: Leave household / Delete household

### CalendarSettings
- **Move OAuth result handling here** — the `useSearchParams()` for `?google=connected|error` banner currently lives at the top of `Settings.tsx`. Move it to `CalendarSettings.tsx`, where it belongs contextually.
- Add a short explainer sentence above the calendar list: "Choose which of your Google calendars are visible to your household."
- Calendar color dot gets `aria-label="[name] calendar color"`
- The "Private — only me" visibility dropdown text could be clearer: consider "Only you" / "Full events (household)" / "Busy only (household)"

### ShoppingSettings
- Two `<ConceptManager>` blocks: Categories, Supermarkets
- Brief intro copy: "These labels help you organize your shopping list and group items by store."
- **Move `backfillConcepts` here** — the `useBackfillConcepts()` call currently lives in `Settings.tsx` with a `useRef` guard. Move it to `ShoppingSettings.tsx`. It only needs to fire when the user lands on the Shopping settings subpage, which is more targeted (and lazier) than the current "fires on every Settings open" behavior.

### RecipesSettings
- One `<ConceptManager>` block: Recipe Types
- Brief intro copy: "Types help you filter and browse your recipe collection."

### AboutSettings
```
┌──────────────────────────────────┐
│  Casita  v1.0.0                  │
│  Your household, organized.      │
├──────────────────────────────────┤
│  Privacy Policy             ›    │
│  Terms of Service           ›    │
├──────────────────────────────────┤
│  Support Casita                  │
│  ┌──────────────────────────┐    │
│  │  ☕ Tipping jar          │    │
│  │  Coming soon             │    │
│  └──────────────────────────┘    │
└──────────────────────────────────┘
```

- App version from `import.meta.env.VITE_APP_VERSION` (set this in vite.config.ts via `define`)
- Privacy URL: `https://casita.bernardoprd.com/privacy` (already in existing Settings.tsx line 658)
- Terms URL: TBD — add when page exists
- Tipping jar: placeholder card with "Coming soon" — no functionality yet

---

## 7. Accessibility Checklist

Apply throughout all subpages:

| Item | Where |
|------|-------|
| `aria-label` on every icon-only button | Edit, Delete, Grip, Copy, Back |
| `role="list"` + `role="listitem"` on ConceptManager rows | ConceptManager.tsx |
| Focus management: after add, focus the new row | ConceptManager.tsx |
| Focus management: after delete, focus previous row or Add button | ConceptManager.tsx |
| Screen reader–only status on drag reorder | DnD accessible context |
| Color contrast: amber warning text on amber bg meets AA | Verify `text-amber-800 bg-amber-50` — passes |
| All links (`<a>`) have descriptive text, not "click here" | AboutSettings |
| Separator elements get `role="separator"` | Automatic with shadcn Separator |

---

## 8. Migration Strategy

**One-shot rewrite** (recommended): all six subpages + ConceptManager extracted simultaneously via parallel agents, then App.tsx routing updated. The old `Settings.tsx` is deleted at the end. No interim broken state since it's behind a feature branch.

Incremental is not worth the effort for this codebase — it's a self-contained page with no deeply shared state that can't be extracted cleanly.

---

## 9. Parallel Agent Development Plan

The work is well-suited to run in parallel. After routing is decided (§1 + §2 above), these streams are independent:

| Agent | Task | Files | Depends on |
|-------|------|-------|------------|
| **A — Backend** | Add `PUT /concepts/:type/order` endpoint | `worker/src/routes/concepts-d1.ts` | Nothing |
| **B — ConceptManager** | Build new sortable component + `useReorderConcepts` hook | `settings/ConceptManager.tsx`, `api/concepts.ts` | Agent A (or stub the hook) |
| **C — Personal pages** | Extract AccountSettings + HouseholdSettings from Settings.tsx | `settings/AccountSettings.tsx`, `settings/HouseholdSettings.tsx` | Nothing |
| **D — Module pages** | Extract CalendarSettings + ShoppingSettings + RecipesSettings | `settings/CalendarSettings.tsx`, `settings/ShoppingSettings.tsx`, `settings/RecipesSettings.tsx` | Agent B (for ShoppingSettings + RecipesSettings to use ConceptManager) |
| **E — Nav + wiring** | Build SettingsMenu + AboutSettings + SettingsRouter + App.tsx routing update | `settings/SettingsMenu.tsx`, `settings/AboutSettings.tsx`, `settings/SettingsRouter.tsx`, `App.tsx` | All others |

**Suggested launch sequence**:
1. Launch Agents A, B, C simultaneously (all independent)
2. When A completes, B can finalize the hook
3. When B completes, launch Agent D
4. When C + D complete, launch Agent E
5. After E: delete old `Settings.tsx`, run `npm run build` to check for errors

Total wall-clock time with parallel execution: ~3 agent rounds vs ~5 sequential.

---

## 10. Open Questions / Decisions to Make Before Dev

| Question | Recommendation |
|----------|----------------|
| Should todos get a settings subpage? | Skip for now — no todo-specific settings exist. Add later if needed. |
| Should Appearance stay in Account, or be its own subpage? | Let's have it in Household as it's a household setting.|
| Tipping jar: Stripe, Ko-fi embed, or external link? | Nothing for now, don't tackle it |
| Keyboard reordering in ConceptManager? | Defer — dnd-kit supports it, add in a follow-up when accessibility audit runs. |
| Terms of Service URL? | https://casita.bernardoprd.com/terms |
| `VITE_APP_VERSION` env var: where set? | We don't need an app version for now |
| Does reorder need a new backend endpoint? | No — existing `PATCH /concepts/:type/:id` already accepts `sort_order`. Fire N PATCHes in parallel. Add a bulk endpoint if lists grow large. |
| Non-owners: show or hide Shopping/Recipes in menu? | Show rows to everyone; access guard lives inside the subpage, not on the menu. Prevents the menu from changing shape after ownership transfers. |

---

## 11. Verification Checklist

After implementation, verify:

1. `npm run build` in `frontend/` — no TypeScript errors
2. Navigate to `/settings` → SettingsMenu renders with all nav rows
3. Owner vs non-owner: Shopping and Recipes rows hidden for members
4. Each subpage: back arrow → `/settings`; AppShell header shows subpage name
5. ConceptManager: add, edit, delete, reorder all work for categories
6. Delete in-use concept: amber error displays inline on the row
7. Google Calendar OAuth callback → `/settings?google=connected` → redirects to `/settings/calendar` or just `/settings` (keep current behavior)
8. ThemeCustomizer accessible from AccountSettings
9. AboutSettings: privacy link opens in new tab
10. Mobile: bottom nav hidden on all `/settings/*` routes
11. Resize to 320px wide — all rows still readable, no horizontal scroll


## 12. Review

1. Delete my data shouldn't be destructive nor inside of the danger zone.
2. Customize theme could be in the household page isntead of a dialog
3. Let's have the make owner on the left side of the member tag 
4. Let's have the name of the household be a heading row similar to recipeform and then below you have the users in the household with tags and button. The code and options can leave below this card.
5. The reaction of the calendar toggles is a bit wonky. I click and nothing happens.
6. The tags in shopping are also not using the cards like we have in recipeform. A single card for categories with itemrow to order, edit and delete.
7. In recipes, we should have "Type" only, not "Recipe Type".

