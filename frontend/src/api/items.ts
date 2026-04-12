import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Item, RecipeIngredient } from './types'

// ── Query keys ────────────────────────────────────────────────────────────────

export const itemKeys = {
  all:      ['items'] as const,
  shopping: ['items', { shopping: true }] as const,
}

// ── API functions ─────────────────────────────────────────────────────────────

export const itemsApi = {
  list:         ()                                    => api.get<Item[]>('/items'),
  listShopping: ()                                    => api.get<Item[]>('/items?shopping=true'),
  create:       (data: Omit<Item, 'id'>)              => api.post<Item>('/items', data),
  update:       (id: string, data: Partial<Omit<Item, 'id'>>) => api.patch<Item>(`/items/${id}`, data),
  delete:       (id: string)                          => api.delete(`/items/${id}`),
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useItems() {
  return useQuery({ queryKey: itemKeys.all, queryFn: itemsApi.list })
}

export function useShoppingList() {
  return useQuery({ queryKey: itemKeys.shopping, queryFn: itemsApi.listShopping })
}

export function useCreateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: Omit<Item, 'id'>) => itemsApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
    },
  })
}

export function useUpdateItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Omit<Item, 'id'>> }) =>
      itemsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
    },
  })
}

export function useDeleteItem() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => itemsApi.delete(id),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: itemKeys.all })
      const previous = qc.getQueryData<Item[]>(itemKeys.all)
      qc.setQueryData<Item[]>(itemKeys.all, old => old?.filter(i => i.id !== id))
      qc.setQueryData<Item[]>(itemKeys.shopping, old => old?.filter(i => i.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous !== undefined)
        qc.setQueryData(itemKeys.all, context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
    },
  })
}

export function useMergeItems() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ discardId, keepId }: { discardId: string; keepId: string }) =>
      api.post<Item>(`/items/${discardId}/merge`, { keepId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
    },
  })
}

export function useToggleShoppingList() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, onShoppingList }: { id: string; onShoppingList: boolean }) =>
      itemsApi.update(id, { onShoppingList }),
    onMutate: async ({ id, onShoppingList }) => {
      await Promise.all([
        qc.cancelQueries({ queryKey: itemKeys.all }),
        qc.cancelQueries({ queryKey: itemKeys.shopping }),
      ])
      const previousAll      = qc.getQueryData<Item[]>(itemKeys.all)
      const previousShopping = qc.getQueryData<Item[]>(itemKeys.shopping)

      qc.setQueryData<Item[]>(itemKeys.all, old =>
        old?.map(i => i.id === id ? { ...i, onShoppingList } : i),
      )
      qc.setQueryData<Item[]>(itemKeys.shopping, old => {
        if (!old) return old
        if (onShoppingList) {
          const full = qc.getQueryData<Item[]>(itemKeys.all)?.find(i => i.id === id)
          const updated = full ? { ...full, onShoppingList: true } : undefined
          return updated && !old.some(i => i.id === id) ? [...old, updated] : old
        }
        return old.filter(i => i.id !== id)
      })

      // Optimistically sync needsShopping on any cached recipe ingredient queries.
      const previousIngredientCaches: [readonly unknown[], RecipeIngredient[]][] = []
      qc.getQueriesData<RecipeIngredient[]>({ queryKey: ['recipes'] }).forEach(([key, data]) => {
        if (!Array.isArray(data) || key[2] !== 'ingredients') return
        previousIngredientCaches.push([key, data])
        qc.setQueryData(key, data.map(ing =>
          ing.itemId === id ? { ...ing, needsShopping: onShoppingList } : ing,
        ))
      })

      return { previousAll, previousShopping, previousIngredientCaches }
    },
    onError: (_err, _vars, context) => {
      if (context?.previousAll      !== undefined) qc.setQueryData(itemKeys.all,      context.previousAll)
      if (context?.previousShopping !== undefined) qc.setQueryData(itemKeys.shopping, context.previousShopping)
      context?.previousIngredientCaches?.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
      qc.invalidateQueries({
        predicate: q => q.queryKey[0] === 'recipes' && q.queryKey[2] === 'ingredients',
      })
    },
  })
}
