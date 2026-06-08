# Shopping List Warning Banner — Smart Default + Dismissable

## Context

When items on the shopping list lack a category or supermarket, a yellow warning banner always appears. This is useful for households using the category/supermarket system to organize trips, but it's noisy for users who simply want a bare alphabetical list and never intend to set up categories or supermarkets.

The fix should serve both user types without requiring any explicit opt-in:
- **Simple-list users**: never see warnings (they haven't set up any concepts)
- **Organized users**: see warnings to guide them, can dismiss when not useful

## Approach

Two layers, no backend changes required:

1. **Smart default** — only show the banner when the household has at least one category **or** supermarket defined. If no concepts exist, there's no organizational system to enforce, so warnings are meaningless.

2. **Dismissable** — add an X button. Dismissed state is stored in `localStorage` keyed by household ID. Auto-resets if new incomplete items appear beyond the dismissed count (e.g., dismissed at 3 items; adding 2 more uncategorized items shows the banner again).

## File to Change

**`frontend/src/components/ShoppingList.tsx`** (only file)

### 1. New imports

Add to the existing import block:
- `X` from `lucide-react` (alongside the existing `ChevronUp`/`ChevronDown` import)
- `useConceptList` from `'../api/concepts'`
- `useHousehold` from `'../context/AuthContext'`

### 2. New state and derived values

Add inside the `ShoppingList` component, after existing state declarations:

| Symbol | Source | Notes |
|---|---|---|
| `householdId` | `useHousehold()` | Used to scope the localStorage key |
| `categories`, `supermarkets` | `useConceptList` | Determines whether any org system is set up |
| `hasAnyConcepts` | derived | `categories.length > 0 \|\| supermarkets.length > 0` |
| `dismissKey` | derived | `casita:shopping-warning-dismissed:{householdId}` |
| `dismissedCount` | `useState` | Initialized from localStorage; `null` means never dismissed |
| `useEffect` | — | Syncs `dismissedCount` from localStorage when `householdId` resolves |
| `isBannerVisible` | derived | `hasAnyConcepts && incompleteItems.length > 0 && (dismissedCount === null \|\| incompleteItems.length > dismissedCount)` |
| `handleDismissWarning` | function | Saves current `incompleteItems.length` to localStorage and updates `dismissedCount` |

### 3. Replace warning banner JSX (lines 342–358)

- Change the render condition from `incompleteItems.length > 0` to `isBannerVisible`
- Wrap the existing "Review" button and a new X dismiss button in a `flex items-center gap-1` container
- X button: `size="icon"` ghost `Button` with `aria-label="Dismiss warning"`, renders `<X className="h-4 w-4" />`

## Behavior

| Scenario | Result |
|---|---|
| No concepts defined | Banner never shows — simple-list users unaffected |
| Concepts exist, incomplete items present | Banner shows with "Review" and X buttons |
| User dismisses at N items | Banner hides; reappears only if incomplete count grows past N |
| Page refresh after dismiss | Banner stays hidden (persisted in localStorage) |
| Concepts loading | `hasAnyConcepts` is false → banner briefly suppressed (imperceptible in practice) |

Dismiss state is **per-device** (localStorage), which is appropriate — this is a UI preference, not a household-level setting.

## Verification

1. Start the dev server: `cd frontend && npm run dev`
2. **Simple-list user path**: Go to Settings and confirm no categories or supermarkets exist → add items to the shopping list without a category → confirm the warning banner does not appear.
3. **Organized user path**: Add at least one category in Settings → go to the shopping list with incomplete items → confirm the banner appears with both a "Review" button and an X button.
4. **Dismiss**: Click X → banner disappears → refresh the page → banner stays gone.
5. **Auto-reset**: After dismissing, add more uncategorized items until the count exceeds the dismissed count → confirm the banner reappears.
