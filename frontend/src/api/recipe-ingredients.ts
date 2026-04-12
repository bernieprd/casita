import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { recipeKeys } from './recipes'
import { itemKeys } from './items'
import type { RecipeIngredient } from './types'
import type { Item } from './types'

// ── API functions ─────────────────────────────────────────────────────────────

export const recipeIngredientsApi = {
  list: (recipeId: string) =>
    api.get<RecipeIngredient[]>(`/recipes/${recipeId}/ingredients`),

  toggleNeedsShopping: (id: string, needsShopping: boolean) =>
    api.patch<RecipeIngredient>(`/recipe-ingredients/${id}`, { needsShopping }),
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useRecipeIngredients(recipeId: string) {
  return useQuery({
    queryKey: recipeKeys.ingredients(recipeId),
    queryFn: () => recipeIngredientsApi.list(recipeId),
  })
}

interface ToggleVars {
  id: string
  needsShopping: boolean
  itemId?: string
  itemName?: string
}

export function useToggleNeedsShopping(recipeId: string) {
  const qc = useQueryClient()
  const queryKey = recipeKeys.ingredients(recipeId)

  return useMutation({
    mutationFn: ({ id, needsShopping }: ToggleVars) =>
      recipeIngredientsApi.toggleNeedsShopping(id, needsShopping),

    onMutate: async ({ id, needsShopping, itemId, itemName }) => {
      await qc.cancelQueries({ queryKey })
      await qc.cancelQueries({ queryKey: itemKeys.shopping })
      await qc.cancelQueries({ queryKey: itemKeys.all })

      const previousIngredients = qc.getQueryData<RecipeIngredient[]>(queryKey)
      const previousShopping = qc.getQueryData<Item[]>(itemKeys.shopping)
      const previousAll = qc.getQueryData<Item[]>(itemKeys.all)

      // Optimistically flip the ingredient.
      qc.setQueryData<RecipeIngredient[]>(queryKey, old =>
        old?.map(ing => (ing.id === id ? { ...ing, needsShopping } : ing)),
      )

      // Optimistically sync onShoppingList on the full items cache.
      if (itemId) {
        qc.setQueryData<Item[]>(itemKeys.all, old =>
          old?.map(i => (i.id === itemId ? { ...i, onShoppingList: needsShopping } : i)),
        )

        // Optimistically add/remove from the shopping list, using full item data when available.
        qc.setQueryData<Item[]>(itemKeys.shopping, old => {
          if (!old) return old
          if (needsShopping) {
            if (old.some(i => i.id === itemId)) return old
            const full = qc.getQueryData<Item[]>(itemKeys.all)?.find(i => i.id === itemId)
            const item: Item = full
              ? { ...full, onShoppingList: true }
              : { id: itemId, name: itemName ?? '', category: null, supermarkets: [], tags: [], onShoppingList: true }
            return [...old, item]
          }
          return old.filter(i => i.id !== itemId)
        })
      }

      return { previousIngredients, previousShopping, previousAll }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousIngredients !== undefined)
        qc.setQueryData(queryKey, context.previousIngredients)
      if (context?.previousShopping !== undefined)
        qc.setQueryData(itemKeys.shopping, context.previousShopping)
      if (context?.previousAll !== undefined)
        qc.setQueryData(itemKeys.all, context.previousAll)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
      qc.invalidateQueries({ queryKey: itemKeys.all })
    },
  })
}
