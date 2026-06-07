# Recipe Day-of-Week Calendar Integration

## Context

Recipes already have a `day` TEXT field (e.g. "Monday", "Friday") set via the Autocomplete in `RecipeFormPage`. Right now that field is only shown as a chip in the recipe card — it has no effect on the Calendar view or the Home page recipe widget.

This plan makes the `day` field functional:

1. **Calendar** — recipes appear on every occurrence of their assigned weekday in the visible month. Clicking a recipe navigates to it.
2. **Home widget** — if any recipe is assigned to today's weekday, it is shown highlighted instead of a random one.

No backend changes are needed. The `day` field is already in the schema, returned by the API, and typed throughout.

---

## Scope

**Files to change:**
- `frontend/src/components/Calendar.tsx`
- `frontend/src/components/Home.tsx`

**Files unchanged:**
- `worker/src/db/schema.sql` — `day TEXT` column already exists
- `worker/src/types.ts` — `Recipe.day` already typed
- `frontend/src/api/recipes.ts` — `useRecipes()` already returns `day`
- `frontend/src/components/RecipeFormPage.tsx` — form already has day Autocomplete

**Out of scope:**
- Multiple days per recipe (would require a new `recipe_days` join table and a schema migration)
- Filtering/sorting by day in the Recipes grid page
- Pushing recipe events into Google Calendar

---

## 1. Calendar change (`Calendar.tsx`)

### Goal
For every date in the visible month, find recipes whose `day` matches that date's weekday name, and inject them as tappable entries in the agenda list alongside Google Calendar events.

### Approach

**Add a helper** to get a weekday name ("Monday" … "Sunday") from a "YYYY-MM-DD" string:

```ts
function weekdayName(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'long' })
}
```

**Add a recipe day map** in the `Calendar` component — all dates in the visible month keyed by their weekday:

```ts
const { data: recipes } = useRecipes()

const recipeDayMap = useMemo(() => {
  // Build map: dateKey → Recipe[]
  const map = new Map<string, Recipe[]>()
  if (!recipes?.length) return map

  const last = new Date(viewYear, viewMonth + 1, 0).getDate()
  for (let d = 1; d <= last; d++) {
    const key = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const weekday = weekdayName(key)
    const hits = recipes.filter(r => r.day === weekday)
    if (hits.length) map.set(key, hits)
  }
  return map
}, [recipes, viewYear, viewMonth])
```

**Merge into `dayGroups`**: after building `dayGroups` from Google events, extend it by adding any date keys that only appear in `recipeDayMap` (i.e. no Google events that day), then sort the combined list.

```ts
const allDayKeys = useMemo(() => {
  const keys = new Set(dayGroups.map(g => g.dateKey))
  for (const k of recipeDayMap.keys()) keys.add(k)
  return Array.from(keys).sort()
}, [dayGroups, recipeDayMap])
```

**Add a `RecipeCard` component** (similar to `EventCard`) that uses `useNavigate` to go to `/recipes/:id` on click:

```tsx
function RecipeCard({ recipe }: { recipe: Recipe }) {
  const navigate = useNavigate()
  return (
    <Box
      onClick={() => navigate(`/recipes/${recipe.id}`)}
      sx={{
        display: 'flex', alignItems: 'stretch',
        bgcolor: 'background.paper', borderRadius: 1.5,
        overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)',
        mb: 1, cursor: 'pointer',
        '&:active': { opacity: 0.7 },
      }}
    >
      <Box sx={{ width: 4, flexShrink: 0, bgcolor: 'success.main' }} />
      <Box sx={{ px: 1.5, py: 1.25, flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>{recipe.name}</Typography>
        <Typography variant="caption" color="text.secondary">Recipe</Typography>
      </Box>
    </Box>
  )
}
```

**Update `DaySection`** to accept and render recipe cards below Google events:

```tsx
function DaySection({
  dateKey, events, recipes,
}: { dateKey: string; events: CalendarEvent[]; recipes: Recipe[] }) {
  // ...existing rendering...
  {recipes.map(r => <RecipeCard key={r.id} recipe={r} />)}
}
```

**Update the render loop** to pass recipes per day:

```tsx
{allDayKeys.map(dateKey => (
  <DaySection
    key={dateKey}
    dateKey={dateKey}
    events={dayGroups.find(g => g.dateKey === dateKey)?.events ?? []}
    recipes={recipeDayMap.get(dateKey) ?? []}
  />
))}
```

**Skip past dates**: to avoid cluttering the calendar with past recipe entries, apply the same logic as `timeMinFor` — only include recipe dates from today onwards when viewing the current month. For future months, include all dates.

```ts
// inside the recipeDayMap useMemo:
const todayNum = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate()
const [ky, km, kd] = key.split('-').map(Number)
const keyNum = ky * 10000 + km * 100 + kd
if (viewYear === today.getFullYear() && viewMonth === today.getMonth() && keyNum < todayNum) continue
```

---

## 2. Home widget change (`Home.tsx`)

### Goal
Show today's recipe highlighted instead of a random one when a match exists.

### Approach

In `RecipeSection`, before falling back to the `seed`-based random pick, check if any recipe is assigned to today's weekday:

```ts
const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) // e.g. "Saturday"

const { recipe, isToday } = useMemo(() => {
  if (!recipes?.length) return { recipe: null, isToday: false }
  const todayRecipes = recipes.filter(r => r.day === todayWeekday)
  if (todayRecipes.length) {
    // Pick first (or cycle via seed within the today subset)
    return { recipe: todayRecipes[Math.floor(seed * todayRecipes.length) % todayRecipes.length], isToday: true }
  }
  return { recipe: recipes[Math.floor(seed * recipes.length) % recipes.length], isToday: false }
}, [recipes, seed, todayWeekday])
```

**Highlight when `isToday`**: add a small badge or label above the card, and swap the section header:

```tsx
<SectionHeader
  label={isToday ? "Tonight's recipe" : "Cook this week"}
  action={/* refresh button, unchanged */}
/>
```

Optionally add a green "Today" chip or border accent on the card when `isToday` is true:

```tsx
{isToday && (
  <Chip
    label="Today"
    size="small"
    color="success"
    sx={{ position: 'absolute', top: 8, left: 8, zIndex: 3, fontSize: 10, height: 18 }}
  />
)}
```

The refresh button continues to work — if there are multiple recipes for today it cycles among them; if there's only one it has no visible effect.

---

## Verification

1. **Assign a recipe to today's weekday** via the recipe edit form.
   - Home widget should now show that recipe with the "Today" label / "Tonight's recipe" heading.
   - The refresh button should still work (no-op if only one today-recipe, cycles if multiple).

2. **Open the Calendar tab** (current month).
   - The recipe should appear on every remaining occurrence of that weekday this month as a green-accented card.
   - Tapping the card should navigate to the recipe detail page.

3. **Navigate to next month** in the Calendar.
   - The recipe should appear on every occurrence of that weekday throughout the whole month.

4. **Recipe with no `day` field** — should not appear in the calendar at all; home widget should continue showing a random recipe (unchanged behaviour).

5. **Multiple recipes on the same day** — all should appear in the calendar; the home widget should cycle through them with the refresh button.
