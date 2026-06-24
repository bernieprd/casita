// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { createTestQueryClient } from '@/test/query-wrapper'
import { makeAreasConfig } from '@/test/fixtures/areasConfig'
import '@/i18n/index'

const BASE = 'http://localhost:8787'

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ isSignedIn: true, isLoaded: true, user: { id: 'user-test' } }),
  SignedIn: ({ children }: { children: React.ReactNode }) => children,
  SignIn: () => null,
  SignUp: () => null,
}))

vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { id: 'user-test' } }),
  useHousehold: () => ({
    householdId: 'hh-test',
    householdName: 'Test House',
    isLoading: false,
    fetchError: null,
    refreshHousehold: vi.fn(),
  }),
}))

beforeAll(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
})

// Lazy import after mocks are in place
async function importApp() {
  const { default: App } = await import('../../App')
  return App
}

function renderApp(App: React.ComponentType) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

function renderAppAt(App: React.ComponentType, path: string) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

// App.tsx / computed tab array — coverage marker for cross-area guard registry
describe('App.tsx / computed tab array', () => {
  it('disabled area cannot appear in computed tab array', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          // recipes disabled
          areasConfig: makeAreasConfig({ recipes: { enabled: false } }),
        }),
      ),
      // user has recipes pinned — but it's disabled, so it must be excluded
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@test.com',
          locale: 'en',
          tabConfig: { pinned: ['calendar', 'todos', 'recipes'] },
        }),
      ),
    )

    const App = await importApp()
    renderApp(App)

    await waitFor(() => {
      expect(screen.queryByTestId('nav-tab-recipes')).not.toBeInTheDocument()
    })
    // non-disabled pinned tabs should still appear
    expect(screen.getByTestId('nav-tab-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('nav-tab-todos')).toBeInTheDocument()
  })
})

// Menu.tsx / area cards — coverage marker for cross-area guard registry
describe('Phase 3 nav invariants', () => {
  it('Menu tab is always last', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'member',
          inviteCode: null,
          members: [],
          areasConfig: null,
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@test.com',
          locale: 'en',
          tabConfig: { pinned: ['calendar', 'todos', 'shopping'] },
        }),
      ),
    )

    const App = await importApp()
    renderApp(App)

    await waitFor(() => expect(screen.getByTestId('nav-tab-menu')).toBeInTheDocument())

    const navButtons = screen.getAllByTestId(/^nav-tab-/)
    expect(navButtons[navButtons.length - 1]).toHaveAttribute('data-testid', 'nav-tab-menu')
  })

  it('tab array never exceeds 5 items', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'member',
          inviteCode: null,
          members: [],
          areasConfig: null,
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@test.com',
          locale: 'en',
          tabConfig: { pinned: ['calendar', 'todos', 'shopping'] },
        }),
      ),
    )

    const App = await importApp()
    renderApp(App)

    await waitFor(() => expect(screen.getByTestId('nav-tab-menu')).toBeInTheDocument())

    // home + 3 pinned + menu = 5
    const navButtons = screen.getAllByTestId(/^nav-tab-/)
    expect(navButtons.length).toBeLessThanOrEqual(5)
  })

  it('Recipes accessible via Menu when not pinned', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'member',
          inviteCode: null,
          members: [],
          areasConfig: null,
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@test.com',
          locale: 'en',
          tabConfig: { pinned: ['calendar', 'todos', 'shopping'] },
        }),
      ),
    )

    const App = await importApp()
    renderAppAt(App, '/menu')

    await waitFor(() =>
      expect(screen.getByTestId('menu-area-card-recipes')).toBeInTheDocument(),
    )
  })

  it('gear icon absent from Home header', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'member',
          inviteCode: null,
          members: [],
          areasConfig: null,
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@test.com',
          locale: 'en',
          tabConfig: null,
        }),
      ),
    )

    const App = await importApp()
    renderApp(App)

    await waitFor(() => expect(screen.getByTestId('nav-tab-home')).toBeInTheDocument())

    const header = document.querySelector('header')
    expect(header?.querySelector('button')).toBeNull()
  })
})
