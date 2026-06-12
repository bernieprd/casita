# Casita

A household management app for organizing recipes, shopping lists, todos, and shared calendars — built as an installable PWA.

**Live at [mycasita.app](https://mycasita.app) / [dashboard.mycasita.app](https://dashboard.mycasita.app)**

## Features

- **Recipes** — Create and edit recipes with ingredients, markdown instructions, and photo uploads. Share recipes via public links. Plan recipes into your calendar or todo list.
- **Shopping Lists** — Manage shopping items by category and supermarket. Merge duplicates, track incomplete items across trips.
- **Todos** — Simple task management for the household.
- **Calendar** — Shared household calendar with Google Calendar integration.
- **Household** — Invite members to your household. Shared data across all members.
- **Themes** — Customizable color themes with light/dark mode.
- **PWA** — Installable on mobile and desktop with offline support.

## Architecture

Casita is a **pnpm monorepo** with two packages:

```
frontend/   → React SPA (Vite + TypeScript)
worker/     → Cloudflare Worker API (TypeScript)
```

### Frontend

React 18, TypeScript, Vite, Tailwind CSS v4, shadcn/ui (Radix), React Router, TanStack React Query, vite-plugin-pwa.

### Backend

Cloudflare Worker with:
- **D1** (SQLite) — primary database
- **KV** — auth token caching, shared calendar index
- **R2** — recipe photo storage

### Auth

[Clerk](https://clerk.com) for authentication — `@clerk/clerk-react` on the frontend, `@clerk/backend` with local JWT verification on the worker.

## Prerequisites

- Node.js ≥ 22
- pnpm ≥ 9
- A [Cloudflare](https://cloudflare.com) account (for Worker, D1, KV, R2)
- A [Clerk](https://clerk.com) application

## Getting Started

```bash
# Install dependencies
pnpm install

# Run both frontend and worker in development
pnpm dev

# Or run them individually
pnpm dev:frontend   # Vite dev server
pnpm dev:worker     # Wrangler dev server on port 8787
```

## Scripts

| Command | Description |
|---|---|
| `pnpm dev` | Start frontend + worker in parallel |
| `pnpm build` | Build both packages |
| `pnpm deploy` | Deploy frontend (Cloudflare Pages) + worker |
| `pnpm typecheck` | Run TypeScript checks across the monorepo |
| `pnpm check` | Typecheck + build frontend |

## Deployment

- **Frontend** → Cloudflare Pages (via `wrangler pages deploy`)
- **Worker** → Cloudflare Workers (via `wrangler deploy`)
- **CI** → GitHub Actions (`deploy.yml`) triggers on push to `main`

Worker secrets (e.g. `NOTION_TOKEN`) are set via `wrangler secret put`.

## License

Private project.
