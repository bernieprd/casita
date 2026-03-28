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

      const previousIngredients = qc.getQueryData<RecipeIngredient[]>(queryKey)
      const previousShopping = qc.getQueryData<Item[]>(itemKeys.shopping)

      // Optimistically flip the ingredient.
      qc.setQueryData<RecipeIngredient[]>(queryKey, old =>
        old?.map(ing => (ing.id === id ? { ...ing, needsShopping } : ing)),
      )

      // Optimistically add/remove from the shopping list.
      if (itemId) {
        qc.setQueryData<Item[]>(itemKeys.shopping, old => {
          if (!old) return old
          if (needsShopping) {
            if (old.some(i => i.id === itemId)) return old
            const stub: Item = { id: itemId, name: itemName ?? '', category: null, supermarkets: [], tags: [], onShoppingList: true }
            return [...old, stub]
          }
          return old.filter(i => i.id !== itemId)
        })
      }

      return { previousIngredients, previousShopping }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousIngredients !== undefined)
        qc.setQueryData(queryKey, context.previousIngredients)
      if (context?.previousShopping !== undefined)
        qc.setQueryData(itemKeys.shopping, context.previousShopping)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
    },
  })
}
