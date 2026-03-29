import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Todo } from './types'

export const todoKeys = {
  all: ['todos'] as const,
}

export function useTodos() {
  return useQuery({ queryKey: todoKeys.all, queryFn: () => api.get<Todo[]>('/todos') })
}

export function useUpdateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Partial<Omit<Todo, 'id'>>) =>
      api.patch<Todo>(`/todos/${id}`, fields),
    onMutate: async ({ id, ...fields }) => {
      await qc.cancelQueries({ queryKey: todoKeys.all })
      const previous = qc.getQueryData<Todo[]>(todoKeys.all)
      qc.setQueryData<Todo[]>(todoKeys.all, old =>
        old?.map(t => t.id === id ? { ...t, ...fields } : t) ?? old,
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(todoKeys.all, context.previous)
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: todoKeys.all })
    },
  })
}
