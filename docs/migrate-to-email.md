### About project

As long as you use **email as the identifier** to link your database records to users (rather than Clerk's `user_id`), you're in good shape.

Here's how it works in practice:

1. **Users sign up again** on your production domain — they'll get new Clerk `user_id` values, but their email addresses stay the same.
2. **Your database stays as-is** — when a user signs in on production, you match them to their existing database records by email.

If your database currently uses Clerk's `user_id` as the foreign key instead of email, you have two options:

- **Before going live:** Add a migration step that replaces the old dev `user_id` references with the user's email (or a stable internal ID you control), so the lookup works regardless of which Clerk instance issued the ID.
- **Use Clerk's** `external_id`**:** When recreating users via the migration tool, store their old dev `user_id` as the `external_id` field. Then configure your session token claims to return `{{user.external_id || user.id}}`, so your app keeps seeing the same ID it expects.

The cleanest long-term pattern is to **not depend on Clerk's** `user_id` **as your primary database key**. Use email or your own internal user ID, and treat Clerk's ID as an auth-layer detail. That way you're never locked to a specific Clerk instance.

## Why

Clerk dev and production are separate instances. When we switch to production Clerk, every user gets a new `clerk_user_id`. But their **email stays the same**. By storing email alongside `clerk_user_id` now, we can re-link users to their households, Google tokens, and calendar preferences after the switch.

---

## Active bugs this migration also fixes

| File | Line | Bug |
|---|---|---|
| `worker/src/routes/calendar.ts` | 176 | `e.ownerEmail !== clerkUserId` compares email vs Clerk ID — always false, so the requesting user's own shared entries are never excluded |
| `worker/src/routes/calendar.ts` | 183 | `getValidAccessToken(entry.ownerEmail, env)` passes an email to a function that expects `clerkUserId` — always returns null, breaking calendar sharing entirely |
| `worker/src/routes/user-calendars.ts` | 40 | `rebuildSharedIndex(clerkUserId, ...)` passes a Clerk ID as the `updatedEmail` param, so `ownerEmail` in the shared index is a Clerk ID, not an email |

All three are fixed organically in Phase 3.

---

## Phase 1 — Add `email` to the schema and backfill ✅

**D1 migration** (`worker/src/db/migrations/005_email.sql`)

```sql
ALTER TABLE household_members ADD COLUMN email TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS hm_email ON household_members(email);
```

**Schema** (`worker/src/db/schema.sql`) — add `email TEXT` to `household_members`, add index.

**Backfill route** `POST /admin/backfill-emails` (guarded by `X-Admin-Secret`, added to `worker/src/index.ts`):
- `SELECT clerk_user_id FROM household_members WHERE email IS NULL`
- For each row: Clerk SDK `GET /users/{id}` → extract `emailAddresses[0].emailAddress`
- `UPDATE household_members SET email = ? WHERE clerk_user_id = ?`
- Returns a log array (same pattern as `/admin/migrate`)

---

## Phase 2 — Capture email on every request

**Clerk Dashboard** → Sessions → Customize session token → add:

```json
{
  "email": "{{user.primary_email_address}}"
}
```

**`worker/src/auth/clerk.ts`** — update return type:

- `verifyClerkToken` returns `{ userId: string; email: string }` instead of `{ userId }`
- Extract `email` from `(payload as any).email ?? ''`

**`worker/src/types.ts`** — update `RequestContext`:

```ts
interface RequestContext {
  clerkUserId: string
  email: string          // ← new
  householdId: string | null
  role: 'owner' | 'member' | null
}
```

**`worker/src/index.ts`** — after verifying the JWT:

- Destructure `const { userId: clerkUserId, email } = verified`
- If membership found and `membership.email !== email`: `UPDATE household_members SET email = ? WHERE clerk_user_id = ?` (keeps email fresh on every login)
- **Phase 4 fallback**: if no membership found by `clerk_user_id`, try `WHERE email = ?`; if found, update the row's `clerk_user_id` and use that membership
- Set `ctx.email = email`

---

## Phase 3 — Re-key KV entries to use email

Currently, per-user KV state uses `clerk_user_id` as the key:

| KV key pattern | File |
| --- | --- |
| `google_tokens:${clerkUserId}` | `routes/google-auth.ts` |
| `user_calendars:${clerkUserId}` | `routes/user-calendars.ts` |
| `oauth_state:${state}` → value has `{ clerkUserId }` | `routes/google-auth.ts` |

**Change all KV keys to use `email` instead.**

**`worker/src/routes/google-auth.ts`**:
- `initiateGoogleOAuth`: store `{ email: ctx.email }` in `oauth_state`
- `handleGoogleOAuthCallback`: destructure `{ email }` from state; write `google_tokens:${email}`
- `getGoogleAuthStatus`, `disconnectGoogle`: use `ctx.email` for KV keys
- `getValidAccessToken(email, env)`: rename param, update all KV key references

**`worker/src/routes/user-calendars.ts`**:
- Pass `ctx.email` to `getValidAccessToken`; use `user_calendars:${ctx.email}` everywhere
- Pass `ctx.email` to `rebuildSharedIndex`

**`worker/src/routes/calendar.ts`**:
- `fetchUserOAuthEvents(email, ...)`: use `user_calendars:${email}`, `google_tokens:${email}`
- `fetchSharedCalendarEvents(email, ...)`: fix filter to `e.ownerEmail !== email`
- `getCalendarEvents`: pass `ctx.email` to both helpers

**`worker/src/routes/household.ts`**:
- `createHousehold` and `joinHousehold`: add `email` column to `INSERT INTO household_members`

**KV data migration route** `POST /admin/migrate-kv-to-email` (in `worker/src/index.ts`):
- For each user in `household_members WHERE email IS NOT NULL`:
  - Read old `google_tokens:${clerk_user_id}` → write `google_tokens:${email}` → delete old
  - Read old `user_calendars:${clerk_user_id}` → write `user_calendars:${email}` → delete old
- Returns a migration log

---

## Phase 4 — Production Clerk switch

When ready to go live:

1. **Create production Clerk app**, get new keys
2. **Update wrangler secrets**: `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_JWT_KEY`
3. **Update frontend env**: `VITE_CLERK_PUBLISHABLE_KEY`
4. Users sign up/in again → Clerk gives them new `clerk_user_id` values
5. **On first authenticated request** (in `index.ts`):
    - The membership query `WHERE clerk_user_id = ?` returns nothing (new ID, no match)
    - **Fall back to `WHERE email = ?`** → finds the existing membership
    - Update the row: `UPDATE household_members SET clerk_user_id = ? WHERE email = ?`
    - From here on, the new `clerk_user_id` works normally
6. KV data is already keyed by email → **no KV migration needed**

---

## Phase 5 — Clean up

Once all users have logged in on production and their `clerk_user_id` has been re-linked:

- Remove the email fallback logic from `index.ts` (optional — it's harmless to keep)
- Verify all `household_members` rows have updated `clerk_user_id` values

---

## Files changed (summary)

| File | Change |
| --- | --- |
| `worker/src/db/migrations/005_email.sql` | New migration: add `email` column + index |
| `worker/src/db/schema.sql` | Reflect `email` column in schema |
| `worker/src/auth/clerk.ts` | Return `{ userId, email }` from JWT |
| `worker/src/types.ts` | Add `email` to `RequestContext` |
| `worker/src/index.ts` | Set `ctx.email`; email sync on mismatch; email fallback for membership; backfill + KV migration admin routes |
| `worker/src/routes/google-auth.ts` | KV keys use `email`; fix oauth_state value; rename `getValidAccessToken` param |
| `worker/src/routes/user-calendars.ts` | KV keys use `ctx.email`; pass email to helpers |
| `worker/src/routes/shared-calendar-index.ts` | No change needed (already uses `ownerEmail` correctly) |
| `worker/src/routes/calendar.ts` | Pass `email` to helpers; fix `ownerEmail !== clerkUserId` bug |
| `worker/src/routes/household.ts` | Include `email` in membership inserts |
| `frontend/` | Update Clerk publishable key env var (at switch time only) |

---

## Order of operations

1. **Ship Phase 1** — deploy migration, run `POST /admin/backfill-emails`
2. **Ship Phases 2–3** — deploy auth layer + KV re-keying; run `POST /admin/migrate-kv-to-email`
3. **Configure Clerk Dashboard** — add email to session token claims
4. **Test the fallback** — manually clear a user's `clerk_user_id` and verify email fallback works
5. **Ship Phase 4** — swap Clerk keys, users re-login, seamless re-link
6. **Phase 5** — clean up once stable
