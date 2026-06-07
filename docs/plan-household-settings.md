# Plan: Household Settings Screen

## Goal

Surface household management (rename, invite code, member list) in the existing Settings screen, accessible from the Calendar tab gear icon.

---

## Decision: Append to `Settings.tsx` (no new route)

`AppShell` already handles `/settings` specially (back arrow, no bottom nav, correct padding). Adding a second sub-screen path would require duplicating that logic. A new `<Divider>` + section in `Settings.tsx` is the minimum-change approach and matches how calendar settings were added.

---

## Change 1 — Backend: expose `invite_code` in `GET /household/me`

**`worker/src/routes/household.ts`** — `getHousehold`:

Change the query:
```sql
-- before
SELECT id, name FROM households WHERE id = ?
-- after
SELECT id, name, invite_code FROM households WHERE id = ?
```

Update the type annotation and response:
```typescript
const household = await env.DB
  .prepare('SELECT id, name, invite_code FROM households WHERE id = ?')
  .bind(ctx.householdId)
  .first<{ id: string; name: string; invite_code: string | null }>()

return Response.json({
  householdId: household.id,
  householdName: household.name,
  inviteCode: household.invite_code,   // ← new field
  role: ctx.role,
  members: members.results.map(m => ({ clerkUserId: m.clerk_user_id, role: m.role })),
})
```

---

## Change 2 — Backend: `PATCH /household` (rename)

**`worker/src/routes/household.ts`** — add new handler:

```typescript
export async function renameHousehold(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'Forbidden')
  if (ctx.role !== 'owner') return err(403, 'Forbidden')

  const { name } = await req.json<{ name: string }>()
  if (!name?.trim()) return err(400, 'name is required')

  await env.DB
    .prepare('UPDATE households SET name = ? WHERE id = ?')
    .bind(name.trim(), ctx.householdId)
    .run()

  return Response.json({ ok: true, name: name.trim() })
}
```

**`worker/src/index.ts`** — add to import and routes array:

```typescript
import { getHousehold, createHousehold, joinHousehold, generateInvite, revokeInvite, renameHousehold } from './routes/household'

// In routes array, after revokeInvite:
['PATCH', new URLPattern({ pathname: '/household' }), renameHousehold],
```

---

## Change 3 — Frontend: `src/api/household.ts` (new file)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export interface HouseholdMember {
  clerkUserId: string
  role: 'owner' | 'member'
}

export interface HouseholdDetails {
  householdId: string
  householdName: string
  role: 'owner' | 'member'
  inviteCode: string | null
  members: HouseholdMember[]
}

export const householdKeys = {
  details: ['household', 'details'] as const,
}

export function useHouseholdDetails() {
  return useQuery({
    queryKey: householdKeys.details,
    queryFn: () => api.get<HouseholdDetails>('/household/me'),
    staleTime: 0,
  })
}

export function useRenameHousehold(onSuccess?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api.patch<{ ok: boolean; name: string }>('/household', { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: householdKeys.details })
      onSuccess?.()
    },
  })
}

export function useGenerateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ inviteCode: string }>('/household/invite', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKeys.details }),
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/household/invite'),
    onSuccess: () => qc.invalidateQueries({ queryKey: householdKeys.details }),
  })
}
```

---

## Change 4 — Frontend: `src/components/HouseholdSettings.tsx` (new file)

### Imports
```typescript
import { useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import IconButton from '@mui/material/IconButton'
import InputAdornment from '@mui/material/InputAdornment'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import { useHouseholdDetails, useRenameHousehold, useGenerateInvite, useRevokeInvite } from '../api/household'
import { useHousehold } from '../context/AuthContext'
```

### State
```typescript
const [isEditing, setIsEditing] = useState(false)
const [nameInput, setNameInput] = useState('')
const [copied, setCopied] = useState(false)
```

### Sections

**A — Household Name**
- Show `householdName` from context as `Typography variant="body2"`
- Owner sees "Rename" button → toggles inline `TextField` + "Save" / "Cancel"
- On save: call `renameHousehold(nameInput)`, on success call `refreshHousehold()` from `useHousehold()` and exit edit mode
- Skeleton while `isLoading`

**B — Invite Code** (after `<Divider sx={{ my: 2 }} />`)
- If `inviteCode` not null: read-only `TextField` with `ContentCopyIcon` `IconButton` in `InputAdornment`; copy uses `navigator.clipboard.writeText()`, sets `copied` for 2s
- If null: `Typography variant="body2" color="text.secondary"` — "No active invite code"
- Owner buttons: `Button variant="outlined" size="small"` — "Generate code" / "Generate new code"; `Button variant="outlined" color="error" size="small"` — "Revoke" (only when code exists)
- Loading: `CircularProgress size={18}` as `startIcon` on buttons while mutations are pending
- Copy success: `Alert severity="success"` below the field, auto-dismissed via `setTimeout(2000)`

**C — Members** (after `<Divider sx={{ my: 2 }} />`)
- `List disablePadding` with `ListItem` per member
- `ListItemText primary={m.clerkUserId}` (noWrap) + `Chip label={m.role} size="small"` as secondary action
- 3× `Skeleton` rows while loading

---

## Change 5 — Frontend: integrate into `Settings.tsx`

At the bottom of `Settings.tsx`, add:

```tsx
import HouseholdSettings from './HouseholdSettings'

// At the end of the return, after the last existing block:
<Divider sx={{ my: 2 }} />
<HouseholdSettings />
```

---

## MUI Style Reference (matching `Settings.tsx`)

| Element | Component |
|---|---|
| Section headers | `Typography variant="subtitle2" fontWeight={600} color="text.secondary"` |
| Section separators | `Divider sx={{ my: 2 }}` |
| Action buttons | `Button variant="outlined" size="small"` |
| Destructive action | `Button variant="outlined" color="error" size="small"` |
| Loading in buttons | `CircularProgress size={18}` as `startIcon` |
| Loading placeholders | `Skeleton` (match Settings.tsx calendar skeleton rows) |

---

## Data Flow

```
Settings.tsx
  └── HouseholdSettings.tsx
        ├── useHouseholdDetails()   → GET /household/me  (full detail incl. inviteCode + members)
        ├── useRenameHousehold()    → PATCH /household
        │     └── onSuccess: refreshHousehold() + invalidate query
        ├── useGenerateInvite()     → POST /household/invite
        │     └── onSuccess: invalidate householdKeys.details
        └── useRevokeInvite()       → DELETE /household/invite
              └── onSuccess: invalidate householdKeys.details
```

Note: `HouseholdSettings` fetches `GET /household/me` independently (needs `inviteCode` + `members`). The auth context only holds `householdId`, `householdName`, `role` — it is not extended.
