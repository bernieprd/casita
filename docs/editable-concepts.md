# Plan: Editable Concepts in Casita PWA

## Context

Several "concept" enums in Casita are hardcoded in frontend components and cannot be changed without a code deploy. The goal is to make these editable at runtime from within the PWA itself, and to evaluate whether Notion is still the right data store for this — or whether a free relational database would serve better.

**Concepts that need to be editable:**

| Concept | Currently | Problem |
|---------|-----------|---------|
| Recipe Type | Hardcoded array in `RecipeFormPage.tsx:54` | Can't add/remove types without deploy |
| Todo Status | Hardcoded array in `Todos.tsx:25` | Same |
| Todo Priority | Hardcoded array in `Todos.tsx:35` | Same |
| Item Category | Derived from Notion items via autocomplete | No dedicated CRUD, orphaned on item delete |
| Supermarkets | Derived from Notion items via autocomplete | Same |
| Item Tags | Stored in Notion multi_select but unused in UI | No management UI at all |

---

## Option A: Keep Notion — store concepts as Notion Select/MultiSelect options

Notion already stores select/multi_select options alongside the DB schema. We could add a `/concepts` API endpoint that reads Notion's DB property schema (not the pages/rows) to expose available options, and writes new options back.

**Pros:** No migration, no new infra, concepts are already there implicitly.  
**Cons:** Notion's API does not allow adding select options programmatically — only indirectly by creating a page with a new value. Deleting options is not possible via API. Notion free plan has a 1000-block limit and no guaranteed SLA. Hardcoded frontend values would still need to change to API-driven.

**Verdict:** Viable for reading, limited for writes. Not recommended long-term.

---

## Option B: Migrate data to Cloudflare D1 (recommended)

D1 is Cloudflare's managed SQLite, already on the same Workers infrastructure. Free tier: 5GB storage, 25M row reads/day, 50k writes/day — far beyond personal use needs.

**Pros:**
- Same deploy infra (wrangler), no new accounts
- Full SQL: proper CRUD for concept tables, joins, foreign keys
- No 1000-block limit, proper schema, transactions
- Free, no credit card required for personal scale
- Can drop Notion entirely, reducing complexity and API cost

**Cons:**
- Migration effort: one-time data export from Notion → D1
- Slightly more complex schema design vs. Notion's schemaless approach
- Loses Notion's nice UI for manual data entry (but the PWA replaces this)

**Verdict: Recommended path.** Cloudflare D1 is the natural next step given the existing Worker infra.

---

## Implementation Plan

### Phase 1: D1 schema and migration

**New D1 database** (add to `wrangler.toml`):
```toml
[[d1_databases]]
name = "CASITA_DB"
database_name = "casita"
database_id = "..."
```

**Schema tables to create (`worker/src/db/schema.sql`):**
```sql
-- Concept tables
CREATE TABLE recipe_types (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort_order INTEGER);
CREATE TABLE todo_statuses (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort_order INTEGER);
CREATE TABLE todo_priorities (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, sort_order INTEGER);
CREATE TABLE supermarkets (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE categories (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
CREATE TABLE tags (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);

-- Seed data mirrors current hardcoded values
INSERT INTO recipe_types VALUES ('1','Favourite',1),('2','Try again',2),('3','New',3);
INSERT INTO todo_statuses VALUES ('1','Todo',1),('2','In progress',2),('3','On hold',3),('4','Done',4);
INSERT INTO todo_priorities VALUES ('1','Low',1),('2','Medium',2),('3','High',3);
```

Data tables (items, recipes, todos, recipe_ingredients) mirror the current Notion structure. One-time migration script reads from Notion API and inserts into D1.

### Phase 2: Worker API — concepts endpoints

New file: `worker/src/routes/concepts.ts`

```
GET  /concepts/recipe-types     → list
POST /concepts/recipe-types     → create
PATCH /concepts/recipe-types/:id → rename / reorder
DELETE /concepts/recipe-types/:id → delete (guard: check no recipes use it)

-- Same pattern for: todo-statuses, todo-priorities, supermarkets, categories, tags
```

Generic handler since all concepts share the same shape (id, name, sort_order).

### Phase 3: Frontend — Settings page

New route `/settings` (hash-based, so `#/settings`) accessible from the app drawer/nav.

New component: `frontend/src/components/SettingsPage.tsx`

Layout: List of concept sections, each with inline add/rename/delete chips.

```
┌─────────────────────────────┐
│  Settings                   │
├─────────────────────────────┤
│  Recipe Types               │
│  [Favourite ×] [Try again ×]│
│  [New ×]  [+ Add]           │
├─────────────────────────────┤
│  Supermarkets               │
│  [Lidl ×] [Mercadona ×]    │
│  [+ Add]                    │
├─────────────────────────────┤
│  Categories                 │
│  [Dairy ×] [Vegetables ×]  │
│  [+ Add]                    │
│  ...                        │
└─────────────────────────────┘
```

**New API hooks** in `frontend/src/api/concepts.ts` using React Query:
- `useConceptList(type)` — fetches from `/concepts/:type`
- `useConceptMutations(type)` — create/rename/delete mutations with optimistic updates

**Replace hardcoded arrays** in:
- `RecipeFormPage.tsx:54` → query `recipe-types`
- `Todos.tsx:25` → query `todo-statuses`
- `Todos.tsx:35` → query `todo-priorities`

Categories and supermarkets in `ItemFormDialog.tsx` already use autocomplete; swap the derived-from-items approach for the dedicated concept endpoint.

### Phase 4: Delete guards

Before deleting a concept, the worker checks if any rows reference it:
- Deleting a `recipe_type` → check `recipes` table
- Deleting a `category` → check `items` table
- etc.

Return a `409 Conflict` with a count ("3 items use this category") so the frontend can show a useful error.

---

## File Change Summary

| File | Change |
|------|--------|
| `worker/wrangler.toml` | Add D1 binding |
| `worker/src/db/schema.sql` | New — D1 schema + seeds |
| `worker/src/db/migrate.ts` | New — one-time Notion→D1 migration script |
| `worker/src/routes/concepts.ts` | New — CRUD for all concept types |
| `worker/src/index.ts` | Register `/concepts/*` routes |
| `worker/src/types.ts` | Add `ConceptItem` type |
| `frontend/src/api/concepts.ts` | New — React Query hooks for concepts |
| `frontend/src/components/SettingsPage.tsx` | New — Settings admin page |
| `frontend/src/components/RecipeFormPage.tsx` | Replace hardcoded arrays with hook |
| `frontend/src/components/Todos.tsx` | Replace hardcoded arrays with hook |
| `frontend/src/components/ItemFormDialog.tsx` | Swap autocomplete source to concepts API |
| `frontend/src/App.tsx` | Add `/settings` route |

---

## Verification

1. Run `wrangler d1 execute casita --file schema.sql` to apply schema
2. Run migration script: `npx ts-node worker/src/db/migrate.ts`
3. Start dev: `pnpm dev` (frontend) + `wrangler dev` (worker)
4. Navigate to `#/settings` — verify all concept sections load
5. Add a new recipe type, confirm it appears in the RecipeFormPage dropdown
6. Delete a concept used by existing data — verify 409 error message appears
7. Verify existing item form autocomplete still works with concept-backed data
