# Email Communications Preferences

## Goal

Enable users to opt into email notifications and deliver a small set of high-value emails: a welcome message, a weekly todo digest, and an onboarding drip series. The work is split into phased waves so each wave ships something real and independently valuable.

---

## Long-term roadmap

| Phase | Scope |
|---|---|
| **V1** | Prefs UI + DB, Resend wired up, welcome email, unsubscribe |
| **V2** | Weekly todo digest via Cloudflare Cron Trigger |
| **V3** | Onboarding drip (3–5 emails via Cloudflare Queue) |
| **V4** | Per-category toggles (tips series, reminders, household updates) |
| **V5** | Household-level vs. member-level prefs, admin defaults |

---

## V1 — Prove the pipe

### 1. Database migration

Add to `household_members`:

```sql
ALTER TABLE household_members
  ADD COLUMN email_notifications_enabled INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN email_frequency TEXT NOT NULL DEFAULT 'weekly',
  ADD COLUMN unsubscribe_token TEXT;
```

- `email_frequency`: `'immediate' | 'weekly' | 'off'`
- `unsubscribe_token`: a random UUID generated on first email send, used for one-click unsubscribe without auth

Migration file: `worker/src/db/migrations/NNN_email_comms_prefs.sql` (replace NNN with next sequence number).

Update `worker/src/db/schema.sql` with the same columns.

### 2. Worker — comms preferences endpoint

`PATCH /account/comms-preferences`

Request body:
```ts
{
  emailNotificationsEnabled: boolean;
  emailFrequency: 'immediate' | 'weekly' | 'off';
}
```

- Validates the caller is authenticated (Clerk JWT).
- Updates `household_members` for the current user's `clerk_id`.
- Returns `200 { success: true }`.

### 3. Settings UI — Notifications section

Add `NotificationsSettings.tsx` in `frontend/src/components/settings/` and wire it into `SettingsMenu.tsx` + the settings router.

UI:
- **Email notifications** toggle (maps to `emailNotificationsEnabled`)
- **Frequency** radio/select — "Weekly digest" / "Off" (keep it simple for v1; "Immediate" can be added when we have real immediate triggers)
- Short helper text explaining what emails they'll receive
- Backed by a TanStack Query mutation hitting `PATCH /account/comms-preferences`

### 4. Email provider — Resend

- Add Resend to `worker/`: `pnpm add resend` inside `worker/`
- Store `RESEND_API_KEY` as a Cloudflare Worker secret (`wrangler secret put RESEND_API_KEY`)
- Add `RESEND_FROM_EMAIL` to `wrangler.toml` vars (e.g. `hello@casita.app`)
- Create `worker/src/email/resend.ts` — thin wrapper: `sendEmail({ to, subject, html })` that calls the Resend API

Verify the sender domain in the Resend dashboard before any sends.

### 5. Welcome email

Trigger: when a new `household_members` row is created (user signs up or is invited and accepts).

- Fire-and-forget: call `sendEmail` from the household creation/accept handler
- Respect `email_notifications_enabled` — skip if user has opted out (unlikely on first signup, but good habit)
- Content: brief welcome, 2–3 bullet points on what Casita does, link to the app
- Keep it plain HTML for now — no fancy templating needed in v1

### 6. Unsubscribe endpoint

`GET /account/unsubscribe?token=<token>`

- Looks up `household_members` by `unsubscribe_token`
- Sets `email_notifications_enabled = 0` and `email_frequency = 'off'`
- Returns a simple HTML page: "You've been unsubscribed. [Manage your preferences]"
- No auth required — the token is the credential

Every outbound email must include a footer with this link. CAN-SPAM / GDPR compliance from day one.

---

## V2 — Weekly todo digest

Trigger: Cloudflare Cron Trigger, runs every Monday morning (configurable in `wrangler.toml`).

Logic:
1. Query all `household_members` where `email_notifications_enabled = 1` and `email_frequency = 'weekly'`
2. For each user, query their open/overdue todos
3. If they have no open todos, skip (don't send empty digests)
4. Send digest email: list of todos grouped by household, with deep links into the PWA

Add `scheduled` handler to the worker export.

---

## V3 — Onboarding drip

Use Cloudflare Queues to schedule delayed sends after signup.

Drip schedule (approximate):
| Delay | Subject |
|---|---|
| Immediate | Welcome (same as V1 welcome email — keep consistent) |
| Day 2 | "Your first shopping list" — how Shopping + Recipes connect |
| Day 5 | "Keep the household in sync" — invite a household member |
| Day 10 | "Never forget a to-do" — recurring todos, priorities |
| Day 14 | "Power features" — Concepts/tags, Google Calendar |

On signup, enqueue 4 delayed messages (day 2–14; day 0 is the welcome email).
Each queue message contains `{ userId, emailType }`.
Queue consumer checks current opt-in status before sending — respects late unsubscribes.

---

## V4 — Per-category toggles

Extend `comms_preferences` JSON column (or individual columns) to track:

```ts
{
  welcome: boolean;       // onboarding drip
  reminders: boolean;     // todo digest
  tips: boolean;          // learning series
  householdUpdates: boolean; // member joins, ownership transfers
}
```

Update Settings UI with granular toggles per category.

---

## V5 — Household-level defaults

Household owner can set default prefs for new members.
Each member can still override their own prefs.
Admin-level endpoint: `PATCH /household/comms-defaults`.

---

## Key decisions / constraints

- **Resend** is the chosen provider — native fetch API, great Cloudflare Workers support, generous free tier.
- **No email templating library** for v1 — raw HTML strings in the worker are fine. Introduce React Email or similar only if the volume of email types justifies it.
- **Unsubscribe token** is generated lazily on first send (not at account creation) to avoid unnecessary DB writes for users who never receive email.
- **Never send to users with `email_notifications_enabled = 0`** — check this in every send path, not just the cron.
- All emails must include an unsubscribe footer link and a physical mailing address (CAN-SPAM requirement).
