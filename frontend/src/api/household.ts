import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

export interface HouseholdSettings {
  householdId: string | null
  householdName: string | null
  role: 'owner' | 'member' | null
  inviteCode: string | null
  members: {
    clerkUserId: string
    role: string
    displayName: string | null
    email: string | null
    imageUrl: string | null
  }[]
}

export const householdKeys = {
  settings: ['household', 'settings'] as const,
}

export function useHouseholdSettings() {
  return useQuery({
    queryKey: householdKeys.settings,
    queryFn: () => api.get<HouseholdSettings>('/household/me'),
    staleTime: 0,
  })
}

export function useGenerateInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ inviteCode: string }>('/household/invite', {}),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}

export function useRevokeInvite() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/household/invite'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}

export function useRenameHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) => api.patch<{ householdName: string }>('/household', { name }),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}

export type HouseholdThemePrefs = {
  primaryHsl?: string
  headingFont?: string
  bodyFont?: string
  radius?: string
}

export const householdThemeKeys = {
  theme: ['household', 'theme'] as const,
}

export function useHouseholdTheme() {
  return useQuery({
    queryKey: householdThemeKeys.theme,
    queryFn: () => api.get<HouseholdThemePrefs>('/household/settings'),
    staleTime: 30_000,
  })
}

export function useLeaveHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/household/leave'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}

export function useDeleteHousehold() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.delete('/household'),
    onSettled: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}

export function useTransferOwnership() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (newOwnerId: string) =>
      api.patch('/household/owner', { newOwnerId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: householdKeys.settings })
    },
  })
}

export function useUpdateHouseholdTheme() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (prefs: HouseholdThemePrefs) =>
      api.patch<HouseholdThemePrefs>('/household/settings', prefs),
    onSuccess: (data) => {
      qc.setQueryData(householdThemeKeys.theme, data)
    },
    onError: () => {
      // onError callback is forwarded per-call via mutate(prefs, { onError })
      // This hook-level handler is intentionally left as a no-op so callers
      // (e.g. useTheme) can supply their own per-invocation onError without
      // it being swallowed.
    },
  })
}

export type TodoWorkflow = 'simple' | 'board'

export interface TodoWorkflowSettings {
  workflow: TodoWorkflow
}

export const todoWorkflowKeys = {
  settings: ['household', 'todo-settings'] as const,
}

export function useTodoWorkflow() {
  return useQuery({
    queryKey: todoWorkflowKeys.settings,
    queryFn: () => api.get<TodoWorkflowSettings>('/household/todo-settings'),
    staleTime: 30_000,
  })
}

export function useUpdateTodoWorkflow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (workflow: TodoWorkflow) =>
      api.patch<TodoWorkflowSettings>('/household/todo-settings', { workflow }),
    onSuccess: (data) => {
      qc.setQueryData(todoWorkflowKeys.settings, data)
    },
  })
}
