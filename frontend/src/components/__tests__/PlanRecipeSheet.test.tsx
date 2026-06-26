// @vitest-environment jsdom
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { createTestQueryClient } from '@/test/query-wrapper'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { makeAreasConfig } from '@/test/fixtures/areasConfig'
import type { HouseholdAreasConfig } from '@/api/areas'
import type { ReactNode } from 'react'
import '@/i18n/index'
import Recipes from '../Recipes'

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

function withHouseholdConfig(areasConfig: HouseholdAreasConfig | null) {
  server.use(
    http.get(`${BASE}/household/me`, () =>
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

/** Renders RecipeDetail for the given recipe id via the Recipes router component.
 *  The toolbar slot captures what RecipeDetail passes to setToolbar and renders it
 *  in the DOM so data-testid attributes are queryable. */
function TestRecipeDetail({ recipeId }: { recipeId: string }) {
  const [toolbar, setToolbar] = useState<ReactNode | null>(null)
  return (
    <>
      <div data-testid="toolbar-slot">{toolbar}</div>
      <MemoryRouter initialEntries={[`/recipes/${recipeId}`]}>
        <Routes>
          <Route
            path="/recipes/:id"
            element={<Recipes setToolbar={setToolbar} />}
          />
        </Routes>
      </MemoryRouter>
    </>
  )
}

function renderRecipeDetail(recipeId: string) {
  const queryClient = createTestQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <TestRecipeDetail recipeId={recipeId} />
    </QueryClientProvider>,
  )
}

const RECIPE_FIXTURE = {
  id: 'r-1',
  name: 'Test Recipe',
  type: null,
  day: null,
  url: null,
  coverPhotoUrl: null,
  blocks: [],
  createdAt: 1,
  updatedAt: 1,
}

function withRecipeHandlers() {
  server.use(
    http.get(`${BASE}/recipes/r-1`, () => HttpResponse.json(RECIPE_FIXTURE)),
    http.get(`${BASE}/recipes/r-1/ingredients`, () => HttpResponse.json([])),
    http.get(`${BASE}/items`, () => HttpResponse.json([])),
  )
}

describe('PlanRecipeSheet area guard', () => {
  it('schedule-as-task-btn absent when todos area is disabled', async () => {
    withHouseholdConfig(makeAreasConfig({ todos: { enabled: false } }))
    withRecipeHandlers()

    renderRecipeDetail('r-1')

    // Wait for the recipe name to appear in the toolbar (means RecipeDetail loaded)
    await waitFor(() => {
      expect(screen.getByText('Test Recipe')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('schedule-as-task-btn')).not.toBeInTheDocument()
  })

  it('schedule-as-task-btn present when todos area is enabled', async () => {
    withHouseholdConfig(makeAreasConfig({ todos: { enabled: true } }))
    withRecipeHandlers()

    renderRecipeDetail('r-1')

    await waitFor(() => {
      expect(screen.getByTestId('schedule-as-task-btn')).toBeInTheDocument()
    })
  })
})
