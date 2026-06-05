# Calendar Sync — Implementation Plan

## What & Why

The app currently shows events from a single hardcoded Google Calendar via a service account. This plan adds per-user Google OAuth so each household member can connect their personal Google account, choose which of their calendars appear in the app, and toggle or remove them. The main Calendar view merges household + personal events.

---

## Architecture Decisions

- **Keep the existing service account calendar** as the permanent "household" calendar — always shown, no UI needed
- **Add Google OAuth 2.0 per-user** on top — each user connects independently via their own Google account
- **All storage in the existing `AUTH_KV`** namespace — no new DB (avoids premature D1 migration)
- **OAuth flow is a full-page redirect** (not a popup) — PWAs on mobile don't reliably support popups
- **Settings accessible via a gear icon in the AppBar** — avoids adding a 6th bottom-nav tab (MUI recommends 3–5)

---

## Prerequisites — Google Cloud Console (manual, do first)

1. Open the existing Google Cloud project and create an **OAuth 2.0 Web Application** credential
2. Add authorized redirect URIs:
   - `https://casita-worker.<account>.workers.dev/auth/google/callback`
   - `http://localhost:8787/auth/google/callback`
3. Add both user emails as **test users** on the OAuth consent screen (app stays in "Testing" mode)
4. Required scopes: `openid`, `email`, `https://www.googleapis.com/auth/calendar.readonly`
5. Run:
   ```bash
   wrangler secret put GOOGLE_CLIENT_ID
   wrangler secret put GOOGLE_CLIENT_SECRET
   ```
6. Add to `wrangler.toml` vars and `.dev.vars`:
   ```
   GOOGLE_REDIRECT_URI = "https://casita-worker.<account>.workers.dev/auth/google/callback"
   ```

> Nothing deploys until this step is done.

---

## KV Key Schema

| Key | Value | TTL |
|-----|-------|-----|
| `google_tokens:{email}` | `{ accessToken, refreshToken, expiresAt }` | permanent |
| `user_calendars:{email}` | `UserCalendar[]` | permanent |
| `oauth_state:{uuid}` | `{ email }` | 10 minutes (CSRF protection) |

---

## New Types — `worker/src/types.ts`

Add to `Env`:
```typescript
GOOGLE_CLIENT_ID?: string
GOOGLE_CLIENT_SECRET?: string
GOOGLE_REDIRECT_URI?: string
```

New domain types (add to `types.ts`):
```typescript
export interface GoogleTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number   // ms since epoch
}

export interface UserCalendar {
  id: string          // Google calendar ID
  name: string
  colorHex: string
  enabled: boolean
}
```

Update `CalendarEvent` (add optional field — backward-compatible):
```typescript
source?: 'household' | 'user'
```

Also mirror `UserCalendar` and `source?` in `frontend/src/api/types.ts`.

---

## Backend Changes

### New — `worker/src/routes/google-auth.ts`

All routes live under `/auth/` so they bypass the global Bearer check (consistent with existing `/auth/logout` pattern — handlers do their own auth internally).

**`GET /auth/google?session=<token>`** — `initiateGoogleOAuth`
- Validates the Casita session token from the query param (not Authorization header, because this is a browser redirect)
- Generates a UUID state, stores `{ email }` at `oauth_state:{state}` with 10-min TTL
- Redirects to Google consent with `prompt=consent&access_type=offline` (always issues a refresh token)

**`GET /auth/google/callback?code=&state=`** — `handleGoogleOAuthCallback`
- Validates state from KV (one-time use, deletes immediately)
- POSTs to `https://oauth2.googleapis.com/token` to exchange code for tokens
- Stores result at `google_tokens:{email}`
- Redirects to `https://casita.bernardoprd.com/#/settings?google=connected`

**`GET /auth/google/status`** — `getGoogleAuthStatus`
- Reads Bearer token from Authorization header → looks up email from KV session
- Returns `{ connected: boolean }`

**`DELETE /auth/google`** — `disconnectGoogle`
- Reads Bearer token → email
- Deletes `google_tokens:{email}` and `user_calendars:{email}`

**Shared export used by `calendar.ts`:**
```typescript
export async function getValidAccessToken(email: string, env: Env): Promise<string | null>
```
- Loads `google_tokens:{email}`, returns `accessToken` if not expiring within 60s
- Else refreshes via `oauth2.googleapis.com/token`; updates KV with new token
- On `invalid_grant` (revoked): deletes both KV keys, returns `null`

---

### New — `worker/src/routes/user-calendars.ts`

Both routes read the session email from the Bearer token (same pattern as `logoutAuth`).

**`GET /user-calendars`** — `listUserCalendars`
- Calls `getValidAccessToken`; if null returns `{ calendars: [], connected: false }`
- Fetches `https://www.googleapis.com/calendar/v3/users/me/calendarList`
- Merges with stored `user_calendars:{email}` (preserving `enabled` flags; new calendars default to `false`)
- Returns `{ calendars: UserCalendar[], connected: true }`

**`PUT /user-calendars`** — `updateUserCalendars`
- Parses body as `UserCalendar[]`
- Stores at `user_calendars:{email}`
- Returns `{ ok: true }`

---

### Modified — `worker/src/routes/calendar.ts`

Refactor into private functions + new merge layer:

```typescript
// Extract existing logic (no changes to the service account JWT flow):
async function fetchServiceAccountEvents(env, timeMin, timeMax): Promise<CalendarEvent[]>

// New: fetches from all user-enabled OAuth calendars
async function fetchUserOAuthEvents(email, env, timeMin, timeMax): Promise<CalendarEvent[]>
// - calls getValidAccessToken; returns [] if null
// - loads user_calendars:{email}, filters to enabled: true
// - fetches each calendar via Promise.allSettled (resilient per-calendar failures)
// - prefixes IDs with "user:" to avoid collisions with household event IDs
// - uses calendar's colorHex as fallback; event-level colorId overrides if present
// - on 401 from Google: deletes google_tokens:{email}, returns []

// Updated main handler:
export async function getCalendarEvents(req, env): Promise<Response>
// - reads email from Authorization header
// - runs fetchServiceAccountEvents + fetchUserOAuthEvents in parallel
// - deduplicates by id, sorts by start, returns merged array
```

---

### Modified — `worker/src/index.ts`

Add `PUT` to the CORS `Access-Control-Allow-Methods` header.

Add 6 new routes:
```typescript
['GET',    new URLPattern({ pathname: '/auth/google' }),           initiateGoogleOAuth],
['GET',    new URLPattern({ pathname: '/auth/google/callback' }),  handleGoogleOAuthCallback],
['GET',    new URLPattern({ pathname: '/auth/google/status' }),    getGoogleAuthStatus],
['DELETE', new URLPattern({ pathname: '/auth/google' }),           disconnectGoogle],
['GET',    new URLPattern({ pathname: '/user-calendars' }),        listUserCalendars],
['PUT',    new URLPattern({ pathname: '/user-calendars' }),        updateUserCalendars],
```

---

## Frontend Changes

### New — `frontend/src/api/google-calendar.ts`

```typescript
export interface UserCalendar { id: string; name: string; colorHex: string; enabled: boolean }
export interface GoogleCalendarStatus { connected: boolean; calendars: UserCalendar[] }

export const googleCalendarKeys = {
  status:    ['google-calendar', 'status'] as const,
  calendars: ['google-calendar', 'calendars'] as const,
}

export function useGoogleCalendars(): UseQueryResult<GoogleCalendarStatus>
// staleTime: 0 — always refetch on Settings mount (detects post-OAuth state)

export function useUpdateUserCalendars(): UseMutationResult<void, Error, UserCalendar[]>
// optimistic update on googleCalendarKeys.calendars; rollback on error

export function useDisconnectGoogle(): UseMutationResult<void, Error, void>
// on success: invalidate status, set calendars to []

export function buildGoogleConnectUrl(): string
// returns `${VITE_WORKER_URL}/auth/google?session=${localStorage.casita_token}`
```

Export all from `frontend/src/api/index.ts`.

---

### New — `frontend/src/components/Settings.tsx`

**Google Account section:**
- Not connected → "Connect Google Calendar" button → `window.location.href = buildGoogleConnectUrl()` (full-page redirect to Worker OAuth initiation)
- Connected → show connected Google email + "Disconnect" button (calls `useDisconnectGoogle`)

**My Calendars section** (only when connected):
- List from `useGoogleCalendars()`
- Each row: colored square swatch + calendar name + MUI `Switch` for `enabled`
- Toggle auto-saves immediately via `useUpdateUserCalendars` (no explicit Save button)

**OAuth return handling:**
```typescript
const [searchParams, setSearchParams] = useSearchParams()
const oauthResult = searchParams.get('google') // "connected" | "error" | null
// Show Alert on mount if param present, then: setSearchParams({}, { replace: true })
```

**Loading state:** `Skeleton` rows (consistent with `Calendar.tsx`)  
**Error state:** `Alert` — "Failed to load calendars. Try reconnecting."

---

### Modified — `frontend/src/App.tsx`

Add a gear icon to the AppBar (right side, visible on all tabs):
```tsx
import SettingsIcon from '@mui/icons-material/Settings'

// In the AppBar Toolbar (right of title):
<IconButton onClick={() => navigate('/settings')} size="small" color="inherit">
  <SettingsIcon />
</IconButton>
```

Add the settings route inside `AppShell`'s `<Routes>` (before the `*` catch-all):
```tsx
<Route path="/settings" element={
  <TabErrorBoundary key="settings"><Settings /></TabErrorBoundary>
} />
```

No changes to `TabId` or bottom navigation.

---

## Agent-Optimized Implementation Order

The work is split into waves. Agents within the same wave run **in parallel**.

### Wave 1 — Foundation (1 agent, ~2 min)
Single agent updates both type files before anything else:
- `worker/src/types.ts` — add `Env` fields + `GoogleTokens` + `UserCalendar`
- `frontend/src/api/types.ts` — add `source?` to `CalendarEvent`, add `UserCalendar`

Everything else imports from these files.

---

### Wave 2 — Parallel build (4 agents simultaneously, ~10–15 min)

**Agent A — `google-auth.ts`**
Implement the full OAuth route file:
- `initiateGoogleOAuth`, `handleGoogleOAuthCallback`, `getGoogleAuthStatus`, `disconnectGoogle`
- Export `getValidAccessToken` helper

**Agent B — `user-calendars.ts`**
Implement the full calendar management route file:
- `listUserCalendars`, `updateUserCalendars`
- Import types from `../types`; import `getValidAccessToken` stub (will resolve when Agent A lands)

**Agent C — `frontend/src/api/google-calendar.ts`**
Implement all frontend API hooks and `buildGoogleConnectUrl`. No backend needed — just TypeScript against the agreed interface. Export from `api/index.ts`.

**Agent D — `frontend/src/App.tsx` + `frontend/src/components/Settings.tsx` scaffold**
- Add gear icon + `/settings` route to `App.tsx`
- Build `Settings.tsx` UI structure with loading/error/connected/disconnected states
- Uses types from Wave 1; hooks imported from Agent C's file (type-checks even before API is deployed)

---

### Wave 3 — Integration (2 agents simultaneously, after Wave 2)

**Agent E — `worker/src/routes/calendar.ts`**
- Depends on Agent A's `getValidAccessToken`
- Refactor existing handler into `fetchServiceAccountEvents`
- Implement `fetchUserOAuthEvents` and merge logic in `getCalendarEvents`

**Agent F — `worker/src/index.ts`**
- Depends on Agents A + B (route files must exist to import)
- Add 6 new routes + add `PUT` to CORS methods

---

### Wave 4 — Config + Deploy (sequential)

1. Update `wrangler.toml` (`GOOGLE_REDIRECT_URI` var)
2. Populate `.dev.vars` with dev credentials
3. `pnpm deploy` (or `wrangler deploy` + Pages deploy)
4. Manual verification (see below)

---

## Verification

```bash
# Worker routes exist and respond correctly:
curl https://casita-worker.<account>.workers.dev/auth/google/status \
  -H "Authorization: Bearer <token>"
# → { "connected": false }

# KV inspection during dev:
wrangler kv key get --binding=AUTH_KV "google_tokens:bernardo.prd@gmail.com"
wrangler kv key get --binding=AUTH_KV "user_calendars:bernardo.prd@gmail.com"
```

**Manual flow:**
1. Navigate to app → click gear icon → Settings page renders with "Connect Google Calendar"
2. Click Connect → browser navigates to Worker `/auth/google?session=...` → Google consent page
3. Complete consent → redirected to `/#/settings?google=connected` → success Alert shown
4. Calendar list appears; toggle one calendar ON
5. Open Calendar tab → personal events appear merged with household events
6. Toggle OFF → personal events disappear, household events remain
7. Click Disconnect → status returns `connected: false`, only household events show
