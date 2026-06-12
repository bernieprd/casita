import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { Todo } from './types'

export const todoKeys = {
  all: ['todos'] as const,
}

export const todosApi = {
  list: () => api.get<Todo[]>('/todos'),
}

export function useTodos() {
  return useQuery({ queryKey: todoKeys.all, queryFn: todosApi.list })
}

export function useCreateTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      name: string
      status?: string | null
      due?: string | null
      priority?: string | null
      categoryId?: string | null
      assignedTo?: string | null
      url?: string | null
      notes?: string | null
      frequency?: string | null
    }) => api.post<Todo>('/todos', data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: todoKeys.all })
      const previous = qc.getQueryData<Todo[]>(todoKeys.all)
      const optimistic: Todo = {
        id: `optimistic-${Date.now()}`,
        name: data.name,
        status: 'Todo',
        priority: data.priority ?? null,
        due: data.due ?? null,
        categoryId: data.categoryId ?? null,
        assignedTo: data.assignedTo ?? null,
        url: data.url ?? null,
        notes: data.notes ?? null,
        frequency: data.frequency ?? null,
        sortOrder: 0,
      }
      qc.setQueryData<Todo[]>(todoKeys.all, old => [optimistic, ...(old ?? [])])
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

export function useReorderTodos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (ids: string[]) => api.patch('/todos/reorder', { ids }),
    onMutate: async (ids) => {
      await qc.cancelQueries({ queryKey: todoKeys.all })
      const previous = qc.getQueryData<Todo[]>(todoKeys.all)
      qc.setQueryData<Todo[]>(todoKeys.all, old => {
        if (!old) return old
        const indexed = new Map(old.map(t => [t.id, t]))
        return ids.map((id, i) => ({ ...indexed.get(id)!, sortOrder: i }))
      })
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) qc.setQueryData(todoKeys.all, context.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: todoKeys.all }),
  })
}

export function useDeleteTodo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/todos/${id}`),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: todoKeys.all })
      const previous = qc.getQueryData<Todo[]>(todoKeys.all)
      qc.setQueryData<Todo[]>(todoKeys.all, old => old?.filter(t => t.id !== id) ?? old)
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
