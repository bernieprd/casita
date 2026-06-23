// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '@/test/query-wrapper'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import '@/i18n/index'

// Mock Clerk
vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { id: 'user-test' }, isSignedIn: true, isLoaded: true }),
  SignIn: () => null,
  SignUp: () => null,
  SignedIn: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

// Mock AuthContext
vi.mock('../../context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useAuth: () => ({ user: { id: 'user-test' } }),
  useHousehold: () => ({
    householdId: 'hh-test',
    householdName: 'Test House',
    isLoading: false,
    fetchError: null,
    refreshHousehold: vi.fn(),
  }),
}))

// Mock PWA register
vi.mock('virtual:pwa-register/react', () => ({
  useRegisterSW: () => ({ updateServiceWorker: vi.fn() }),
}))

// Mock lazy-loaded components to avoid Suspense flicker in tests
vi.mock('../Home', () => ({ default: () => <div data-testid="home-content">Home</div> }))
vi.mock('../Calendar', () => ({ default: () => <div>Calendar</div> }))
vi.mock('../Todos', () => ({ default: () => <div>Todos</div> }))
vi.mock('../Shopping', () => ({ default: () => <div>Shopping</div> }))
vi.mock('../Recipes', () => ({ default: () => <div>Recipes</div> }))
vi.mock('../settings/SettingsLayout', () => ({ default: () => <div>Settings</div> }))
vi.mock('../HouseholdSetup', () => ({ default: () => <div>Setup</div> }))
vi.mock('../ThemePreview', () => ({ default: () => <div>ThemePreview</div> }))
vi.mock('../OnboardingFlow', () => ({ default: () => null }))
vi.mock('../InstallBanner', () => ({ default: () => null }))
vi.mock('../PublicRecipeView', () => ({ default: () => null }))
vi.mock('../TabErrorBoundary', () => ({
  TabErrorBoundary: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

import App from '../../App'

const BASE = 'http://localhost:8787'

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
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn() },
  })
})

function renderApp(initialPath = '/') {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialPath]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('App.tsx / computed tab array', () => {
  it('disabled area cannot appear in computed tab array', async () => {
    // recipes disabled at household level, but user has recipes pinned
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: { recipes: { enabled: false } },
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@example.com',
          locale: 'en',
          tabConfig: { pinned: ['calendar', 'todos', 'recipes'] },
        }),
      ),
    )

    renderApp('/')

    await waitFor(() => {
      // home tab always present
      expect(screen.getByTestId('nav-tab-home')).toBeInTheDocument()
    })

    // recipes is disabled → must not appear in the nav even though user pinned it
    expect(screen.queryByTestId('nav-tab-recipes')).not.toBeInTheDocument()
    // calendar and todos should be present (they are enabled and pinned)
    expect(screen.getByTestId('nav-tab-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('nav-tab-todos')).toBeInTheDocument()
  })

  it('default tabs shown when tabConfig is null', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: null,
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@example.com',
          locale: 'en',
          tabConfig: null,
        }),
      ),
    )

    renderApp('/')

    await waitFor(() => {
      expect(screen.getByTestId('nav-tab-home')).toBeInTheDocument()
    })

    // Default pinned: calendar, todos, shopping
    expect(screen.getByTestId('nav-tab-calendar')).toBeInTheDocument()
    expect(screen.getByTestId('nav-tab-todos')).toBeInTheDocument()
    expect(screen.getByTestId('nav-tab-shopping')).toBeInTheDocument()
    // recipes not in default pinned
    expect(screen.queryByTestId('nav-tab-recipes')).not.toBeInTheDocument()
  })
})
