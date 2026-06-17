# Notion Integration Cleanup

## ✅ Code changes — done (PR #47)

All source files deleted, types cleaned up, migration file created. Two manual steps remain:

### 1. Apply the DB migration to remote D1

```bash
cd worker && wrangler d1 execute casita --remote --file=src/db/migrations/010_drop_notion_config.sql
```

### 2. Delete the Cloudflare secret

```bash
wrangler secret delete NOTION_TOKEN
```

Also remove any `NOTION_TOKEN` line from `wrangler.toml` / `wrangler.jsonc` if present.

### 3. Smoke test

Deploy to staging and confirm recipe CRUD, todos, and shopping all work.

---

## Original plan (for reference)

**Context:** Production runs entirely on D1. The Notion-backed route files are orphaned. The only Notion references remaining in `index.ts` are the migration endpoint and `NotionError`.

## Files to delete

```
worker/src/notion.ts
worker/src/normalize.ts
worker/src/routes/recipes.ts            (Notion-backed — NOT recipes-d1.ts)
worker/src/routes/recipe-ingredients.ts (Notion-backed — NOT recipe-ingredients-d1.ts)
worker/src/routes/items.ts              (Notion-backed — NOT items-d1.ts)
worker/src/routes/todos.ts              (Notion-backed — NOT todos-d1.ts)
worker/src/db/migrate-from-notion.ts
```

## Changes to worker/src/index.ts

- Remove import of `runMigration*` from `./db/migrate-from-notion`
- Remove import of `NotionError` from `./notion`
- Remove the `/admin/migrate` route block
- Remove the `NotionError` catch block in the error handler

## Changes to worker/src/routes/household.ts

- Remove `getNotionConfig` function and any reference to `household_notion_config` — only used in legacy migration paths.

## Optional DB migration

Add `worker/src/db/migrations/003_drop_notion_config.sql`:
```sql
DROP TABLE IF EXISTS household_notion_config;
```

## Cloudflare Secrets & Config

- [ ] `wrangler secret delete NOTION_TOKEN`
- [ ] Remove `NOTION_TOKEN` from any `wrangler.toml` / `wrangler.jsonc` entries

## Verification

Run `npx tsc --noEmit` in `/worker` — zero errors. Deploy to staging and confirm recipe CRUD, todos, and shopping all work.
