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

import HouseholdSettings from '../settings/HouseholdSettings'

const BASE = 'http://localhost:8787'

const STUB_THEME_PREFS = {
  colorScheme: 'system' as const,
  primaryHsl: '0 0% 0%',
  headingFont: 'sans',
  bodyFont: 'sans',
  radius: '0.5rem',
}

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

function TestHouseholdSettings() {
  const [, setHeader] = useState<ReactNode | null>(null)
  return (
    <MemoryRouter>
      <HouseholdSettings
        themePrefs={STUB_THEME_PREFS}
        setThemePrefs={() => {}}
        themeSaving={false}
        setHeader={setHeader}
      />
    </MemoryRouter>
  )
}

function renderAreasSettings() {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TestHouseholdSettings />
    </QueryClientProvider>,
  )
}

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
})
