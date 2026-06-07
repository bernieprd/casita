# Database Migration: Notion → Cloudflare D1

## The Problem with the Current Setup

Casita uses Notion as its primary data store for items, recipes, todos, and recipe ingredients. This works for a personal app, but creates compounding friction as the project grows:

| Pain point | Impact |
|---|---|
| Notion API latency | 200–800ms per query; every page load waits on it |
| Notion rate limits | 3 requests/second per integration; complex pages (recipe detail) hit this |
| No SQL | Can't join, aggregate, or do multi-filter queries without fetching all pages first |
| Per-household setup | Each new household must create their own Notion workspace and hand over 4 DB IDs |
| Two data stores mid-migration | auth-plan + editable-concepts both add D1; Notion stays for app data; now three sources |
| Manual Notion workspace setup for Household B | Real onboarding friction for the second household |

D1 is already being introduced for households and concepts. Stopping there leaves a split: auth/concepts in D1, app data in Notion. This doc evaluates whether to go further.

---

## Options

### Option A — Keep Notion for app data (partial D1)

Auth + concepts go to D1 (as planned). Items, recipes, todos stay in Notion. Each household gets its own Notion workspace; DB IDs stored in `household_notion_config`.

**Pros:** No migration effort. Works today.

**Cons:** Three data sources (KV + D1 + Notion). Household onboarding still requires a Notion workspace. Latency and rate limits remain. The `normalize.ts` / `notion.ts` layer stays indefinitely.

**Verdict:** Viable short-term but creates a permanent two-class system between meta-data (fast) and app data (slow).

---

### Option B — Full D1 migration (recommended)

All app data moves to D1. Notion becomes a read-only archive. One-time migration script copies everything over. `notion.ts` and `normalize.ts` are deleted after migration.

**Pros:**
- Single data source for all app data
- D1 query latency: ~1–5ms vs. 200–800ms for Notion
- No per-second rate limits
- No Notion workspace required to onboard a new household — they just sign in
- Proper foreign keys, joins, transactions
- Recipe ingredient queries become a single JOIN instead of N+1 Notion page fetches

**Cons:**
- One-time migration effort (~2–3 days)
- Lose Notion's manual editing interface (the PWA already replaces this)
- Recipe instructions (currently Notion block children) need a dedicated table

**Verdict: Recommended.** The editable-concepts plan already commits to D1; extending it to app data consolidates to one store and removes a permanent Notion dependency.

---

### Option C — Hybrid: D1 primary, Notion read-only

Same as Option B but Notion data is kept in place and not deleted. D1 becomes the source of truth going forward; Notion is an archived backup.

This is the safest migration path: run the migration, switch the app to D1, and leave Notion untouched for 30 days as a rollback option. After verification, stop paying for the Notion integration.

---

## Recommended Approach: Option B via Option C rollout

1. Migrate data to D1 (one-time script)
2. Switch the app to read/write D1
3. Keep Notion read-only for 30 days
4. Delete Notion integration token + remove `notion.ts`

---

## Household Isolation

Every piece of app data is scoped to a household. This works as follows:

- The auth middleware resolves `household_id` from `household_members` using the Clerk user ID from the JWT, and injects it into every Hono request via `c.set('householdId', ...)`.
- Every D1 route handler must bind `c.get('householdId')` as a `WHERE household_id = ?` clause on every query (SELECT, INSERT, UPDATE, DELETE). This is the only gate preventing cross-household data leakage.
- Multiple users in the same household (e.g. two household members) automatically share data because they resolve to the same `household_id` via `household_members`.
- The migration script must iterate over every row in `SELECT id FROM households`, then read that household's `household_notion_config` row to get its Notion DB IDs, then migrate all four resource types with the correct `household_id`.

---

## D1 Schema

The same D1 database used for households and concepts (`casita`). Add these tables to a new migration file `worker/src/db/migrations/002_app_data.sql` (following the convention of `001_unique_user_household.sql`).

```sql
-- ── Items (shopping list + pantry) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS items (
  id               TEXT PRIMARY KEY,           -- crypto.randomUUID()
  household_id     TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  category         TEXT,                        -- denormalized name; FK to categories if editable-concepts is live
  on_shopping_list INTEGER NOT NULL DEFAULT 0, -- boolean
  created_at       INTEGER NOT NULL,
  updated_at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS items_household ON items(household_id);
CREATE INDEX IF NOT EXISTS items_shopping  ON items(household_id, on_shopping_list);

-- Multi-value fields stored as junction tables (enables filtering and
-- enforces referential integrity with concept tables once editable-concepts lands)
CREATE TABLE IF NOT EXISTS item_supermarkets (
  item_id     TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  supermarket TEXT NOT NULL,
  PRIMARY KEY (item_id, supermarket)
);

CREATE TABLE IF NOT EXISTS item_tags (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  tag     TEXT NOT NULL,
  PRIMARY KEY (item_id, tag)
);

-- ── Recipes ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipes (
  id              TEXT PRIMARY KEY,
  household_id    TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  type            TEXT,
  day             TEXT,
  url             TEXT,
  cover_photo_url TEXT,
  share_token     TEXT UNIQUE,    -- replaces KV share:{token} → recipe_id
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipes_household   ON recipes(household_id);
CREATE INDEX IF NOT EXISTS recipes_share_token ON recipes(share_token);

-- Recipe instructions (replaces Notion block children)
CREATE TABLE IF NOT EXISTS recipe_blocks (
  id         TEXT PRIMARY KEY,
  recipe_id  TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'paragraph',
  text       TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS recipe_blocks_recipe ON recipe_blocks(recipe_id, sort_order);

-- ── Recipe Ingredients ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id             TEXT PRIMARY KEY,
  household_id   TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  recipe_id      TEXT NOT NULL REFERENCES recipes(id)   ON DELETE CASCADE,
  item_id        TEXT NOT NULL REFERENCES items(id),
  quantity       TEXT,
  section        TEXT,
  needs_shopping INTEGER NOT NULL DEFAULT 0,  -- boolean
  sort_order     INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS ri_recipe ON recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS ri_item   ON recipe_ingredients(item_id);

-- ── Todos ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS todos (
  id           TEXT PRIMARY KEY,
  household_id TEXT NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  status       TEXT NOT NULL DEFAULT 'Todo',
  priority     TEXT,
  due          TEXT,           -- ISO date string (YYYY-MM-DD), nullable
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS todos_household ON todos(household_id);
CREATE INDEX IF NOT EXISTS todos_due       ON todos(household_id, due);
```

### Design notes

**`item_supermarkets` / `item_tags` as junction tables, not JSON columns**
SQLite supports JSON columns and they'd be simpler, but the editable-concepts plan creates dedicated `supermarkets` and `tags` tables. Junction tables enforce referential integrity with those concept rows once editable-concepts lands. The tradeoff: reads need a JOIN or two extra queries; writes need inserts into the junction tables. At personal-app scale this is negligible.

**`share_token` on recipes**
Currently recipe sharing uses two KV keys (`share:{token}` and `share-recipe:{recipeId}`). Moving the token to a column on `recipes` simplifies the lookup to a single indexed query and makes recipe tokens durable across KV TTL issues.

**`recipe_blocks` instead of JSON**
Instructions are variable-length structured content. A separate table with `sort_order` makes insertion and deletion of individual lines straightforward without parsing JSON. Cascade delete handles cleanup.

**IDs**
New records use `crypto.randomUUID()`. Migrated records can keep their Notion UUIDs (which are already valid UUID format) to avoid breaking any KV share tokens that reference recipe IDs.

---

## What Changes in the Worker

### Files deleted after migration
- `worker/src/notion.ts` — entire Notion API client
- `worker/src/normalize.ts` — Notion → domain converters and denormalizers

### Files rewritten
- `worker/src/routes/items.ts` — Notion queries → D1 prepared statements; the `POST /items/:id/merge` endpoint must use `DB.batch([...])` to atomically re-point all `recipe_ingredients` rows from the merged item to the target item and then delete the duplicate
- `worker/src/routes/recipes.ts` — includes block children queries → `recipe_blocks` table; share token read/write moves from KV to `recipes.share_token` column
- `worker/src/routes/recipe-ingredients.ts` — N+1 item name fetch → single JOIN
- `worker/src/routes/todos.ts` — Notion queries → D1 prepared statements

### Biggest win: recipe ingredients

Currently, `GET /recipes/:id/ingredients` fires N Notion API calls (one per ingredient) to resolve item names:

```typescript
// Current: N+1 calls, 200-800ms each
const ingredients = await Promise.all(
  ingredientPages.map(async page => {
    const itemPage = await getPage(env.NOTION_TOKEN, itemId)  // ← one call per ingredient
    return normalizeRecipeIngredient(page, itemPage.name)
  }),
)
```

With D1, this becomes one JOIN:

```typescript
const rows = await env.DB.prepare(`
  SELECT ri.*, i.name AS item_name
  FROM recipe_ingredients ri
  JOIN items i ON i.id = ri.item_id
  WHERE ri.recipe_id = ?
  ORDER BY ri.sort_order
`).bind(recipeId).all()
```

### What stays in KV
- Google OAuth tokens (`google_tokens:{clerkUserId}`)
- Household shared calendar index (`household_shared_calendars`)
- User calendar settings (`user_calendars:{clerkUserId}`)
- OAuth state nonces (`oauth_state:{state}`, 10-minute TTL)

Note: KV-based auth sessions (login tokens, session management) were removed as part of the Clerk migration (`1f53b14`). Auth is now handled entirely by Clerk JWT — KV is no longer involved in authentication.

### What moves from KV to D1
- Recipe share tokens (→ `recipes.share_token` column)

### What stays in R2
- Recipe cover photos (R2 keys don't change)

---

## Migration Script

A one-time script at `worker/src/db/migrate-from-notion.ts`. Run locally via `wrangler d1 execute` or as a one-shot Worker endpoint behind an admin auth check.

### Strategy

The script uses the existing `notion.ts` functions (before deletion) to read all data, then generates and runs `INSERT` statements against D1. It runs per-household, so Household A is migrated first and Household B (if it exists in Notion) is migrated separately.

```typescript
// worker/src/db/migrate-from-notion.ts
// Run once: npx wrangler d1 execute casita --local (dry-run) then without --local

import { queryDatabase, getPage, getBlockChildren } from '../notion'
import { normalizeItem, normalizeRecipe, normalizeBlock, normalizeRecipeIngredient, normalizeTodo } from '../normalize'

const NOW = Date.now()

type HouseholdNotionConfig = {
  household_id: string
  shopping_list_db: string
  recipes_db: string
  recipe_ingredient_db: string
  todos_db: string
}

// Entry point: iterate over all households, migrate each independently
export async function runMigration(env: Env) {
  const households = await env.DB.prepare('SELECT id FROM households').all<{ id: string }>()
  for (const { id: householdId } of households.results) {
    const config = await env.DB.prepare(
      'SELECT * FROM household_notion_config WHERE household_id = ?'
    ).bind(householdId).first<HouseholdNotionConfig>()
    if (!config) {
      console.log(`No Notion config for household ${householdId}, skipping`)
      continue
    }
    console.log(`Migrating household ${householdId}...`)
    await migrateItems(env, householdId, config)
    await migrateRecipes(env, householdId, config)
    await migrateIngredients(env, householdId, config)
    await migrateTodos(env, householdId, config)
  }
  await migrateShareTokens(env)
  console.log('Migration complete')
}

async function migrateItems(env: Env, householdId: string, config: HouseholdNotionConfig) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.shopping_list_db)
  for (const page of pages) {
    const item = normalizeItem(page)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO items (id, household_id, name, category, on_shopping_list, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(item.id, householdId, item.name, item.category, item.onShoppingList ? 1 : 0, NOW, NOW).run()

    for (const s of item.supermarkets) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO item_supermarkets (item_id, supermarket) VALUES (?, ?)`
      ).bind(item.id, s).run()
    }
    for (const t of item.tags) {
      await env.DB.prepare(
        `INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)`
      ).bind(item.id, t).run()
    }
  }
  console.log(`  items: ${pages.length}`)
}

async function migrateRecipes(env: Env, householdId: string, config: HouseholdNotionConfig) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.recipes_db)
  for (const page of pages) {
    const recipe = normalizeRecipe(page)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO recipes (id, household_id, name, type, day, url, cover_photo_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(recipe.id, householdId, recipe.name, recipe.type, recipe.day, recipe.url, recipe.coverPhotoUrl, NOW, NOW).run()

    const blocks = await getBlockChildren(env.NOTION_TOKEN, recipe.id)
    for (let i = 0; i < blocks.length; i++) {
      const b = normalizeBlock(blocks[i])
      await env.DB.prepare(
        `INSERT OR IGNORE INTO recipe_blocks (id, recipe_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?)`
      ).bind(b.id, recipe.id, b.type, b.text, i).run()
    }
  }
  console.log(`  recipes: ${pages.length}`)
}

async function migrateIngredients(env: Env, householdId: string, config: HouseholdNotionConfig) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.recipe_ingredient_db)
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    const itemId = page.properties['Ingredient']?.type === 'relation'
      ? page.properties['Ingredient'].relation[0]?.id ?? ''
      : ''
    const itemPage = itemId ? await getPage(env.NOTION_TOKEN, itemId) : null
    const itemName = itemPage ? normalizeItem(itemPage).name : ''
    const ing = normalizeRecipeIngredient(page, itemName)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO recipe_ingredients (id, household_id, recipe_id, item_id, quantity, section, needs_shopping, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(ing.id, householdId, ing.recipeId, ing.itemId, ing.quantity, ing.section, ing.needsShopping ? 1 : 0, i).run()
  }
  console.log(`  recipe_ingredients: ${pages.length}`)
}

async function migrateTodos(env: Env, householdId: string, config: HouseholdNotionConfig) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.todos_db)
  for (const page of pages) {
    const todo = normalizeTodo(page)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO todos (id, household_id, name, status, priority, due, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(todo.id, householdId, todo.name, todo.status, todo.priority, todo.due, NOW, NOW).run()
  }
  console.log(`  todos: ${pages.length}`)
}

// Migrate KV share tokens (share-recipe:{recipeId} → token) to recipes.share_token
async function migrateShareTokens(env: Env) {
  const list = await env.AUTH_KV.list({ prefix: 'share-recipe:' })
  for (const key of list.keys) {
    const recipeId = key.name.replace('share-recipe:', '')
    const token = await env.AUTH_KV.get(key.name)
    if (!token) continue
    await env.DB.prepare(
      'UPDATE recipes SET share_token = ? WHERE id = ?'
    ).bind(token, recipeId).run()
  }
  console.log(`share tokens: ${list.keys.length}`)
}
```

Run order (per household, then once globally):
1. `migrateItems` — must run before ingredients (foreign key)
2. `migrateRecipes` — must run before ingredients + share tokens
3. `migrateIngredients` — depends on items + recipes
4. `migrateTodos` — independent
5. `migrateShareTokens` — after all recipes are inserted (updates `recipes.share_token`)

---

## Implementation Order

This migration should happen **after** auth-plan.md Waves 1–4 are complete, since the D1 database and `household_id` context are prerequisites.

### Step 1 — Schema

Create `worker/src/db/migrations/002_app_data.sql` with the tables above and run:
```bash
# Dry-run locally first
wrangler d1 execute casita --file worker/src/db/migrations/002_app_data.sql --local
# Then against production
wrangler d1 execute casita --file worker/src/db/migrations/002_app_data.sql
```

### Step 2 — Write D1 route handlers (alongside existing Notion routes)

New files: `worker/src/routes/items-d1.ts`, `recipes-d1.ts`, `recipe-ingredients-d1.ts`, `todos-d1.ts`. The existing Notion-backed routes stay untouched during this phase — no risk to production.

### Step 3 — Run migration script (against production D1)

```bash
# Against local D1 first for a dry-run
wrangler dev  # then hit the admin migration endpoint

# Then against production
wrangler d1 execute casita --command "SELECT count(*) FROM items"  # verify after
```

### Step 4 — Swap routes in `index.ts`

Change the route table to point to the D1 handlers. Deploy. Monitor for errors.

### Step 5 — Verify (30-day window)

Both users use the app normally. If anything is wrong, swap the route table back. Notion data is untouched.

### Step 6 — Delete Notion integration

- Remove `notion.ts`, `normalize.ts`
- Remove `NOTION_TOKEN` secret (`wrangler secret delete NOTION_TOKEN`)
- Remove `NOTION_*_DB` vars from `wrangler.toml`
- Remove `household_notion_config` table (or keep for reference)

---

## Verification

After step 4:

1. **Items**: Open shopping list → all items present with correct categories, supermarkets, shopping list status
2. **Recipes**: Browse recipe list → names, types, days, cover photos correct; open a recipe → instructions (blocks) display correctly
3. **Recipe ingredients**: Open a recipe's ingredient list → all ingredients present with quantities and sections; item names resolve correctly
4. **Todos**: Open todos → all todos with correct status, priority, due dates; sorting by due date works
5. **Create/edit/delete**: Perform a CRUD operation on each resource; confirm the change persists on refresh
6. **Recipe sharing**: Generate a share link for a recipe; open it in a private window → recipe and ingredients load (share token migrated to `recipes.share_token`)
7. **Household isolation**: Sign in as a different household's user → verify they see their own data only

---

## What We Gain

| Before | After |
|---|---|
| 200–800ms Notion API calls on every load | 1–5ms D1 queries |
| N+1 Notion calls for recipe ingredients | Single JOIN query |
| Notion workspace required per household | No external setup for new households |
| Notion rate limits (3 req/s) | D1: 25M row reads/day on free tier |
| Two denormalizer files to maintain | Domain types map directly to SQL columns |
| `normalize.ts` + `notion.ts` abstraction layers | Direct D1 prepared statements |
