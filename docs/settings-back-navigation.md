# Settings Sub-Pages: History-Aware Back Navigation

## Problem

All settings sub-pages hardcode `navigate('/settings')` on their back button. This means no matter how the user arrived — from a deep link, a post-OAuth redirect, or a nudge from another tab — the back button always dumps them into the settings menu rather than back where they came from.

`CalendarSettings` was fixed on `ux/theme-accessibility` as a reference implementation.

## Target Behaviour

- If there is prior history in the session → go back (`navigate(-1)`)
- If there is no prior history (direct URL, post-OAuth redirect, fresh tab) → fall back to `/settings`

Detection: `location.key === 'default'` from `useLocation()` is React Router v6's signal that the current entry is the first in the stack.

## Reference Implementation (CalendarSettings.tsx)

```tsx
const navigate = useNavigate()
const location = useLocation()

// in the back button onClick:
onClick={() => location.key === 'default' ? navigate('/settings') : navigate(-1)}
```

`useLocation` must be imported alongside `useNavigate` from `'react-router-dom'`.

## Files to Update

All back-button `onClick` handlers that call `navigate('/settings')` directly:

| File | Line(s) | Notes |
|------|---------|-------|
| `settings/AccountSettings.tsx` | 45 | Single back button |
| `settings/HouseholdSettings.tsx` | 82 | Single back button |
| `settings/ShoppingSettings.tsx` | 35 | Single back button |
| `settings/RecipesSettings.tsx` | 24 | Single back button |
| `settings/ChangelogSettings.tsx` | 96 | Single back button |
| `settings/ImportSettings.tsx` | 17, 29, 30 | Back button + two `onDone`/`onSkip` callbacks — those two should stay as `navigate('/settings')` since they represent a completed flow, not a back action |

## What Not to Change

- `ImportSettings` lines 29–30 (`onDone` / `onSkip`) — these fire after the user completes or dismisses the import flow. Going to `/settings` is the correct destination regardless of entry point; they are forward navigation, not back.
- Any `navigate('/settings/...')` calls that are forward navigations into sub-pages.

## Suggested Approach

Extract a small utility or hook to keep the pattern DRY across all pages:

```tsx
// frontend/src/hooks/useSettingsBack.ts
import { useNavigate, useLocation } from 'react-router-dom'

export function useSettingsBack() {
  const navigate = useNavigate()
  const location = useLocation()
  return () => location.key === 'default' ? navigate('/settings') : navigate(-1)
}
```

Then each page becomes:

```tsx
const goBack = useSettingsBack()
// ...
<Button onClick={goBack} aria-label="Back">
```

This avoids repeating the `location.key` check in every file and makes future changes a one-liner.
