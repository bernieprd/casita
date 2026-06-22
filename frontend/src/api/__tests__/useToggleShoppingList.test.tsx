// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/msw-server'
import { createTestQueryClient, createWrapper } from '@/test/query-wrapper'
import { useToggleShoppingList, itemKeys } from '../items'
import { recipeKeys } from '../recipes'
import type { Item, RecipeIngredient } from '../types'

const ITEM_OFF: Item = { id: 'item-1', name: 'Milk', category: null, supermarkets: [], onShoppingList: false }
const ITEM_ON:  Item = { ...ITEM_OFF, onShoppingList: true }

function setup(initialState = false) {
  const queryClient = createTestQueryClient()
  queryClient.setQueryData<Item[]>(itemKeys.all, [initialState ? ITEM_ON : ITEM_OFF])
  queryClient.setQueryData<Item[]>(itemKeys.shopping, initialState ? [ITEM_ON] : [])
  const wrapper = createWrapper(queryClient)
  const { result } = renderHook(() => useToggleShoppingList(), { wrapper })
  return { queryClient, result }
}

describe('useToggleShoppingList', () => {
  describe('optimistic update — toggle ON', () => {
    it('updates itemKeys.all before the network responds', async () => {
      const { queryClient, result } = setup()
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => {
        const all = queryClient.getQueryData<Item[]>(itemKeys.all)
        expect(all).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: true }))
      })
    })

    it('adds the item to itemKeys.shopping', async () => {
      const { queryClient, result } = setup()
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => {
        const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
        expect(shopping).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: true }))
      })
    })
  })

  describe('optimistic update — toggle OFF', () => {
    it('removes the item from itemKeys.shopping', async () => {
      const { queryClient, result } = setup(true)
      server.use(
        http.patch('http://localhost:8787/items/:id', () =>
          HttpResponse.json({ ...ITEM_OFF }),
        ),
      )
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: false }) })
      await waitFor(() => {
        const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
        expect(shopping).not.toContainEqual(expect.objectContaining({ id: 'item-1' }))
      })
    })
  })

  describe('recipe ingredient cache sync', () => {
    it('flips needsShopping on cached ingredients with the same itemId', async () => {
      const { queryClient, result } = setup()
      const ingredient: RecipeIngredient = {
        id: 'ing-1', recipeId: 'recipe-1', itemId: 'item-1',
        itemName: 'Milk', quantity: null, section: null, needsShopping: false,
      }
      queryClient.setQueryData<RecipeIngredient[]>(recipeKeys.ingredients('recipe-1'), [ingredient])
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => {
        const ings = queryClient.getQueryData<RecipeIngredient[]>(recipeKeys.ingredients('recipe-1'))
        expect(ings).toContainEqual(expect.objectContaining({ id: 'ing-1', needsShopping: true }))
      })
    })

    it('does not touch ingredients whose itemId differs', async () => {
      const { queryClient, result } = setup()
      const unrelatedIngredient: RecipeIngredient = {
        id: 'ing-2', recipeId: 'recipe-1', itemId: 'item-99',
        itemName: 'Eggs', quantity: null, section: null, needsShopping: false,
      }
      queryClient.setQueryData<RecipeIngredient[]>(recipeKeys.ingredients('recipe-1'), [unrelatedIngredient])
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      const ings = queryClient.getQueryData<RecipeIngredient[]>(recipeKeys.ingredients('recipe-1'))
      expect(ings).toContainEqual(expect.objectContaining({ id: 'ing-2', needsShopping: false }))
    })
  })

  describe('error rollback', () => {
    beforeEach(() => {
      server.use(
        http.patch('http://localhost:8787/items/:id', () =>
          HttpResponse.json({ error: 'Server error' }, { status: 500 }),
        ),
      )
    })

    it('restores itemKeys.all on mutation failure', async () => {
      const { queryClient, result } = setup()
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => expect(result.current.isError).toBe(true))
      const all = queryClient.getQueryData<Item[]>(itemKeys.all)
      expect(all).toContainEqual(expect.objectContaining({ id: 'item-1', onShoppingList: false }))
    })

    it('restores itemKeys.shopping on mutation failure', async () => {
      const { queryClient, result } = setup()
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => expect(result.current.isError).toBe(true))
      const shopping = queryClient.getQueryData<Item[]>(itemKeys.shopping)
      expect(shopping).toEqual([])
    })

    it('restores recipe ingredient caches on mutation failure', async () => {
      const { queryClient, result } = setup()
      const ingredient: RecipeIngredient = {
        id: 'ing-1', recipeId: 'recipe-1', itemId: 'item-1',
        itemName: 'Milk', quantity: null, section: null, needsShopping: false,
      }
      queryClient.setQueryData<RecipeIngredient[]>(recipeKeys.ingredients('recipe-1'), [ingredient])
      act(() => { result.current.mutate({ id: 'item-1', onShoppingList: true }) })
      await waitFor(() => expect(result.current.isError).toBe(true))
      const ings = queryClient.getQueryData<RecipeIngredient[]>(recipeKeys.ingredients('recipe-1'))
      expect(ings).toContainEqual(expect.objectContaining({ id: 'ing-1', needsShopping: false }))
    })
  })
})
