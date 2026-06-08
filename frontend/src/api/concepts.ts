import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export type ConceptType = 'recipe-types' | 'categories' | 'supermarkets'

export interface ConceptItem {
  id: string
  name: string
  sort_order: number
}

export const conceptKeys = {
  list: (type: ConceptType) => ['concepts', type] as const,
}

export function useConceptList(type: ConceptType) {
  return useQuery({
    queryKey: conceptKeys.list(type),
    queryFn: () => api.get<ConceptItem[]>(`/concepts/${type}`),
  })
}

export function useCreateConcept(type: ConceptType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.post<ConceptItem>(`/concepts/${type}`, { name }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: conceptKeys.list(type) })
    },
  })
}

export function useRenameConcept(type: ConceptType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      api.patch<ConceptItem>(`/concepts/${type}/${id}`, { name }),
    onMutate: async ({ id, name }) => {
      await qc.cancelQueries({ queryKey: conceptKeys.list(type) })
      const previous = qc.getQueryData<ConceptItem[]>(conceptKeys.list(type))
      qc.setQueryData<ConceptItem[]>(conceptKeys.list(type), old =>
        old?.map(c => c.id === id ? { ...c, name } : c) ?? old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(conceptKeys.list(type), context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: conceptKeys.list(type) })
    },
  })
}

export function useBackfillConcepts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ categories: number; supermarkets: number }>('/concepts/backfill', {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['concepts'] }),
  })
}

export function useDeleteConcept(type: ConceptType) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/concepts/${type}/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: conceptKeys.list(type) })
      const previous = qc.getQueryData<ConceptItem[]>(conceptKeys.list(type))
      qc.setQueryData<ConceptItem[]>(conceptKeys.list(type), old =>
        old?.filter(c => c.id !== id) ?? old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(conceptKeys.list(type), context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: conceptKeys.list(type) })
    },
  })
}
