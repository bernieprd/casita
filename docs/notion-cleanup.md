# Notion Integration Cleanup

D1 migration is complete. These items remain before Notion can be fully removed:

## Worker

- [ ] Delete `worker/src/notion.ts`
- [ ] Delete `worker/src/normalize.ts`
- [ ] Remove any remaining references to `household_notion_config` (table can stay as a dead archive or be dropped via a migration)

## Cloudflare Secrets & Config

- [ ] `wrangler secret delete NOTION_TOKEN`
- [ ] Remove `NOTION_TOKEN` from any `wrangler.toml` / `wrangler.jsonc` entries

## Optional DB Cleanup

- [ ] Add `worker/src/db/migrations/003_drop_notion_config.sql` to drop the `household_notion_config` table if no longer needed as an archive
