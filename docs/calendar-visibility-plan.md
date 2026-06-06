# Calendar Visibility & Household Sharing — Implementation Plan

## What & Why

Today every household member sees only their own OAuth-connected calendars merged with the shared household calendar. There is no way to share a personal calendar with the rest of the household, and no way to control what other members can see.

This iteration adds per-calendar visibility control. When a user enables a calendar in Settings they can now choose one of three modes:

- **Private** — only the owner sees it (current default; existing records are treated as private)
- **Household** — all household members see the full event titles and times
- **Free/Busy** — all household members see "Busy" time blocks with no titles or details

Example: Bernardo marks "Personal" as Private and "Work" as Free/Busy. Cesare's Calendar view shows generic "Busy" blocks during Bernardo's work hours, but nothing from Personal.

The mechanism is pure app-layer: the worker fetches shared calendars using the **calendar owner's stored OAuth token** (via the existing `getValidAccessToken`). No Google ACL changes are required.

---

## Data Model Changes

### `worker/src/types.ts`

**Modify `UserCalendar`** — add `visibility` field:

```typescript
// Before:
export interface UserCalendar {
  id: string
  name: string
  colorHex: string
  enabled: boolean
}

// After:
export interface UserCalendar {
  id: string
  name: string
  colorHex: string
  enabled: boolean
  visibility: 'private' | 'household' | 'free-busy'  // NEW — default 'private'
}
```

**Add `SharedCalendar` type** (new, below `UserCalendar`):

```typescript
export interface SharedCalendar {
  calendarId: string
  ownerEmail: string
  name: string
  colorHex: string
  visibility: 'household' | 'free-busy'  // 'private' entries never appear here
}
```

**Modify `CalendarEvent`** — extend `source` union:

```typescript
// Before:
source?: 'household' | 'user'

// After:
source?: 'household' | 'user' | 'household-shared' | 'free-busy'
```

### `frontend/src/api/types.ts`

Apply the same two changes — mirror `UserCalendar.visibility` and extend `CalendarEvent.source`:

```typescript
// UserCalendar — add:
visibility: 'private' | 'household' | 'free-busy'

// CalendarEvent.source — change to:
source?: 'household' | 'user' | 'household-shared' | 'free-busy'
```

No new frontend-only types needed; `SharedCalendar` is a worker-internal type only.

---

## KV Schema

The existing keys are unchanged. One new key is added:

| Key | Value type | Written by | Read by | TTL |
|-----|-----------|------------|---------|-----|
| `google_tokens:{email}` | `GoogleTokens` | `google-auth.ts` | `calendar.ts`, `user-calendars.ts` | permanent |
| `user_calendars:{email}` | `UserCalendar[]` | `user-calendars.ts` | `calendar.ts`, `user-calendars.ts` | permanent |
| `oauth_state:{uuid}` | `{ email }` | `google-auth.ts` | `google-auth.ts` | 10 min |
| `household_shared_calendars` | `SharedCalendar[]` | `user-calendars.ts` | `calendar.ts` | permanent |

### `household_shared_calendars` detail

A single flat JSON array. It is rebuilt in full every time any user calls `PUT /user-calendars`. Entries are the subset of all users' enabled calendars where `visibility !== 'private'`. The worker reading this key for a given request then skips entries where `ownerEmail` equals the requesting user (they already see their own calendars via `fetchUserOAuthEvents`).

Example value:
```json
[
  {
    "calendarId": "work_cal_id@group.calendar.google.com",
    "ownerEmail": "bernardo.prd@gmail.com",
    "name": "Work",
    "colorHex": "#0b8043",
    "visibility": "free-busy"
  }
]
```

---

## Backend Changes

### `worker/src/routes/user-calendars.ts`

#### `listUserCalendars` — minor change

When merging stored prefs with the live Google calendar list, preserve the `visibility` field from stored records. New calendars that have no stored record default to `visibility: 'private'`.

Change the merge map (line 33–41 currently):

```typescript
const calendars: UserCalendar[] = (googleData.items ?? []).map(item => {
  const match = stored.find(c => c.id === item.id)
  return {
    id: item.id,
    name: item.summary,
    colorHex: item.backgroundColor ?? '#4285F4',
    enabled: match ? match.enabled : false,
    visibility: match?.visibility ?? 'private',   // NEW
  }
})
```

#### `updateUserCalendars` — rebuild shared index

After saving `user_calendars:{email}`, atomically rebuild `household_shared_calendars`:

```typescript
export async function updateUserCalendars(req: Request, env: Env): Promise<Response> {
  const email = await getEmailFromRequest(req, env)
  if (!email) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const calendars = await req.json() as UserCalendar[]
  await env.AUTH_KV.put(`user_calendars:${email}`, JSON.stringify(calendars))

  // Rebuild the household shared index
  await rebuildSharedIndex(email, calendars, env)

  return Response.json({ ok: true })
}
```

Add the new helper `rebuildSharedIndex` (same file):

```typescript
async function rebuildSharedIndex(
  updatedEmail: string,
  updatedCalendars: UserCalendar[],
  env: Env,
): Promise<void> {
  // Load the current index and drop all entries owned by updatedEmail
  const existing = await env.AUTH_KV.get('household_shared_calendars')
  const current: SharedCalendar[] = existing ? JSON.parse(existing) : []
  const others = current.filter(e => e.ownerEmail !== updatedEmail)

  // Build new entries for the updated user's non-private enabled calendars
  const newEntries: SharedCalendar[] = updatedCalendars
    .filter(cal => cal.enabled && cal.visibility !== 'private')
    .map(cal => ({
      calendarId: cal.id,
      ownerEmail: updatedEmail,
      name: cal.name,
      colorHex: cal.colorHex,
      visibility: cal.visibility as 'household' | 'free-busy',
    }))

  await env.AUTH_KV.put(
    'household_shared_calendars',
    JSON.stringify([...others, ...newEntries]),
  )
}
```

Import `SharedCalendar` from `'../types'`.

Also add cleanup in `disconnectGoogle` (`worker/src/routes/google-auth.ts`, line 121): after deleting `google_tokens:{email}` and `user_calendars:{email}`, also call `rebuildSharedIndex(email, [], env)` to remove the disconnecting user's shared entries. Extract `rebuildSharedIndex` to a shared utility or re-implement inline.

> **Note on `disconnectGoogle` coupling:** The simplest approach is to move `rebuildSharedIndex` to a new `worker/src/routes/shared-calendar-index.ts` file and import it from both `user-calendars.ts` and `google-auth.ts`. This avoids a circular dependency.

---

### `worker/src/routes/calendar.ts`

#### New function: `fetchSharedCalendarEvents`

Add after `fetchUserOAuthEvents`:

```typescript
async function fetchSharedCalendarEvents(
  requestingEmail: string,
  env: Env,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const raw = await env.AUTH_KV.get('household_shared_calendars')
  if (!raw) return []

  const index = (JSON.parse(raw) as SharedCalendar[])
    .filter(entry => entry.ownerEmail !== requestingEmail)

  if (index.length === 0) return []

  const results = await Promise.allSettled(
    index.map(async entry => {
      const accessToken = await getValidAccessToken(entry.ownerEmail, env)
      if (!accessToken) return [] as CalendarEvent[]

      if (entry.visibility === 'household') {
        return fetchFullSharedCalendar(entry, accessToken, timeMin, timeMax)
      } else {
        return fetchFreeBusyCalendar(entry, accessToken, timeMin, timeMax)
      }
    }),
  )

  const events: CalendarEvent[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') events.push(...result.value)
  }
  return events
}
```

#### New helper: `fetchFullSharedCalendar`

Fetches full events for `visibility: 'household'` calendars using the owner's token:

```typescript
async function fetchFullSharedCalendar(
  entry: SharedCalendar,
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(entry.calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )
  if (!res.ok) return []
  const body = await res.json() as GCalListResponse
  return (body.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      id: `shared:${entry.calendarId}:${e.id}`,
      title: e.summary ?? '(No title)',
      start: e.start.dateTime ?? e.start.date ?? '',
      end:   e.end.dateTime   ?? e.end.date   ?? '',
      allDay: Boolean(e.start.date && !e.start.dateTime),
      color: e.colorId ? (GCAL_COLORS[e.colorId] ?? entry.colorHex) : entry.colorHex,
      source: 'household-shared' as const,
    }))
}
```

#### New helper: `fetchFreeBusyCalendar`

Uses the Google Calendar FreeBusy API for `visibility: 'free-busy'` calendars:

```typescript
// Google FreeBusy API response shape (add near other interface definitions):
interface FreeBusyResponse {
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>
}

async function fetchFreeBusyCalendar(
  entry: SharedCalendar,
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: entry.calendarId }],
    }),
  })
  if (!res.ok) return []
  const body = await res.json() as FreeBusyResponse
  const busySlots = body.calendars?.[entry.calendarId]?.busy ?? []
  return busySlots.map((slot, i) => ({
    id: `freebusy:${entry.calendarId}:${i}:${slot.start}`,
    title: 'Busy',
    start: slot.start,
    end:   slot.end,
    allDay: false,
    color: entry.colorHex,
    source: 'free-busy' as const,
  }))
}
```

#### Modify `getCalendarEvents`

Add `fetchSharedCalendarEvents` to the parallel fetch. Change the existing `Promise.all` call:

```typescript
// Before:
const [householdEvents, userEvents] = await Promise.all([
  fetchServiceAccountEvents(env, timeMin, timeMax),
  email ? fetchUserOAuthEvents(email, env, timeMin, timeMax) : Promise.resolve([] as CalendarEvent[]),
])
const events = [...householdEvents, ...userEvents]

// After:
const [householdEvents, userEvents, sharedEvents] = await Promise.all([
  fetchServiceAccountEvents(env, timeMin, timeMax),
  email ? fetchUserOAuthEvents(email, env, timeMin, timeMax) : Promise.resolve([] as CalendarEvent[]),
  email ? fetchSharedCalendarEvents(email, env, timeMin, timeMax) : Promise.resolve([] as CalendarEvent[]),
])
const events = [...householdEvents, ...userEvents, ...sharedEvents]
```

Add the `SharedCalendar` import to the top of the file:
```typescript
import type { Env, CalendarEvent, UserCalendar, SharedCalendar } from '../types'
```

---

### New file: `worker/src/routes/shared-calendar-index.ts`

To avoid coupling `google-auth.ts` and `user-calendars.ts` to each other, extract the index rebuild into a shared utility:

```typescript
import type { Env, UserCalendar, SharedCalendar } from '../types'

export async function rebuildSharedIndex(
  updatedEmail: string,
  updatedCalendars: UserCalendar[],
  env: Env,
): Promise<void> {
  const existing = await env.AUTH_KV.get('household_shared_calendars')
  const current: SharedCalendar[] = existing ? JSON.parse(existing) : []
  const others = current.filter(e => e.ownerEmail !== updatedEmail)

  const newEntries: SharedCalendar[] = updatedCalendars
    .filter(cal => cal.enabled && cal.visibility !== 'private')
    .map(cal => ({
      calendarId: cal.id,
      ownerEmail: updatedEmail,
      name: cal.name,
      colorHex: cal.colorHex,
      visibility: cal.visibility as 'household' | 'free-busy',
    }))

  await env.AUTH_KV.put(
    'household_shared_calendars',
    JSON.stringify([...others, ...newEntries]),
  )
}
```

Import this in both `user-calendars.ts` (after `PUT /user-calendars` saves) and `google-auth.ts` (inside `disconnectGoogle`, call `rebuildSharedIndex(email, [], env)`).

---

### `worker/src/index.ts`

No new routes required. `getCalendarEvents` and `updateUserCalendars` are extended in place. No changes to the route table or CORS config.

---

## Frontend Changes

### `frontend/src/api/types.ts`

Two changes as described in the data model section above — add `visibility` to `UserCalendar`, extend `source` on `CalendarEvent`. Both are additive and backwards-compatible.

### `frontend/src/api/google-calendar.ts`

`useUpdateUserCalendars` already accepts and sends the full `UserCalendar[]` body. Since `UserCalendar` now includes `visibility`, the mutation sends it automatically — no changes needed here.

### `frontend/src/components/Settings.tsx`

Replace the per-row `Switch` with a two-control row: the switch controls `enabled`, and a `Select` (visible only when `enabled: true`) controls `visibility`.

**Imports to add:**
```typescript
import Select from '@mui/material/Select'
import MenuItem from '@mui/material/MenuItem'
import FormControl from '@mui/material/FormControl'
```

**Replace `handleToggle`** with two handlers:

```typescript
function handleToggle(cal: UserCalendar) {
  if (!calendars) return
  const updated = calendars.map(c =>
    c.id === cal.id ? { ...c, enabled: !c.enabled } : c
  )
  updateCalendars(updated)
}

function handleVisibility(cal: UserCalendar, visibility: UserCalendar['visibility']) {
  if (!calendars) return
  const updated = calendars.map(c =>
    c.id === cal.id ? { ...c, visibility } : c
  )
  updateCalendars(updated)
}
```

**Replace the calendar row JSX** (currently lines 112–135 in `Settings.tsx`):

```tsx
{(calendars ?? []).map(cal => (
  <Box key={cal.id} sx={{ mb: 1.5 }}>
    {/* Row 1: swatch + name + enable switch */}
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <Box
        sx={{
          width: 16,
          height: 16,
          borderRadius: 0.5,
          bgcolor: cal.colorHex,
          flexShrink: 0,
        }}
      />
      <Typography variant="body2" sx={{ flex: 1 }}>
        {cal.name}
      </Typography>
      <Switch
        checked={cal.enabled}
        size="small"
        onChange={() => handleToggle(cal)}
      />
    </Box>

    {/* Row 2: visibility select — only when enabled */}
    {cal.enabled && (
      <Box sx={{ pl: 3.5, mt: 0.5 }}>
        <FormControl size="small" fullWidth>
          <Select
            value={cal.visibility ?? 'private'}
            onChange={e => handleVisibility(cal, e.target.value as UserCalendar['visibility'])}
            sx={{ fontSize: 13 }}
          >
            <MenuItem value="private">Private — only me</MenuItem>
            <MenuItem value="household">Household — full events</MenuItem>
            <MenuItem value="free-busy">Household — free/busy only</MenuItem>
          </Select>
        </FormControl>
      </Box>
    )}
  </Box>
))}
```

This renders a clean two-row control: the top row is unchanged from the current design; the select appears indented below only when the calendar is enabled.

### `frontend/src/components/Calendar.tsx`

No structural changes required. "Busy" events render correctly through the existing `EventCard` component — `event.title` will be `'Busy'` and the color strip uses `event.color` (the owner's calendar `colorHex`).

Optional visual polish (not required for correctness): add a subtle `opacity: 0.65` or dashed left-border to `EventCard` when `event.source === 'free-busy'` to visually distinguish placeholders from real events. Implement by passing a prop or using a `sx` conditional inside `EventCard`:

```tsx
// In EventCard, add to the outer Box sx:
...(event.source === 'free-busy' && { opacity: 0.7, borderLeft: '2px dashed' }),
```

---

## Agent-Optimized Implementation Order

Each wave's agents run in parallel. Start Wave 2 only after Wave 1 is committed.

### Wave 1 — Types (1 agent, ~2 min)

Single agent, both files in one pass:

- `worker/src/types.ts` — add `visibility` to `UserCalendar`, add `SharedCalendar` interface, extend `CalendarEvent.source`
- `frontend/src/api/types.ts` — mirror the same two changes

Everything else in Wave 2 imports from or extends these types.

---

### Wave 2 — Parallel build (3 agents simultaneously, ~10 min)

**Agent A — `worker/src/routes/shared-calendar-index.ts`** (new file)
- Implement and export `rebuildSharedIndex`
- Import `SharedCalendar`, `UserCalendar`, `Env` from `../types`
- No other dependencies

**Agent B — `worker/src/routes/user-calendars.ts`** + `worker/src/routes/google-auth.ts`
- In `user-calendars.ts`:
  - Update `listUserCalendars` to preserve `visibility` (default `'private'`) in the merge map
  - Update `updateUserCalendars` to call `rebuildSharedIndex` after the KV put
  - Import `rebuildSharedIndex` from `./shared-calendar-index`
- In `google-auth.ts`:
  - Update `disconnectGoogle` to call `rebuildSharedIndex(email, [], env)` after the two deletes
  - Import `rebuildSharedIndex` from `./shared-calendar-index`

**Agent C — `frontend/src/components/Settings.tsx`**
- Add `Select`, `MenuItem`, `FormControl` imports from MUI
- Add `handleVisibility` handler
- Replace the calendar row JSX with the two-row layout described above
- No backend needed — just TypeScript against the updated `UserCalendar` type from Wave 1

---

### Wave 3 — Calendar worker (1 agent, after Wave 2)

**Agent D — `worker/src/routes/calendar.ts`**
- Depends on `SharedCalendar` type (Wave 1) and `shared-calendar-index.ts` existing (for type reference only — no import needed here)
- Add `FreeBusyResponse` interface near other local interfaces
- Add `fetchFullSharedCalendar`, `fetchFreeBusyCalendar`, `fetchSharedCalendarEvents` functions
- Update `getCalendarEvents` to add `fetchSharedCalendarEvents` to the `Promise.all` call
- Update the `import type` line to include `SharedCalendar`

---

### Wave 4 — Verify & Deploy (sequential)

1. `cd worker && npx tsc --noEmit` — both files must pass
2. `cd frontend && npx tsc --noEmit`
3. `wrangler dev` + manual local verification (see Verification section)
4. `wrangler deploy` + `pnpm build && wrangler pages deploy dist` (or the existing Pages deploy pipeline)

---

## Verification

### KV inspection

After setting a calendar to "Household" in Settings and saving:

```bash
# Confirm user pref was saved with visibility field:
wrangler kv key get --binding=AUTH_KV "user_calendars:bernardo.prd@gmail.com"
# → [..., { "id": "...", "enabled": true, "visibility": "household", ... }]

# Confirm shared index was rebuilt:
wrangler kv key get --binding=AUTH_KV "household_shared_calendars"
# → [{ "calendarId": "...", "ownerEmail": "bernardo.prd@gmail.com", "visibility": "household", ... }]
```

After setting back to "Private":

```bash
wrangler kv key get --binding=AUTH_KV "household_shared_calendars"
# → []  (or entries for other users only)
```

### Manual end-to-end flow

1. Log in as User A (Bernardo). Go to Settings. Enable a calendar, set it to **Household**. Save.
2. Log in as User B (Cesare) in a different browser/incognito window. Open Calendar view.
3. Verify: User B sees User A's calendar events with full titles. Events have `source: 'household-shared'`.
4. User A changes the same calendar to **Free/Busy**. Save.
5. User B refreshes Calendar. Verify: events from User A now appear as "Busy" blocks with no titles.
6. User A changes calendar to **Private**. Save.
7. User B refreshes Calendar. Verify: no events from User A appear.
8. User A clicks Disconnect Google. Verify: `household_shared_calendars` KV key no longer contains any entry for User A's email.

### Regression checks

- User A's own events still appear normally (source: `'user'`) when their calendar is enabled regardless of visibility setting
- Household service-account calendar still appears (source: `'household'`) for all users
- If a token is revoked mid-flight, `getValidAccessToken` returns `null` and `fetchSharedCalendarEvents` silently returns `[]` for that entry — no 500 errors
- A newly-connected user with no shared calendars set sees an empty `household_shared_calendars` result without errors
