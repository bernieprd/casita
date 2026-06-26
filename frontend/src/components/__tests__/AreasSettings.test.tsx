// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { createTestQueryClient } from '@/test/query-wrapper'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { makeAreasConfig } from '@/test/fixtures/areasConfig'
import type { ReactNode } from 'react'
import '@/i18n/index'

vi.mock('@clerk/clerk-react', () => ({
  useUser: () => ({ user: { id: 'user-test' } }),
}))
vi.mock('../../context/AuthContext', () => ({
  useHousehold: () => ({ refreshHousehold: vi.fn(), householdId: 'hh-test', householdName: 'Test House' }),
}))

import AreasSettings from '../settings/AreasSettings'

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
})

function TestAreasSettings() {
  const [, setHeader] = useState<ReactNode | null>(null)
  return (
    <MemoryRouter>
      <AreasSettings setHeader={setHeader} />
    </MemoryRouter>
  )
}

function renderAreasSettings() {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TestAreasSettings />
    </QueryClientProvider>,
  )
}

// AreasSettings.tsx / tab-pin options — coverage marker for cross-area guard registry
describe('AreasSettings', () => {
  it('renders all 4 area toggles when all areas enabled (owner role)', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: makeAreasConfig(),
        }),
      ),
    )

    renderAreasSettings()

    await waitFor(() => {
      expect(screen.getByTestId('areas-settings-calendar-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('areas-settings-todos-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('areas-settings-shopping-toggle')).toBeInTheDocument()
      expect(screen.getByTestId('areas-settings-recipes-toggle')).toBeInTheDocument()
    })
  })

  it("disabled area's toggle renders in off state", async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: makeAreasConfig({ todos: { enabled: false } }),
        }),
      ),
    )

    renderAreasSettings()

    await waitFor(() => {
      const todosToggle = screen.getByTestId('areas-settings-todos-toggle')
      // shadcn Switch renders aria-checked="false" when unchecked
      expect(todosToggle).toHaveAttribute('aria-checked', 'false')
    })

    // Other toggles should still be on
    const calendarToggle = screen.getByTestId('areas-settings-calendar-toggle')
    expect(calendarToggle).toHaveAttribute('aria-checked', 'true')
  })

  it('tab-pin options are shown for enabled areas', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: makeAreasConfig(),
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

    renderAreasSettings()

    await waitFor(() => {
      expect(screen.getByTestId('areas-settings-tab-pin-calendar')).toBeInTheDocument()
      expect(screen.getByTestId('areas-settings-tab-pin-todos')).toBeInTheDocument()
      expect(screen.getByTestId('areas-settings-tab-pin-shopping')).toBeInTheDocument()
      expect(screen.getByTestId('areas-settings-tab-pin-recipes')).toBeInTheDocument()
    })
  })

  it('disabled area is not listed in tab-pin options', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: makeAreasConfig({ recipes: { enabled: false } }),
        }),
      ),
    )

    renderAreasSettings()

    await waitFor(() => {
      // Both must hold simultaneously — ensures areasConfig has loaded
      expect(screen.getByTestId('areas-settings-tab-pin-calendar')).toBeInTheDocument()
      expect(screen.queryByTestId('areas-settings-tab-pin-recipes')).not.toBeInTheDocument()
    })
  })

  it('pinned areas show switch in checked state', async () => {
    server.use(
      http.get(`${BASE}/household/me`, () =>
        HttpResponse.json({
          householdId: 'hh-test',
          householdName: 'Test House',
          role: 'owner',
          inviteCode: null,
          members: [],
          areasConfig: makeAreasConfig(),
        }),
      ),
      http.get(`${BASE}/me`, () =>
        HttpResponse.json({
          clerkUserId: 'user-test',
          email: 'test@test.com',
          locale: 'en',
          tabConfig: { pinned: ['calendar', 'todos', 'recipes'] },
        }),
      ),
    )

    renderAreasSettings()

    await waitFor(() => {
      expect(screen.getByTestId('areas-settings-tab-pin-calendar')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('areas-settings-tab-pin-todos')).toHaveAttribute('aria-checked', 'true')
      expect(screen.getByTestId('areas-settings-tab-pin-recipes')).toHaveAttribute('aria-checked', 'true')
      // shopping not pinned → unchecked
      expect(screen.getByTestId('areas-settings-tab-pin-shopping')).toHaveAttribute('aria-checked', 'false')
    })
  })
})
