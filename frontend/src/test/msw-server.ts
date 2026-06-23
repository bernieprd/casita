import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const BASE = 'http://localhost:8787'

export const server = setupServer(
  // ── Default read handlers (return empty data) ─────────────────────────────
  // MSW ignores query params, so http.get('/items') covers /items?shopping=true too.
  http.get(`${BASE}/items`, () => HttpResponse.json([])),
  http.get(`${BASE}/recipes`, () => HttpResponse.json([])),
  http.get(`${BASE}/todos`, () => HttpResponse.json([])),
  http.get(`${BASE}/calendar`, () => HttpResponse.json([])),
  http.get(`${BASE}/auth/google/status`, () => HttpResponse.json({ connected: false })),
  http.get(`${BASE}/household/me`, () =>
    HttpResponse.json({
      householdId: 'hh-test',
      householdName: 'Test House',
      role: 'owner',
      inviteCode: null,
      members: [],
    }),
  ),
  http.get(`${BASE}/concepts/todo-categories`, () => HttpResponse.json([])),

  // ── Default mutation handlers ─────────────────────────────────────────────
  http.patch(`${BASE}/items/:id`, () =>
    HttpResponse.json({
      id: 'item-1',
      name: 'Milk',
      category: null,
      supermarkets: [],
      onShoppingList: true,
    }),
  ),
  http.patch(`${BASE}/recipe-ingredients/:id`, () =>
    HttpResponse.json({
      id: 'ing-1',
      recipeId: 'recipe-1',
      itemId: 'item-1',
      itemName: 'Milk',
      quantity: null,
      section: null,
      needsShopping: true,
    }),
  ),
)
