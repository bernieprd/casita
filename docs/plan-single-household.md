# Plan: Enforce One Household per Clerk User

## Problem

`household_members` uses a composite PK `(household_id, clerk_user_id)`, which allows the same `clerk_user_id` to appear in multiple rows — one per household. The auth middleware's `.first()` D1 query resolves to whichever row comes first (undefined order), which caused a bug during local testing where a user ended up in two households and data routes returned 403.

Two entry points must be closed:
1. **DB layer** — no UNIQUE constraint on `clerk_user_id` alone
2. **Frontend layer** — `/household/setup` has no guard for users who already have a household

---

## Change 1 — DB Migration

Create `/Users/bernardoprudencio/Documents/casita/worker/src/db/migrations/0001_unique_member_per_user.sql`:

```sql
-- Migration 0001: enforce one household per Clerk user
-- SQLite does not support ADD CONSTRAINT, so we use the rename/recreate pattern.
-- Pre-flight: confirm no clerk_user_id duplicates exist before running.
BEGIN;

CREATE TABLE household_members_new (
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'member',
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (household_id, clerk_user_id)
);

INSERT INTO household_members_new
SELECT household_id, clerk_user_id, role, joined_at
FROM household_members;

DROP TABLE household_members;

ALTER TABLE household_members_new RENAME TO household_members;

CREATE INDEX IF NOT EXISTS hm_clerk_user_id ON household_members(clerk_user_id);

COMMIT;
```

Update `worker/src/db/schema.sql` to reflect the final state — add `UNIQUE` to the `clerk_user_id` column definition:

```sql
CREATE TABLE IF NOT EXISTS household_members (
  household_id  TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  clerk_user_id TEXT NOT NULL UNIQUE,
  role          TEXT NOT NULL DEFAULT 'member',
  joined_at     INTEGER NOT NULL,
  PRIMARY KEY (household_id, clerk_user_id)
);
CREATE INDEX IF NOT EXISTS hm_clerk_user_id ON household_members(clerk_user_id);
```

### Apply locally

```bash
cd worker
npx wrangler d1 execute casita --local \
  --file src/db/migrations/0001_unique_member_per_user.sql
```

### Apply to production (when deploying)

Pre-flight check first:
```bash
npx wrangler d1 execute casita --remote \
  --command "SELECT clerk_user_id, COUNT(*) AS n FROM household_members GROUP BY clerk_user_id HAVING n > 1;"
```

If no rows returned, apply:
```bash
npx wrangler d1 execute casita --remote \
  --file src/db/migrations/0001_unique_member_per_user.sql
```

---

## Change 2 — Frontend Route Guard (`frontend/src/App.tsx`)

Replace the existing route:
```tsx
<Route path="/household/setup" element={<SignedIn><HouseholdSetup /></SignedIn>} />
```

Add a `HouseholdSetupGuard` component (after `SignUpPage`, before `AppShell`) and use it instead:

```tsx
function HouseholdSetupGuard() {
  const { householdId, isLoading } = useHousehold()
  const { isSignedIn, isLoaded } = useUser()

  if (!isLoaded || isLoading) return null
  if (!isSignedIn) return <Navigate to="/sign-in" replace />
  if (householdId) return <Navigate to="/" replace />

  return <HouseholdSetup />
}
```

```tsx
<Route path="/household/setup" element={<HouseholdSetupGuard />} />
```

No new imports needed — `useHousehold`, `useUser`, and `Navigate` are already imported.

---

## No Changes Needed

- `createHousehold` / `joinHousehold` in `household.ts` — the existing `if (ctx.householdId) return err(409, …)` check is already correct
- `index.ts` — `.first()` is correct once the UNIQUE constraint exists; there will never be more than one row

---

## Verification

```bash
# Confirm constraint applied
npx wrangler d1 execute casita --local \
  --command "SELECT sql FROM sqlite_master WHERE name='household_members';"
# Should show: clerk_user_id TEXT NOT NULL UNIQUE

# Confirm duplicate insert rejected
npx wrangler d1 execute casita --local \
  --command "INSERT INTO household_members VALUES ('hh-home','user_3EnOERGusAVZh3uyiowVPf8qVYe','member',9999);"
# Should error: UNIQUE constraint failed: household_members.clerk_user_id
```

Frontend: while signed in with a household, navigate to `http://localhost:5173/household/setup` — should immediately redirect to `/`.
