// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { createTestQueryClient, createWrapper } from '@/test/query-wrapper'
import { useToggleNeedsShopping } from '../recipe-ingredients'
import { recipeKeys } from '../recipes'
import { itemKeys } from '../items'
import type { Item, RecipeIngredient } from '../types'

const RECIPE_ID = 'recipe-1'

const INGREDIENT_OFF: RecipeIngredient = {
  id: 'ing-1', recipeId: RECIPE_ID, itemId: 'item-1',
  itemName: 'Milk', quantity: '1L', section: null, needsShopping: false,
}
const INGREDIENT_ON: RecipeIngredient = { ...INGREDIENT_OFF, needsShopping: true }

const ITEM_OFF: Item = { id: 'item-1', name: 'Milk', category: null, supermarkets: [], onShoppingList: false }
const ITEM_ON:  Item = { ...ITEM_OFF, onShoppingList: true }

function setup(initialNeedsShopping = false) {
  const queryClient = createTestQueryClient()
  const ingredient = initialNeedsShopping ? INGREDIENT_ON : INGREDIENT_OFF
  const item       = initialNeedsShopping ? ITEM_ON : ITEM_OFF
  queryClient.setQueryData<RecipeIngredient[]>(recipeKeys.ingredients(RECIPE_ID), [ingredient])
  queryClient.setQueryData<Item[]>(itemKeys.all, [item])
  queryClient.setQueryData<Item[]>(itemKeys.shopping, initialNeedsShopping ? [item] : [])
  const wrapper = createWrapper(queryClient)
  const { result } = renderHook(() => useToggleNeedsShopping(RECIPE_ID), { wrapper })
  return { queryClient, result }
}

describe('useToggleNeedsShopping', () => {
  describe('toggle ON', () => {
    it('optimistically flips the ingredient needsShopping flag', async () => {
      const { queryClient, result } = setup(false)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => {
        const ings = queryClient.getQueryData<RecipeIngredient[]>(recipeKeys.ingredients(RECIPE_ID))
        expect(ings).toContainEqual(expect.objectContaining({ id: 'ing-1', needsShopping: true }))
      })
    })

    it('updates itemKeys.all onShoppingList flag', async () => {
      const { queryClient, result } = setup(false)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => {
        const all = queryClient.getQueryData<Item[]>(itemKeys.all)
        expect(all).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: true }))
      })
    })

    it('adds the item to itemKeys.shopping', async () => {
      const { queryClient, result } = setup(false)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => {
        const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
        expect(shopping).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: true }))
      })
    })

    it('does not duplicate an item already in itemKeys.shopping', async () => {
      const { queryClient, result } = setup(true)
      server.use(
        http.patch('http://localhost:8787/recipe-ingredients/:id', () =>
          HttpResponse.json({ ...INGREDIENT_ON }),
        ),
      )
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
      expect(shopping?.filter(i => i.id === 'item-1')).toHaveLength(1)
    })
  })

  describe('toggle OFF', () => {
    it('removes the item from itemKeys.shopping', async () => {
      const { queryClient, result } = setup(true)
      server.use(
        http.patch('http://localhost:8787/recipe-ingredients/:id', () =>
          HttpResponse.json({ ...INGREDIENT_OFF }),
        ),
      )
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: false, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => {
        const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
        expect(shopping).not.toContainEqual(expect.objectContaining({ id: 'item-1' }))
      })
    })

    it('updates itemKeys.all to onShoppingList: false', async () => {
      const { queryClient, result } = setup(true)
      server.use(
        http.patch('http://localhost:8787/recipe-ingredients/:id', () =>
          HttpResponse.json({ ...INGREDIENT_OFF }),
        ),
      )
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: false, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => {
        const all = queryClient.getQueryData<Item[]>(itemKeys.all)
        expect(all).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: false }))
      })
    })
  })

  describe('missing itemId guard', () => {
    it('does not touch itemKeys.all or itemKeys.shopping when itemId is absent', async () => {
      const { queryClient, result } = setup(false)
      const initialAll      = queryClient.getQueryData<Item[]>(itemKeys.all)
      const initialShopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true })
      })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(queryClient.getQueryData<Item[]>(itemKeys.all)).toEqual(initialAll)
      expect(queryClient.getQueryData<Item[]>(itemKeys.shopping)).toEqual(initialShopping)
    })
  })

  describe('error rollback', () => {
    beforeEach(() => {
      server.use(
        http.patch('http://localhost:8787/recipe-ingredients/:id', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 }),
        ),
      )
    })

    it('restores the ingredient cache on failure', async () => {
      const { queryClient, result } = setup(false)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => expect(result.current.isError).toBe(true))
      const ings = queryClient.getQueryData<RecipeIngredient[]>(recipeKeys.ingredients(RECIPE_ID))
      expect(ings).toContainEqual(expect.objectContaining({ id: 'ing-1', needsShopping: false }))
    })

    it('restores itemKeys.shopping on failure', async () => {
      const { queryClient, result } = setup(false)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => expect(result.current.isError).toBe(true))
      const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
      expect(shopping).toEqual([])
    })

    it('restores itemKeys.all on failure', async () => {
      const { queryClient, result } = setup(false)
      act(() => {
        result.current.mutate({ id: 'ing-1', needsShopping: true, itemId: 'item-1', itemName: 'Milk' })
      })
      await waitFor(() => expect(result.current.isError).toBe(true))
      const all = queryClient.getQueryData<Item[]>(itemKeys.all)
      expect(all).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: false }))
    })
  })
})
