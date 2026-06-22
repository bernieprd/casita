# Testing

Casita uses a three-layer test strategy.

## Layers

| Layer | Where | What it catches |
|---|---|---|
| Unit | `frontend/src/lib/__tests__/` | Pure logic (formatters, helpers) |
| Hook integration | `frontend/src/api/__tests__/` | React Query cache mutations, optimistic updates, rollbacks |
| Worker (D1) | `worker/src/routes/__tests__/` | SQL correctness, auth guards, DB side-effects |

A fourth layer — **page smoke tests** (`frontend/src/components/__tests__/`) — covers full component trees to catch query-shape regressions before they reach production.

## Running tests

```bash
# All tests (frontend + worker)
pnpm test

# Frontend only
pnpm --filter frontend test

# Frontend watch mode
pnpm --filter frontend test:watch

# Worker only
pnpm --filter worker test
```

## Key fixtures

| File | Purpose |
|---|---|
| `frontend/src/test/msw-server.ts` | Default MSW handlers (all reads return empty; mutations return stubs) |
| `frontend/src/test/setup.ts` | Starts/resets/stops the MSW server around every test |
| `frontend/src/test/query-wrapper.tsx` | `createTestQueryClient()` + `createWrapper()` for hook tests |
| `worker/src/test/fixtures.ts` | `applySchema`, `cleanDb`, seed helpers, `makeEnv()`, `makeCtx()` |

## Adding tests

**Unit test**: create a file in `frontend/src/lib/__tests__/`. No environment override needed (runs in `node`).

**Hook integration test**: file in `frontend/src/api/__tests__/`, add `// @vitest-environment jsdom` at the top. Use `createTestQueryClient()` and override MSW handlers with `server.use(...)` for the specific scenario.

**Worker test**: file in `worker/src/routes/__tests__/`. Call `applySchema` in `beforeAll` and `cleanDb` + `seedHousehold` in `beforeEach`. Import route handlers directly and call them with `makeRequest` / `makeEnv` / `makeCtx`.

**Page smoke test**: file in `frontend/src/components/__tests__/`, add `// @vitest-environment jsdom`. Wrap the component in `QueryClientProvider` + `MemoryRouter` (see pattern below).

## Page smoke test pattern

`Home.test.tsx` is the reference. The wrapper pattern:

```tsx
function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false },
    },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}
```

Mock `window.matchMedia` in `beforeAll` (required for components that check viewport width). Import `@/i18n/index` at the top of the file to initialise translations.

Three test cases cover every page:
1. **Loading** — override all handlers with `delay('infinite')`, assert `[data-slot="skeleton"]` elements are present.
2. **Empty** — default handlers (all return `[]`), `await screen.findByText(...)` for empty-state strings.
3. **Full data** — override handlers with fixture data, assert key text from each section is visible.
