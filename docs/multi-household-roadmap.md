# Multi-Household Roadmap

## What & Why

Casita currently serves one implicit household — Bernardo and Cesare share a single Notion workspace with no formal user-to-household mapping. The goal of this doc is to lay out the path toward:

1. **Household A (Home)** — Bernardo + Cesare, using the existing Notion data
2. **Household B** — a second, completely independent pair of users with their own data

Both households run on the same Worker and app. Data is partitioned by `household_id` at the API layer; there is no cross-household data leakage.

This doc is a strategic overview. It references two existing implementation plans and describes how they fit together:

- [`auth-plan.md`](./auth-plan.md) — Clerk OAuth + D1 household tables (the foundation)
- [`editable-concepts.md`](./editable-concepts.md) — runtime-editable categories, recipe types, supermarkets, etc.

---

## The Household Model

A **household** is the unit of data sharing. Every piece of app data — shopping list, recipes, todos, concepts — belongs to exactly one household. Users are members of a household with one of two roles: `owner` or `member`.

```
User (Clerk identity)
 └── HouseholdMember (role: owner | member)
      └── Household
           ├── household_notion_config  ← which Notion DBs to read/write
           ├── Shopping list (scoped to household)
           ├── Recipes       (scoped to household)
           ├── Todos         (scoped to household)
           └── Concepts      (per-household categories, types, etc.)
```

A user signs in via Clerk, the Worker resolves their `household_id`, and all subsequent API calls are automatically scoped to that household. A user with no household is redirected to a setup screen to create or join one.

The calendar is the exception: it's already household-scoped via the existing Google OAuth + visibility system. No changes needed there.

---

## Two-Household Vision

### Household A — "Home" (Bernardo + Cesare)

This is the existing household. No data migration is required:

- Bernardo and Cesare sign in with Google via Clerk
- Their Clerk user IDs are seeded into `household_members` pointing to `household_id = 'hh-home'`
- A single row in `household_notion_config` maps `hh-home` to the existing Notion database IDs
- From that point on, the app works exactly as before, just with proper auth and isolation

### Household B — Second household (two new users)

A completely independent household on the same infrastructure:

- One of the new users signs in → goes to `/household/setup` → clicks "Create a household"
- Enters a household name + their own Notion database IDs (or these can be pre-seeded by an admin)
- Gets an invite code → shares it with the second user
- Second user signs in → enters the invite code → joins the household
- Both users see only their own household's data

No changes to Notion, the Worker, or any feature code are needed to support a second household — it's a data-layer concern only (new rows in `households`, `household_members`, `household_notion_config`).

---

## Feature-by-Feature Implications

### Shopping List, Recipes, Todos

Currently hit hardcoded Notion DB IDs from `wrangler.toml`. After auth-plan Wave 3F, each handler will:

1. Look up `household_notion_config` from D1 using `ctx.householdId`
2. Use the household-specific DB IDs for all Notion calls

No functional changes to the UI or business logic — purely a routing change in the Worker.

### Calendar

Already works at the household level. The `household_shared_calendars` KV key is rebuilt from all members' enabled calendars. When a second household is added, their calendars are isolated because the KV key namespacing is per-app-instance, not per-household.

**Future consideration (not needed now):** If the app ever supports hundreds of households, the KV key should be namespaced per household (e.g. `household_shared_calendars:{householdId}`). For two households, the current model works as long as both households are distinct sets of users.

### Editable Concepts (recipe types, supermarkets, categories, etc.)

The editable-concepts plan creates D1 tables for runtime-editable enums. These should be **per-household** — each household manages its own categories and recipe types independently.

This means the concepts tables need a `household_id` column:

```sql
CREATE TABLE recipe_types (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id),
  name         TEXT NOT NULL,
  sort_order   INTEGER,
  UNIQUE(household_id, name)
);
-- Same pattern for: todo_statuses, todo_priorities, supermarkets, categories, tags
```

All concept API handlers will accept `ctx.householdId` and filter/insert by it — the same pattern as items/todos/recipes.

Seed data (the current hardcoded defaults) is inserted per-household at creation time or on first use.

---

## Ordered Next Steps

These steps build on each other; complete each phase before starting the next.

### Step 1 — Auth + D1 Foundation (`auth-plan.md` Waves 1–4)

Everything else depends on this.

- Install Clerk, create D1 database, apply schema
- Replace KV sessions with Clerk JWT verification
- Add `household_members` + `household_notion_config` tables
- Build `HouseholdSetup` UI (create + join flows)
- Update `items.ts`, `todos.ts`, `recipes.ts` to use D1 household config

**Deliverable:** Bernardo and Cesare can sign in with Google, see their existing Notion data, and the app is otherwise identical to today.

### Step 2 — Seed Household A

Manual step after Step 1 deploys:

```sql
-- Get Clerk user IDs from Clerk dashboard after both users sign in once
INSERT INTO households VALUES ('hh-home', 'Home', NULL, unixepoch() * 1000);
INSERT INTO household_notion_config VALUES (
  'hh-home',
  '<shopping_list_db_id>',
  '<recipes_db_id>',
  '<recipe_ingredient_db_id>',
  '<todos_db_id>'
);
INSERT INTO household_members VALUES ('hh-home', '<bernardo_clerk_id>', 'owner', unixepoch() * 1000);
INSERT INTO household_members VALUES ('hh-home', '<cesar_clerk_id>', 'member', unixepoch() * 1000);
```

Verify both users see existing data, then remove KV fallback and old `/auth/*` routes.

### Step 3 — Editable Concepts (`editable-concepts.md`, per-household)

Implement the editable-concepts plan with one adjustment: add `household_id` to all concept tables and filter by it in every handler. The API shape and frontend are otherwise identical to the plan.

**Deliverable:** Each household manages its own recipe types, supermarkets, and categories independently.

### Step 4 — Second Household Onboarding

No code changes needed. Operational steps only:

1. Generate an invite code for Household A to confirm the flow works end-to-end
2. The two new users sign in via Clerk → one creates a household → gets an invite code → second user joins
3. They enter their Notion DB IDs in the `HouseholdSetup` form
4. Seed `household_notion_config` if IDs aren't entered via UI yet

**Deliverable:** A fully isolated second household is live on the same app.

---

## What Stays the Same

- Notion remains the data store for both households — no migration to D1 for app data
- Recipe photo storage (R2) is not household-scoped yet; recipe photos are global by key. This is fine for two households but worth noting.
- The public recipe sharing feature (`/public/recipes/:token`) works across households — a shared recipe token can be viewed by anyone, which is intentional.
- Google Calendar OAuth tokens are stored per-user in KV and do not need changes.

---

## Open Questions

- **Notion DB IDs for Household B**: Will the new users set up their own Notion workspace and enter DB IDs, or will an admin pre-seed the `household_notion_config` row? The `HouseholdSetup` UI in auth-plan.md has a form for this.
- **Recipe photo isolation**: If both households are active, R2 keys are currently flat UUIDs. Photos are not guessable (UUID), but they're not access-controlled by household. Add a `household_id` prefix to R2 keys if stricter isolation is needed.
- **KV calendar sharing**: The `household_shared_calendars` KV key will need namespacing if a second household's users connect Google Calendar. Track this as a prerequisite for Household B enabling calendar sharing.
