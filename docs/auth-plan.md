# Auth — Implementation Plan

## What & Why

Casita currently uses a naive auth system: email whitelist, SHA-256 unsalted passwords, UUID session tokens in Cloudflare KV. The two existing users share a single set of Notion databases with no per-user or per-household isolation.

This plan replaces that with proper OAuth (Google + Apple + email/password) via Clerk, introduces a "household" concept so multiple households can use the app independently, and allows new users to sign up, create a household, or join one with an invite code.

---

## Architecture Decisions

- **Clerk for identity** — handles Google, Apple, and email/password out of the box; issues JWTs the Worker validates. Replaceable later: Clerk's footprint is limited to the auth layer only.
- **D1 for households** — `households`, `household_members`, and `household_notion_config` tables. Clerk is the source of truth for users; D1 owns the household graph.
- **Same D1 database as editable-concepts plan** — extend it, don't create a new one.
- **Notion DB IDs move to D1** — each household row stores its own Notion DB IDs, replacing the hardcoded `env.NOTION_*_DB` vars. No Notion data migration needed.
- **KV sessions kept as fallback during migration** — existing sessions remain valid until both users confirm OAuth works, then removed.
- **Households use invite codes** — owner generates a short code; new users enter it after signing in to join.

---

## Prerequisites — Clerk + Google Cloud (manual, do first)

1. Create a Clerk application at [clerk.com](https://clerk.com)
   - Enable: Google, Apple, Email/Password
   - Allowed redirect URLs: `https://casita.bernardoprd.com`, `http://localhost:5173`
2. Get `CLERK_PUBLISHABLE_KEY` (goes in `wrangler.toml` vars + `.env.local`) and `CLERK_SECRET_KEY` (secret)
3. Apple: requires an Apple Developer account — configure in Clerk dashboard (Clerk handles the complexity)
4. Run:
   ```bash
   wrangler secret put CLERK_SECRET_KEY
   ```
5. Add to `.env.local`:
   ```
   VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
   ```

> Nothing deploys until this step is done.

---

## D1 Schema — `worker/src/db/schema.sql`

Add to the same D1 database planned for editable concepts.

```sql
CREATE TABLE IF NOT EXISTS households (
  id          TEXT PRIMARY KEY,    -- crypto.randomUUID()
  name        TEXT NOT NULL,
  invite_code TEXT UNIQUE,         -- nullable = invites disabled
  created_at  INTEGER NOT NULL     -- Unix ms
);

CREATE TABLE IF NOT EXISTS household_members (
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL,     -- Clerk's user ID (e.g. "user_2abc...")
  role          TEXT NOT NULL DEFAULT 'member',  -- 'owner' | 'member'
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (household_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS hm_clerk_user_id ON household_members(clerk_user_id);

-- Replaces hardcoded env.NOTION_*_DB vars; one row per household
CREATE TABLE IF NOT EXISTS household_notion_config (
  household_id         TEXT PRIMARY KEY REFERENCES households(id),
  shopping_list_db     TEXT NOT NULL,
  recipes_db           TEXT NOT NULL,
  recipe_ingredient_db TEXT NOT NULL,
  todos_db             TEXT NOT NULL
);

-- Seed (run after both users log in once and you have their Clerk user IDs):
-- INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);
-- INSERT INTO household_notion_config VALUES ('hh-home', '<shopping_db>', '<recipes_db>', '<ingredient_db>', '<todos_db>');
-- INSERT INTO household_members VALUES ('hh-home', '<bernardo_clerk_id>', 'owner', unixepoch() * 1000);
-- INSERT INTO household_members VALUES ('hh-home', '<cesar_clerk_id>', 'member', unixepoch() * 1000);
```

---

## New Types — `worker/src/types.ts`

Add to `Env`:
```typescript
DB: D1Database
CLERK_PUBLISHABLE_KEY: string
CLERK_SECRET_KEY: string
```

New shared type passed to all route handlers:
```typescript
export interface RequestContext {
  clerkUserId: string
  householdId: string | null   // null = user exists but has no household yet
  role: 'owner' | 'member' | null
}
```

`wrangler.toml` additions:
```toml
[[d1_databases]]
binding = "DB"
database_name = "casita"
database_id = "..."   # from: wrangler d1 create casita

[vars]
CLERK_PUBLISHABLE_KEY = "pk_live_..."
# Remove ALLOWED_EMAILS after migration is complete
```

---

## Backend Changes

### New — `worker/src/auth/clerk.ts`

Clerk JWT verification using `@clerk/backend` (Workers-compatible):

```typescript
import { createClerkClient } from '@clerk/backend'

export function getClerkClient(env: Env) {
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

export async function verifyClerkToken(
  token: string,
  env: Env
): Promise<{ userId: string } | null>
// Returns null on invalid/expired token
```

---

### New — `worker/src/routes/household.ts`

All routes require an authenticated `RequestContext`. Return 403 if `householdId` is required but null.

**`GET /household/me`**
- Returns `{ householdId, householdName, role, members: [{ clerkUserId, role }] }`
- Returns `{ householdId: null }` if user has no household (triggers frontend setup flow)

**`POST /household`** — create new household
- Body: `{ name: string }`
- Creates household row + member row (role: `owner`) + `household_notion_config` row with provided Notion DB IDs
- Returns the new household

**`POST /household/join`** — join by invite code
- Body: `{ inviteCode: string }`
- Looks up household by `invite_code`; adds member row (role: `member`)
- Returns the joined household

**`POST /household/invite`** — generate/rotate invite code (owner only)
- Generates `crypto.randomUUID().slice(0, 8).toUpperCase()` as invite code
- Updates household row; returns `{ inviteCode }`

**`DELETE /household/invite`** — revoke invite code (owner only)
- Sets `invite_code = NULL`

---

### Modified — `worker/src/index.ts`

Replace the KV session lookup (lines 88–95) with Clerk JWT verification + D1 household lookup.

During migration: check D1 Clerk session first, fall back to KV session for existing unexpired tokens.

```typescript
// New session resolution (replaces lines 88-95):
const token = req.headers.get('Authorization')?.replace('Bearer ', '')
if (!token) return err(401, 'Unauthorized', origin)

// Try Clerk JWT first
let clerkUserId: string | null = null
try {
  const clerk = getClerkClient(env)
  const { userId } = await clerk.verifyToken(token)
  clerkUserId = userId
} catch { /* fall through to KV */ }

// KV fallback for existing sessions (remove after migration)
if (!clerkUserId) {
  const kv = await env.AUTH_KV.get(`session:${token}`, 'json') as { email: string; expiresAt: number } | null
  if (!kv || kv.expiresAt < Date.now()) return err(401, 'Unauthorized', origin)
  // Treat KV session email as a synthetic ctx (householdId resolved below)
  clerkUserId = `kv:${kv.email}`   // temporary marker
}

// Resolve household from D1
const membership = await env.DB.prepare(
  'SELECT household_id, role FROM household_members WHERE clerk_user_id = ?'
).bind(clerkUserId).first<{ household_id: string; role: string }>()

const ctx: RequestContext = {
  clerkUserId,
  householdId: membership?.household_id ?? null,
  role: (membership?.role as 'owner' | 'member') ?? null,
}
// Pass ctx as additional arg to all route handlers
```

Add new routes:
```typescript
['GET',    new URLPattern({ pathname: '/household/me' }),      getHousehold],
['POST',   new URLPattern({ pathname: '/household' }),         createHousehold],
['POST',   new URLPattern({ pathname: '/household/join' }),    joinHousehold],
['POST',   new URLPattern({ pathname: '/household/invite' }),  generateInvite],
['DELETE', new URLPattern({ pathname: '/household/invite' }),  revokeInvite],
```

---

### Modified — `worker/src/routes/items.ts`, `todos.ts`, `recipes.ts`

All data routes receive `ctx: RequestContext`. Replace hardcoded `env.NOTION_*_DB` with a D1 lookup:

```typescript
// Add at the top of each handler:
if (!ctx.householdId) return err(403, 'No household', origin)

const config = await env.DB.prepare(
  'SELECT * FROM household_notion_config WHERE household_id = ?'
).bind(ctx.householdId).first<HouseholdNotionConfig>()

if (!config) return err(403, 'Household not configured', origin)

// Then replace:
env.NOTION_SHOPPING_LIST_DB  →  config.shopping_list_db
env.NOTION_RECIPES_DB        →  config.recipes_db
env.NOTION_RECIPE_INGREDIENT_DB → config.recipe_ingredient_db
env.NOTION_TODOS_DB          →  config.todos_db
```

---

## Frontend Changes

### Modified — `frontend/src/main.tsx`

Wrap the app:
```tsx
import { ClerkProvider } from '@clerk/clerk-react'

<ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
  <App />
</ClerkProvider>
```

---

### Modified — `frontend/src/context/AuthContext.tsx`

Replace custom auth state with a thin wrapper around Clerk + household context:

```typescript
interface HouseholdContext {
  householdId: string | null
  householdName: string | null
  role: 'owner' | 'member' | null
  isLoading: boolean
}

// Uses useUser() from @clerk/clerk-react for identity
// Fetches /household/me for household state (on mount, after sign-in)
// Exposes: { householdId, householdName, role }
```

---

### Modified — `frontend/src/api/client.ts`

Replace `localStorage.getItem('casita_token')` with Clerk's `getToken()`:

```typescript
import { useAuth } from '@clerk/clerk-react'

// In the request helper:
const token = await getToken()   // Clerk issues a fresh, validated JWT
```

The 401 handler (`onUnauthorized`) stays — Clerk's `getToken()` returns null if signed out, which triggers the same redirect.

---

### Modified — `frontend/src/components/Login.tsx`

Replace email/password form with Clerk's hosted component:
```tsx
import { SignIn } from '@clerk/clerk-react'

// Route: /sign-in
<SignIn routing="hash" />
```

Or use Clerk's redirect-based flow: remove the Login page entirely and let Clerk's `<RedirectToSignIn />` handle unauthenticated users. Style via Clerk's appearance API to match MUI theme colors.

---

### New — `frontend/src/components/HouseholdSetup.tsx`

Shown to signed-in users whose `/household/me` returns `householdId: null`:
- "Create a household" — text field for name + Notion DB IDs → `POST /household`
- "Join with a code" — text field for invite code → `POST /household/join`

After either action, redirect to `/`.

---

### Modified — `frontend/src/App.tsx`

```tsx
import { SignedIn, SignedOut, RedirectToSignIn } from '@clerk/clerk-react'

// Replace ProtectedRoute with:
function ProtectedRoute({ children }) {
  const { householdId, isLoading } = useHousehold()
  if (isLoading) return <LoadingScreen />
  if (householdId === null) return <Navigate to="/household/setup" replace />
  return <>{children}</>
}

// Add routes:
<Route path="/sign-in/*" element={<SignIn routing="path" path="/sign-in" />} />
<Route path="/household/setup" element={<SignedIn><HouseholdSetup /></SignedIn>} />
<Route path="*" element={<SignedOut><RedirectToSignIn /></SignedOut>} />
```

---

## Migration of Existing Two Users

1. Deploy all phases above with KV fallback active
2. Bernardo + Cesar sign in with Google via Clerk (Clerk creates their accounts)
3. Get Clerk user IDs from Clerk dashboard (`Users` tab)
4. Run seed SQL with real IDs (see schema section above)
5. Both users confirm data is visible
6. Remove KV fallback from `index.ts`
7. Remove `/auth/check`, `/auth/setup`, `/auth/login` routes from `auth.ts`
8. Delete `frontend/src/components/AccountSetup.tsx`
9. Remove `ALLOWED_EMAILS` from `wrangler.toml`

---

## Agent-Optimized Implementation Order

Agents within the same wave run **in parallel**.

### Wave 1 — Foundation ✅ DONE

Single agent updates type files and config before anything imports from them:
- `worker/src/types.ts` — add `DB: D1Database`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `RequestContext`
- `worker/src/db/schema.sql` — create file with full schema
- `worker/wrangler.toml` — add `[[d1_databases]]` binding and `CLERK_PUBLISHABLE_KEY` var

---

### Wave 2 — Parallel build (4 agents simultaneously, ~15 min) ✅ DONE

**Agent A — `worker/src/auth/clerk.ts`**
- Install `@clerk/backend` in the worker package
- Implement `getClerkClient` and `verifyClerkToken`
- No dependencies on other Wave 2 agents

**Agent B — `worker/src/routes/household.ts`**
- Implement all 5 household routes using D1
- Imports `RequestContext` from `../types`
- Invite code generation, role checks, D1 CRUD

**Agent C — `frontend/src/api/client.ts` + `frontend/src/context/AuthContext.tsx`**
- Install `@clerk/clerk-react` in the frontend package
- Update `client.ts` to use Clerk `getToken()`
- Replace `AuthContext` with `useUser()` + `/household/me` fetch
- No backend needed — types-only dependency on the agreed API shape

**Agent D — `frontend/src/components/HouseholdSetup.tsx` + `frontend/src/main.tsx`**
- Wrap app with `<ClerkProvider>` in `main.tsx`
- Build `HouseholdSetup.tsx` UI (create + join flows)
- Uses `useHousehold()` from Agent C's context; no backend needed

---

### Wave 3 — Integration (2 agents simultaneously, after Wave 2) ✅ DONE

**Agent E — `worker/src/index.ts`** ✅ DONE
- Depends on Agent A (Clerk verifier) and Agent B (household routes)
- Replace session middleware with Clerk JWT check + D1 household lookup
- Add KV fallback (remove in migration step)
- Register 5 new household routes

**Agent F — `worker/src/routes/items.ts` + `todos.ts` + `recipes.ts`** ✅ DONE
- Update all 3 route files to accept `ctx: RequestContext`
- Replace `env.NOTION_*_DB` with `household_notion_config` D1 lookup
- Return 403 if `ctx.householdId` is null

---

### Wave 4 — Frontend routing (1 agent, after Wave 2) ✅ DONE (sign-in loop unresolved)

**Agent G — `frontend/src/App.tsx` + `frontend/src/components/Login.tsx`** ✅ DONE
- Replaced `ProtectedRoute` with Clerk-aware version (waits for `isClerkLoaded`, checks household)
- Added `SignInPage` wrapper (guards against already-signed-in users hitting `<SignIn>`)
- Added `/sign-in`, `/household/setup` routes
- `Login.tsx` replaced with Clerk `<SignIn routing="virtual" />`
- `AuthContext.tsx` patched: added `legacyUser` localStorage fallback, `refreshHousehold`, `refreshKey`
- `HouseholdSetup.tsx` patched: calls `refreshHousehold()` after create/join

**⚠️ Known issue — Clerk sign-in redirect loop (unresolved as of 2026-06-06)**

The embedded `<SignIn routing="virtual">` component still triggers a redirect loop in the browser
(`Throttling navigation to prevent the browser from hanging`). Attempted fixes:
- Changed `routing="hash"` → `routing="virtual"` (no effect)
- Added `isClerkLoaded` guard in `ProtectedRoute` to prevent premature redirect (no effect)
- Added `SignInPage` wrapper that redirects signed-in users away from `/sign-in` (no effect)

The `redirectUrl deprecated` warning in the console points to Clerk's internal `redirectToSignIn`
being called from within its `SignIn` component. The loop appears to be Clerk fighting with
`HashRouter` over URL control even with `routing="virtual"`.

**Likely root cause:** Clerk's embedded `<SignIn>` component always tries to drive navigation
regardless of `routing` mode when it detects an active session. `HashRouter` intercepts the
navigation and re-triggers ProtectedRoute, causing the loop.

**Recommended next steps to investigate:**
1. Try `routing="path"` with a dedicated sign-in path — may need to switch from HashRouter to
   BrowserRouter (or MemoryRouter for the sign-in subtree only)
2. Try Clerk's redirect-based flow instead of embedded: replace `<SignIn>` with `<RedirectToSignIn>`
   in `ProtectedRoute` and configure Clerk dashboard's "Sign-in URL" to point to Clerk's hosted page
3. Try `<SignInButton mode="modal">` — avoids URL routing entirely by showing sign-in in a modal
4. Check if the loop only happens when a Clerk session IS active (i.e. the component detects
   an existing session and tries to redirect to `afterSignInUrl` which isn't set)
5. Set `afterSignInUrl="/"` and `afterSignUpUrl="/household/setup"` on `<ClerkProvider>` in
   `main.tsx` — may give Clerk a destination and stop it from looping

---

### Wave 5 — Deploy + Seed (sequential, manual)

**Prerequisites before Wave 5:**
- Resolve the Clerk sign-in loop (see Wave 4 known issue above)
- Add `CLERK_SECRET_KEY=sk_test_...` to `worker/.dev.vars` (get from Clerk dashboard → API Keys)
- Change `VITE_WORKER_URL` in `frontend/.env.local` to `http://localhost:8787` for local testing

**Local test steps (do before deploying to production):**
1. `wrangler d1 execute casita --local --file worker/src/db/schema.sql` — D1 ID already in wrangler.toml (`19d078e5-4a7c-4dad-9a9c-45ccf66e2bd8`)
2. `wrangler dev` (worker) + `npm run dev` (frontend) — run both simultaneously
3. Sign in via Clerk → get your `user_xxx` ID from Clerk dashboard → seed local D1:
   ```sql
   INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);
   INSERT INTO household_notion_config VALUES ('hh-home',
     '2f2332846c00818498dd000c02f39cdd',
     '2f2332846c0081f0945f000cd6348876',
     '331332846c00808b9c33000c300050b2',
     '332332846c00806480fdfd6be9f5ffa0');
   INSERT INTO household_members VALUES ('hh-home', '<YOUR_CLERK_USER_ID>', 'owner', unixepoch() * 1000);
   ```
   Run with: `wrangler d1 execute casita --local --command "..."`
4. Verify data loads (shopping list, recipes, todos)

**Production deploy steps (after local test passes):**
1. `wrangler secret put CLERK_SECRET_KEY`
2. `wrangler deploy`
3. Build + deploy frontend
4. Both users sign in → get Clerk IDs from dashboard → run seed SQL against production D1
5. Verify data loads correctly
6. Run migration cleanup: remove KV fallback from `index.ts`, remove old `/auth/*` routes, remove `ALLOWED_EMAILS`

---

## Verification

**New user:**
1. Open app → redirected to Clerk sign-in
2. Sign in with Google → redirected to `/household/setup`
3. Create household → home page loads with empty lists

**Existing user:**
1. Sign in with Google → home page loads with existing Notion data

**Join flow:**
1. Household owner generates invite code from settings
2. New user signs in → enters code in `/household/setup` → joins household
3. Both users see the same shopping list

**Isolation:**
- Sign in with a user from a different household → verify different Notion DB IDs are used → different data returned

**Session expiry:**
- Clerk JWTs expire automatically; `getToken()` refreshes them silently → verify no unexpected 401s during normal use
