import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportBody {
  version?: number
  items?: Array<{
    name: string
    category?: string | null
    onShoppingList?: boolean
    supermarkets?: string[]
  }>
  recipes?: Array<{
    name: string
    type?: string | null
    url?: string | null
    instructions?: string
    ingredients?: Array<{ name: string; quantity?: string | null }>
  }>
  todos?: Array<{
    name: string
    priority?: string | null
    due?: string | null
    status?: string | null
    notes?: string | null
    url?: string | null
    frequency?: string | null
    frequency_interval?: number | null
    frequency_days?: string | null
    category?: string | null
  }>
}

export interface ImportResult {
  imported: { items: number; recipes: number; todos: number }
  skipped?: { items: number }
  failed?: { recipes: number }
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: ImportBody) => api.post<ImportResult>('/import', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['items'] })
      qc.invalidateQueries({ queryKey: ['recipes'] })
      qc.invalidateQueries({ queryKey: ['todos'] })
    },
  })
}
