import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import { recipeKeys } from './recipes'
import type { RecipeIngredient } from './types'

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

export function useToggleNeedsShopping(recipeId: string) {
  const qc = useQueryClient()
  const queryKey = recipeKeys.ingredients(recipeId)

  return useMutation({
    mutationFn: ({ id, needsShopping }: { id: string; needsShopping: boolean }) =>
      recipeIngredientsApi.toggleNeedsShopping(id, needsShopping),

    onMutate: async ({ id, needsShopping }) => {
      await qc.cancelQueries({ queryKey })

      const previous = qc.getQueryData<RecipeIngredient[]>(queryKey)

      qc.setQueryData<RecipeIngredient[]>(queryKey, old =>
        old?.map(ing => (ing.id === id ? { ...ing, needsShopping } : ing)),
      )

      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous !== undefined) qc.setQueryData(queryKey, context.previous)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey })
    },
  })
}
