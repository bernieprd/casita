# Auth — Status Document

## What & Why

Casita previously used a naive auth system: email whitelist, SHA-256 unsalted passwords, and UUID session tokens in Cloudflare KV. This has been replaced with OAuth via Clerk (Google enabled), a D1-backed "household" concept for per-household Notion DB isolation, and an invite-code join flow so new users can be added without manual seeding. Clerk is the identity source of truth; D1 owns the household graph. The KV session path is kept as a fallback during migration and will be removed once both users are on Clerk.

---

## Architecture Decisions

- **Clerk for identity** — Google OAuth (and optionally email/password) out of the box; Worker validates Clerk JWTs. Clerk's footprint is limited to the auth layer and is replaceable.
- **D1 for households** — `households`, `household_members`, `household_notion_config` tables in the existing `casita` D1 database.
- **Notion DB IDs moved to D1** — each household row stores its own Notion DB IDs, replacing hardcoded `env.NOTION_*_DB` vars. No Notion data migration needed.
- **`BrowserRouter` instead of `HashRouter`** — required for Clerk path routing; Cloudflare Pages SPA routing handled by `frontend/public/_redirects`.
- **KV sessions kept as fallback** — existing sessions remain valid until both users confirm OAuth works, then removed in migration cleanup.
- **Households use invite codes** — owner generates a short code; new users enter it after signing in to join.

---

## D1 Schema

Database: `casita` (`19d078e5-4a7c-4dad-9a9c-45ccf66e2bd8`)

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
```

Seed SQL used locally (already applied to local D1):
```sql
INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);
INSERT INTO household_notion_config VALUES ('hh-home',
  '2f2332846c00818498dd000c02f39cdd',
  '2f2332846c0081f0945f000cd6348876',
  '331332846c00808b9c33000c300050b2',
  '332332846c00806480fdfd6be9f5ffa0');
INSERT INTO household_members VALUES ('hh-home', 'user_3EnOERGusAVZh3uyiowVPf8qVYe', 'owner', unixepoch() * 1000);
```

---

## Status

### Done (verified working locally)

- Clerk app created, Google OAuth enabled
- `CLERK_SECRET_KEY` in `worker/.dev.vars`; `VITE_CLERK_PUBLISHABLE_KEY` in `frontend/.env.local`
- D1 database created; schema migrated locally
- `household_notion_config` seeded for `hh-home` with all four Notion DB IDs
- `household_members` seeded: `user_3EnOERGusAVZh3uyiowVPf8qVYe` → `hh-home` (owner)
- `ClerkProvider` wired in `main.tsx` with sign-in/sign-up URLs and fallback redirects
- `BrowserRouter` replacing `HashRouter`
- `frontend/public/_redirects` added for Cloudflare Pages SPA routing
- `APP_BASE_URL` corrected in `wrangler.toml` and `.dev.vars`
- `AuthContext` updated: Clerk JWT token getter registered, household state from `/household/me`
- `householdName` field mismatch fixed (`data.name` → `data.householdName`)
- Worker auth middleware: Clerk JWT verification + KV session fallback + D1 household lookup
- All household CRUD routes implemented (`/household/me`, `POST /household`, `POST /household/join`, `POST/DELETE /household/invite`)
- All data routes updated to accept `RequestContext` and look up Notion DB IDs from `household_notion_config`
- Sign-in (`/sign-in`) and sign-up (`/sign-up`) routes with Clerk path routing
- `HouseholdSetup` screen for first-time users (create or join)
- Logout link on Home tab
- Google OAuth sign-in and sign-up flow end-to-end
- `GET /household/me` resolves correctly after D1 seed
- Todos load correctly from Notion via D1 config
- `GET /items` and `GET /recipes` returning 404 (see Known Issues)
- `GET /calendar` returning 500 — KV key too long (see Known Issues)
- Duplicate household membership guard (see Known Issues)
- `/household/setup` route guard for users who already have a household (see Known Issues)
- `search: '*'` added to all URLPatterns; `[ROUTE HIT]`/`[ROUTE MISS]` diagnostic logs added to route dispatcher
- Calendar route refactored: `clerkUserId`-keyed KV lookups replace email-based keys; Google OAuth initiation returns `{ url }` JSON for safe authenticated redirect
- Google auth routes (`/auth/google`, `/auth/google/status`, `DELETE /auth/google`) moved to authenticated routes with `RequestContext`; `getValidAccessToken` and all related KV keys migrated from email to `clerkUserId`
- `user-calendars.ts` updated to use `clerkUserId` for all KV reads/writes
- D1 migration created (`worker/src/db/migrations/001_unique_user_household.sql`): deduplicates `household_members` and adds `UNIQUE INDEX hm_unique_user` on `clerk_user_id`; `schema.sql` updated to match
- `HouseholdSetup.tsx` guards `/household/setup`: redirects to `/` if user already has a household

### Not yet done

- ~~Household settings screen (rename, invite code management, member list)~~ ✓ done
- Production deploy (see Wave 5 steps below)
- KV session fallback removal
- Old `/auth/*` routes removal
- `ALLOWED_EMAILS` removal from `wrangler.toml`

---

## Known Issues

### 1. `GET /items` and `GET /recipes` return 404

`GET /todos` works with the same `URLPattern` format; `GET /items` and `GET /recipes` do not match despite being registered identically in the routes array. Root cause not yet identified — possible URLPattern behavior specific to those path strings in `wrangler dev`, or a stale compilation artifact.

**Proposed fix:** Add explicit logging to the router to print the matched pattern and method for each request; compare against the `/todos` registration to spot any difference. Also try `wrangler dev --no-bundle` to rule out a build caching issue.

**Resolved:** Added `search: '*'` to all URLPatterns in `worker/src/index.ts` as a defensive fix; added `[ROUTE HIT]`/`[ROUTE MISS]` diagnostic logs to the route dispatcher.

---

### 2. `GET /calendar` returns 500 — KV key too long

`getCalendarEvents` calls `getValidAccessToken`, which does `AUTH_KV.get(key)` where `key` is derived from the raw request token. Clerk JWTs are ~834 bytes; KV's key limit is 512 bytes.

**Proposed fix:** Update `google-auth.ts` and `calendar.ts` to key on `ctx.clerkUserId` (a short `user_xxx` string) instead of the raw token. The `clerkUserId` is already available on `RequestContext` in every handler.

**Resolved:** Removed `session:${clerkJWT}` KV lookup in `calendar.ts`; all Google token/calendar KV keys now use `clerkUserId`. Google OAuth initiation returns `{ url }` JSON so the frontend fetches then redirects instead of a direct browser redirect with `?session=`.

---

### 3. User can belong to multiple households

`household_members` has no `UNIQUE` constraint on `clerk_user_id`. A user who hits `HouseholdSetup` before seed data is inserted ends up with two rows; the auth middleware's `.first()` resolves to whichever row was inserted first, which may not be the seeded household.

**Proposed fix:**
1. Add `UNIQUE(clerk_user_id)` constraint to `household_members` (or change the primary key to `clerk_user_id` alone if one-household-per-user is the invariant).
2. Add a migration to remove any duplicate rows before applying the constraint.

**Resolved:** Created `worker/src/db/migrations/001_unique_user_household.sql` which deduplicates existing rows and adds `CREATE UNIQUE INDEX hm_unique_user ON household_members(clerk_user_id)`; `schema.sql` updated to include the index for fresh creates.

---

### 4. `/household/setup` accessible to users who already have a household

No guard in the route — any authenticated user can POST to `/household` and create a second household, compounding issue 3.

**Proposed fix:** In the `createHousehold` handler, check whether the user already has a `household_members` row and return 409 if so. Also add a frontend guard in `HouseholdSetup.tsx` that redirects to `/` if `householdId` is already set in context.

**Resolved:** Added `useEffect` redirect guard in `frontend/src/components/HouseholdSetup.tsx` that redirects to `/` if `householdId` is already set in context.

---

## Next Steps (by priority)

1. **Production deploy** — follow Wave 5 steps below
2. **Cesare joins via invite** — share the invite code from Household Settings; he signs in and joins
3. **Migration cleanup** — follow checklist below after both users confirm the Clerk flow works

---

## Wave 5 — Production Deploy Steps

Run these in order after all known issues are resolved and local testing is clean.

1. Push secrets to production:
   ```bash
   wrangler secret put CLERK_SECRET_KEY
   ```
2. Deploy the Worker:
   ```bash
   wrangler deploy
   ```
3. Run D1 schema migration against production:
   ```bash
   wrangler d1 execute casita --file worker/src/db/schema.sql
   ```
4. Build and deploy the frontend to Cloudflare Pages.
5. Sign in with Google on production → get your Clerk user ID from the Clerk dashboard (Users tab).
6. Seed production D1 with Bernardo's ID and household config:
   ```bash
   wrangler d1 execute casita --command "INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);"
   wrangler d1 execute casita --command "INSERT INTO household_notion_config VALUES ('hh-home', '2f2332846c00818498dd000c02f39cdd', '2f2332846c0081f0945f000cd6348876', '331332846c00808b9c33000c300050b2', '332332846c00806480fdfd6be9f5ffa0');"
   wrangler d1 execute casita --command "INSERT INTO household_members VALUES ('hh-home', '<BERNARDO_CLERK_ID>', 'owner', unixepoch() * 1000);"
   ```
7. Verify all tabs load correctly on production.
8. Generate an invite code from Household Settings and share it with Cesare — he signs in and joins via the invite flow (no manual SQL needed).

---

## Migration Cleanup Checklist

Do this only after both users have confirmed the Clerk flow works on production.

- [ ] Remove KV session fallback from `worker/src/index.ts` (the `kv:` synthetic user block)
- [ ] Delete or empty `worker/src/routes/auth.ts` (the old `/auth/login`, `/auth/check`, `/auth/setup` routes)
- [ ] Remove old auth route registrations from `worker/src/index.ts`
- [ ] Delete `frontend/src/components/AccountSetup.tsx` (if it still exists)
- [ ] Remove `ALLOWED_EMAILS` from `wrangler.toml`
- [ ] Remove `NOTION_SHOPPING_LIST_DB`, `NOTION_RECIPES_DB`, `NOTION_RECIPE_INGREDIENT_DB`, `NOTION_TODOS_DB` from `wrangler.toml` vars (now in D1)
- [ ] Redeploy Worker and frontend after cleanup
