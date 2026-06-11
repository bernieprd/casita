# Casita

Household management PWA — pnpm monorepo with `frontend/` (React + Vite) and `worker/` (Cloudflare Worker).

## Before every commit

- Run `pnpm typecheck` and fix any errors.
- If the change is user-facing, add an entry to the What's New / changelog component.

## Cross-cutting rules

- **Home screen** (`frontend/src/components/Home.tsx`) aggregates recipes, todos, shopping, and calendar. When you change data shapes or add features in any of those areas, verify Home still renders correctly.
- **Settings** (`frontend/src/components/Settings.tsx`, `frontend/src/components/settings/`) — when adding configuration, toggles, or integrations, update Settings to expose them.
- **API contract** — the worker returns typed responses consumed by TanStack Query hooks in `frontend/src/api/`. When changing an endpoint's request or response shape, update both sides and confirm the TypeScript types match.
- **Shopping ↔ Recipes** — recipes can generate shopping list items. Changes to ingredient data structures must be reflected in both `RecipeFormPage.tsx` and `Shopping.tsx` / `ShoppingList.tsx`.
- **Database migrations** — D1 schema changes in `worker/` need corresponding frontend type updates. Never assume old columns still exist.

## Code style

- TypeScript strict mode. No `any` unless absolutely unavoidable.
- Use shadcn/ui components from `frontend/src/components/ui/`. Don't add new UI libraries without discussing first.
- Tailwind v4 for styling. No inline style objects.
- Use React Query for server state. Don't store API data in React state or context.
