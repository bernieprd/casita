import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

// ── Shared recipe body ────────────────────────────────────────────────────────

export interface RecipeBody {
  name: string
  type?: string | null
  day?: string | null
  url?: string | null
  coverUrl?: string | null
  instructions?: string
}

// ── Create recipe vars ────────────────────────────────────────────────────────

export interface CreateRecipeVars {
  recipe: RecipeBody
  ingredients: Array<{ itemId: string; itemName: string; quantity: string | null; section: string | null }>
}

// ── Edit recipe vars ──────────────────────────────────────────────────────────

export interface EditRecipeVars {
  recipe: {
    name?: string
    type?: string | null
    day?: string | null
    url?: string | null
    coverUrl?: string | null
    instructions?: string
  }
  removedIngredientIds: string[]
  newIngredients: Array<{ itemId: string; itemName: string; quantity: string | null; section: string | null }>
  updatedIngredients: Array<{ id: string; itemId?: string; quantity: string | null; section: string | null }>
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useRecipes() {
  return useQuery({ queryKey: recipeKeys.all, queryFn: recipesApi.list })
}

export function useCreateRecipe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: CreateRecipeVars) => {
      const recipe = await api.post<Recipe>('/recipes', vars.recipe)
      await Promise.all(
        vars.ingredients.map(ing =>
          api.post('/recipe-ingredients', { recipeId: recipe.id, ...ing }),
        ),
      )
      return recipe
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.all })
    },
  })
}

export function useEditRecipe(recipeId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: EditRecipeVars) =>
      // Recipe PATCH and all ingredient ops touch different Notion pages — fully parallel
      Promise.all([
        api.patch(`/recipes/${recipeId}`, vars.recipe),
        ...vars.removedIngredientIds.map(id => api.delete(`/recipe-ingredients/${id}`)),
        ...vars.newIngredients.map(ing =>
          api.post('/recipe-ingredients', { recipeId, ...ing }),
        ),
        ...vars.updatedIngredients.map(({ id, itemId, quantity, section }) =>
          api.patch(`/recipe-ingredients/${id}`, { itemId, quantity, section }),
        ),
      ]),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: recipeKeys.detail(recipeId) })
      qc.invalidateQueries({ queryKey: recipeKeys.ingredients(recipeId) })
      qc.invalidateQueries({ queryKey: recipeKeys.all })
    },
  })
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
