// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '@/test/query-wrapper'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/test/msw-server'
import { makeAreasConfig } from '@/test/fixtures/areasConfig'
import type { HouseholdAreasConfig } from '@/api/areas'
import '@/i18n/index'
import Home from '../Home'

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
})

function renderHome() {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

const BASE_URL = 'http://localhost:8787'

function withAreasConfig(areasConfig: HouseholdAreasConfig | null) {
  server.use(
    http.get(`${BASE_URL}/household/me`, () =>
      HttpResponse.json({
        householdId: 'hh-test',
        householdName: 'Test House',
        role: 'owner',
        inviteCode: null,
        members: [],
        areasConfig,
      }),
    ),
  )
}

describe('area guards', () => {
  it("'todos' disabled → TodoSection absent", async () => {
    withAreasConfig(makeAreasConfig({ todos: { enabled: false } }))
    renderHome()
    await waitFor(() => {
      expect(screen.queryByText('To-Dos')).not.toBeInTheDocument()
    })
  })

  it("'todos' enabled → TodoSection present", async () => {
    withAreasConfig(makeAreasConfig())
    renderHome()
    expect(await screen.findByText('To-Dos')).toBeInTheDocument()
  })

  it("'shopping' disabled → ShoppingSection absent", async () => {
    withAreasConfig(makeAreasConfig({ shopping: { enabled: false } }))
    renderHome()
    await waitFor(() => {
      expect(screen.queryByText('Shopping list')).not.toBeInTheDocument()
    })
  })

  it("'calendar' disabled → CalendarSection absent", async () => {
    withAreasConfig(makeAreasConfig({ calendar: { enabled: false } }))
    renderHome()
    await waitFor(() => {
      expect(screen.queryByText('Coming up')).not.toBeInTheDocument()
    })
  })

  it("'recipes' disabled → RecipesSection absent", async () => {
    withAreasConfig(makeAreasConfig({ recipes: { enabled: false } }))
    renderHome()
    await waitFor(() => {
      expect(screen.queryByText('Cook this week')).not.toBeInTheDocument()
    })
  })
})

describe('Home smoke test', () => {
  it('renders loading skeletons while all queries are in-flight', () => {
    server.use(
      http.get(`${BASE}/items`, async () => { await delay('infinite') }),
      http.get(`${BASE}/recipes`, async () => { await delay('infinite') }),
      http.get(`${BASE}/todos`, async () => { await delay('infinite') }),
      http.get(`${BASE}/calendar`, async () => { await delay('infinite') }),
      http.get(`${BASE}/auth/google/status`, async () => { await delay('infinite') }),
      http.get(`${BASE}/household/me`, async () => { await delay('infinite') }),
      http.get(`${BASE}/concepts/todo-categories`, async () => { await delay('infinite') }),
    )
    renderHome()
    expect(document.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0)
  })

  it('renders empty-state text when all queries return no data', async () => {
    renderHome()
    expect(await screen.findByText('All caught up')).toBeInTheDocument()
    expect(await screen.findByText('Nothing on the list')).toBeInTheDocument()
    expect(await screen.findByText('No recipes yet')).toBeInTheDocument()
  })

  it('renders items from all sections when queries return populated data', async () => {
    server.use(
      http.get(`${BASE}/items`, () =>
        HttpResponse.json([
          { id: 'item-1', name: 'Milk', category: null, supermarkets: [], onShoppingList: true },
        ]),
      ),
      http.get(`${BASE}/recipes`, () =>
        HttpResponse.json([
          { id: 'r-1', name: 'Pasta Bolognese', type: null, day: null, url: null, coverPhotoUrl: null, createdAt: 1, updatedAt: 1 },
        ]),
      ),
      http.get(`${BASE}/todos`, () =>
        HttpResponse.json([
          { id: 't-1', name: 'Buy groceries', status: 'Todo', priority: null, due: null, categoryId: null, assignedTo: null, url: null, notes: null, frequency: null, frequencyInterval: null, frequencyDays: null, sortOrder: 0 },
        ]),
      ),
      http.get(`${BASE}/calendar`, () =>
        HttpResponse.json([
          { id: 'ev-1', title: 'Team meeting', start: '2030-01-01T10:00:00Z', end: '2030-01-01T11:00:00Z', allDay: false, color: null },
        ]),
      ),
      http.get(`${BASE}/auth/google/status`, () =>
        HttpResponse.json({ connected: true }),
      ),
    )
    renderHome()
    expect(await screen.findByText('Milk')).toBeInTheDocument()
    expect(await screen.findByText('Buy groceries')).toBeInTheDocument()
    expect(await screen.findByText('Pasta Bolognese')).toBeInTheDocument()
    expect(await screen.findByText('Team meeting')).toBeInTheDocument()
  })
})
