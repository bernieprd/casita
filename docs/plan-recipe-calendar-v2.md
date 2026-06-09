# Plan Recipe → Google Calendar (v2)

## Context

v1 of the "Plan Recipe" feature (Waves 0 + 0.5) ships the Plan button end-to-end using the todo path: the user picks a date, a todo is created with a due date, and the recipe polish wave adds responsive UI and a calendar picker. This document defines v2, which upgrades the Plan action to write directly to the user's Google Calendar when connected.

**Prerequisite:** Waves 0 and 0.5 of `recipe-improvements.md` are complete (or in flight). v2 extends the existing `PlanRecipeSheet` component — it does not replace it.

---

## Scope

**What this adds:**
- Backend: track write capability (`canWrite`) in the stored Google token
- Backend: incremental OAuth upgrade endpoint (`GET /auth/google/upgrade`) to request `calendar.events` scope lazily
- Backend: `POST /calendar/events` endpoint to create Google Calendar events
- Frontend: `useCreateCalendarEvent` and updated `useGoogleStatus` hooks
- Frontend: three-state `PlanRecipeSheet` (not connected → todo path; read-only → upgrade prompt; write-capable → calendar path)

**What this does not touch:**
- The todo fallback path (remains for users who never connect Google)
- The Google connect flow for `calendar.readonly` (unchanged)
- Any recipe CRUD, the recipe list, or the recipe detail view

---

## 1. Backend — Track `canWrite` in token storage

**File:** `worker/src/routes/google-auth.ts`

When storing tokens (both the initial exchange and on refresh), derive and persist a `canWrite` flag:

```ts
canWrite: (tokens.scope ?? '').includes('calendar.events') ||
          (tokens.scope ?? '').includes('calendar '),
```

**File:** `worker/src/types.ts`

Add `canWrite: boolean` to the `GoogleTokens` type.

---

## 2. Backend — GET /auth/google/upgrade

**File:** `worker/src/routes/google-auth.ts` (new handler)
**File:** `worker/src/index.ts` (register at `GET /auth/google/upgrade`)

Initiates an incremental OAuth consent flow that adds `calendar.events` on top of already-granted scopes. The existing callback handler (`handleGoogleOAuthCallback`) processes the response — no new callback route needed.

```ts
googleUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/calendar.events')
googleUrl.searchParams.set('include_granted_scopes', 'true')
googleUrl.searchParams.set('access_type', 'offline')
googleUrl.searchParams.set('prompt', 'consent')
```

After the user consents, the callback stores the upgraded token with `canWrite: true`.

---

## 3. Backend — POST /calendar/events

**File:** `worker/src/routes/calendar.ts` (new file)
**File:** `worker/src/index.ts` (register at `POST /calendar/events`)

**Request body:**
```ts
{ title: string; date: string; time?: string }
// date: "YYYY-MM-DD"; time: "HH:MM" 24h, optional
```

**Logic:**
1. Load stored Google token. If absent → `422 { error: 'not_connected' }`.
2. If `token.canWrite === false` → `422 { error: 'insufficient_scope' }` (never attempt the write).
3. Resolve target calendar: look up `household_shared_calendars:{householdId}` in KV, pick the first calendar with `visibility: 'household'` owned by this user, or fall back to `primary`.
4. `POST /calendars/{calendarId}/events` to Google:
   - `summary`: recipe title
   - If `time` provided → `dateTime` (`YYYY-MM-DDTHH:MM:00`), 1-hour duration
   - If no `time` → all-day `date` format
5. Return `{ eventId, calendarId, htmlLink }`.

---

## 4. Frontend — API hooks

**File:** `frontend/src/api/google-calendar.ts` (new file)

```ts
export function useCreateCalendarEvent() {
  return useMutation({
    mutationFn: (body: { title: string; date: string; time?: string }) =>
      api.post<{ eventId: string; htmlLink: string }>('/calendar/events', body),
  })
}

export function useGoogleStatus() {
  return useQuery({
    queryKey: ['google-status'],
    queryFn: () => api.get<{ connected: boolean; canWrite: boolean }>('/auth/google/status'),
  })
}
```

Also update `GET /auth/google/status` in the backend to return `canWrite` from the stored token.

---

## 5. Frontend — PlanRecipeSheet (three-state upgrade)

**File:** `frontend/src/components/PlanRecipeSheet.tsx`

Extend the existing component (built in Wave 0.5) to check `useGoogleStatus()` and branch into three states:

### State 1 — Not connected
Same as today: date picker + "Add to Todos" button → calls `useCreateTodo({ name: 'Cook ${recipeName}', due: date })`.

### State 2 — Connected, read-only (`connected && !canWrite`)
Hide the date/time inputs. Show an inline notice:
> "To add to Google Calendar, we need permission to create events."

`[Grant Calendar Access]` button → calls `GET /auth/google/upgrade`, which redirects through the incremental OAuth flow. On return, `useGoogleStatus` refetches and the sheet transitions to State 3.

### State 3 — Connected with write access
Date picker (existing Calendar + Popover from Wave 0.5). Optional time toggle: when enabled, a `HH:MM` time input appears. Submit reads "Add to Calendar" → calls `useCreateCalendarEvent({ title: 'Cook ${recipeName}', date, time })`, shows toast "Added to calendar", closes sheet.

```tsx
const { data: status } = useGoogleStatus()
const connected = status?.connected ?? false
const canWrite = status?.canWrite ?? false

// State routing:
if (!connected)          → todo path (State 1)
if (connected && !canWrite) → upgrade prompt (State 2)
if (connected && canWrite)  → calendar path (State 3)
```

---

## Critical files

| File | Change |
|------|--------|
| `worker/src/types.ts` | Add `canWrite: boolean` to `GoogleTokens` |
| `worker/src/routes/google-auth.ts` | Store `canWrite` on token save; add upgrade handler |
| `worker/src/routes/calendar.ts` | New — `POST /calendar/events` |
| `worker/src/index.ts` | Register `GET /auth/google/upgrade` and `POST /calendar/events` |
| `frontend/src/api/google-calendar.ts` | New — `useCreateCalendarEvent`, `useGoogleStatus` |
| `frontend/src/components/PlanRecipeSheet.tsx` | Add three-state logic |

---

## Verification

1. **Not connected:** tap Plan → see date picker → submit → todo created with due date.
2. **Connected, read-only:** tap Plan → see upgrade prompt → grant → sheet shows calendar path.
3. **Connected with write access:** tap Plan → date picker (+ optional time) → submit → event appears in Google Calendar.
4. **All-day vs timed:** toggle time on/off and verify correct event type in Google Calendar.
5. **Upgrade flow returns correctly:** after incremental OAuth, the redirect lands back in the app and the sheet is in State 3 (no extra navigation required).
