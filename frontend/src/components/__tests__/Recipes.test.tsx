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

describe('Recipes shopping-toggle area guard', () => {
  it('shopping-toggle absent when shopping area is disabled', async () => {
    withHouseholdConfig(makeAreasConfig({ shopping: { enabled: false } }))

    server.use(
      http.get(`${BASE}/recipes/r-1`, () =>
        HttpResponse.json({
          id: 'r-1',
          name: 'Test Recipe',
          type: null,
          day: null,
          url: null,
          coverPhotoUrl: null,
          blocks: [],
          createdAt: 1,
          updatedAt: 1,
        }),
      ),
      http.get(`${BASE}/recipes/r-1/ingredients`, () =>
        HttpResponse.json([
          {
            id: 'ing-1',
            recipeId: 'r-1',
            itemId: 'item-1',
            itemName: 'Flour',
            quantity: '200g',
            section: null,
            needsShopping: false,
          },
        ]),
      ),
      http.get(`${BASE}/items`, () => HttpResponse.json([])),
    )

    renderRecipeDetail('r-1')

    // Wait for ingredient to appear (recipe loaded)
    await waitFor(() => {
      expect(screen.getByText('Flour')).toBeInTheDocument()
    })

    expect(screen.queryByTestId('shopping-toggle')).not.toBeInTheDocument()
  })

  it('shopping-toggle present when shopping area is enabled', async () => {
    withHouseholdConfig(makeAreasConfig({ shopping: { enabled: true } }))

    server.use(
      http.get(`${BASE}/recipes/r-1`, () =>
        HttpResponse.json({
          id: 'r-1',
          name: 'Test Recipe',
          type: null,
          day: null,
          url: null,
          coverPhotoUrl: null,
          blocks: [],
          createdAt: 1,
          updatedAt: 1,
        }),
      ),
      http.get(`${BASE}/recipes/r-1/ingredients`, () =>
        HttpResponse.json([
          {
            id: 'ing-1',
            recipeId: 'r-1',
            itemId: 'item-1',
            itemName: 'Flour',
            quantity: '200g',
            section: null,
            needsShopping: false,
          },
        ]),
      ),
      http.get(`${BASE}/items`, () => HttpResponse.json([])),
    )

    renderRecipeDetail('r-1')

    await waitFor(() => {
      expect(screen.getByTestId('shopping-toggle')).toBeInTheDocument()
    })
  })
})
