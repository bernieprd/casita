import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Recipe, RecipeWithBlocks } from './types'

// ── Query keys ────────────────────────────────────────────────────────────────

export const recipeKeys = {
  all: ['recipes'] as const,
  detail: (id: string) => ['recipes', id] as const,
  ingredients: (id: string) => ['recipes', id, 'ingredients'] as const,
}

// ── API functions ─────────────────────────────────────────────────────────────

export const recipesApi = {
  list: () => api.get<Recipe[]>('/recipes'),
  get: (id: string) => api.get<RecipeWithBlocks>(`/recipes/${id}`),
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useRecipes() {
  return useQuery({ queryKey: recipeKeys.all, queryFn: recipesApi.list })
}

export function useRecipe(id: string) {
  // qc is captured by the placeholderData closure — valid because useQueryClient
  // is called at hook level, not inside the callback.
  const qc = useQueryClient()
  return useQuery({
    queryKey: recipeKeys.detail(id),
    queryFn: () => recipesApi.get(id),
    // Pre-fill from the list cache so navigating recipe → detail has no flash.
    placeholderData: () => {
      const list = qc.getQueryData<Recipe[]>(recipeKeys.all)
      return list?.find(r => r.id === id) as RecipeWithBlocks | undefined
    },
  })
}
