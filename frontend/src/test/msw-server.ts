import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const BASE = 'http://localhost:8787'

export const server = setupServer(
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
