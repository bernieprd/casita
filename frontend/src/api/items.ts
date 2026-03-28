import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import type { InfiniteData } from '@tanstack/react-query'
import { api } from './client'
import type { Item } from './types'

export interface PaginatedItems {
  items: Item[]
  nextCursor: string | null
}

// ── Query keys ────────────────────────────────────────────────────────────────

export const itemKeys = {
  all:      ['items'] as const,
  shopping: ['items', { shopping: true }] as const,
}

// ── API functions ─────────────────────────────────────────────────────────────

export const itemsApi = {
  // Paginated inventory (GET /items?cursor=X)
  listPage: (cursor?: string) =>
    api.get<PaginatedItems>(cursor ? `/items?cursor=${encodeURIComponent(cursor)}` : '/items'),

  // Shopping list — always flat (small)
  listShopping: () => api.get<Item[]>('/items?shopping=true'),

  create: (data: Omit<Item, 'id'>) => api.post<Item>('/items', data),
  update: (id: string, data: Partial<Omit<Item, 'id'>>) => api.patch<Item>(`/items/${id}`, data),
  delete: (id: string) => api.delete(`/items/${id}`),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Flatten all loaded pages into a single Item[].
export function flatItems(data: InfiniteData<PaginatedItems> | undefined): Item[] {
  return data?.pages.flatMap(p => p.items) ?? []
}

type InfiniteItems = InfiniteData<PaginatedItems>

function updateInfiniteItem(
  old: InfiniteItems | undefined,
  id: string,
  patch: Partial<Item>,
): InfiniteItems | undefined {
  if (!old) return old
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      items: page.items.map(item => (item.id === id ? { ...item, ...patch } : item)),
    })),
  }
}

function removeFromInfinite(
  old: InfiniteItems | undefined,
  id: string,
): InfiniteItems | undefined {
  if (!old) return old
  return {
    ...old,
    pages: old.pages.map(page => ({
      ...page,
      items: page.items.filter(item => item.id !== id),
    })),
  }
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

// Paginated inventory list.
export function useItems() {
  return useInfiniteQuery({
    queryKey: itemKeys.all,
    queryFn: ({ pageParam }) => itemsApi.listPage(pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: last => last.nextCursor ?? undefined,
  })
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
      const previous = qc.getQueryData<InfiniteItems>(itemKeys.all)
      qc.setQueryData<InfiniteItems>(itemKeys.all, old => removeFromInfinite(old, id))
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

// Optimistic toggle: flips onShoppingList immediately in both caches.
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

      const previousAll = qc.getQueryData<InfiniteItems>(itemKeys.all)
      const previousShopping = qc.getQueryData<Item[]>(itemKeys.shopping)

      // Update item in the paged cache.
      qc.setQueryData<InfiniteItems>(itemKeys.all, old =>
        updateInfiniteItem(old, id, { onShoppingList }),
      )

      // Add or remove from shopping list cache.
      qc.setQueryData<Item[]>(itemKeys.shopping, old => {
        if (!old) return old
        if (onShoppingList) {
          const full = flatItems(qc.getQueryData<InfiniteItems>(itemKeys.all)).find(i => i.id === id)
          const updated = full ? { ...full, onShoppingList: true } : undefined
          return updated && !old.some(i => i.id === id) ? [...old, updated] : old
        }
        return old.filter(i => i.id !== id)
      })

      return { previousAll, previousShopping }
    },

    onError: (_err, _vars, context) => {
      if (context?.previousAll !== undefined)
        qc.setQueryData(itemKeys.all, context.previousAll)
      if (context?.previousShopping !== undefined)
        qc.setQueryData(itemKeys.shopping, context.previousShopping)
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: itemKeys.all })
      qc.invalidateQueries({ queryKey: itemKeys.shopping })
    },
  })
}
