import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ImportBody {
  items?: Array<{ name: string; category?: string | null; onShoppingList?: boolean }>
  recipes?: Array<{
    name: string
    type?: string | null
    url?: string | null
    instructions?: string
    ingredients?: Array<{ name: string; quantity?: string | null }>
  }>
  todos?: Array<{ name: string; priority?: string | null; due?: string | null }>
  finance?: {
    periods?: Array<{ name: string; startDate: string; endDate: string }>
    income?: Array<{ source: string; tag?: string | null; amount: number; periodName: string }>
    expenses?: Array<{ source: string; tag?: string | null; type?: 'shared' | 'personal'; amount: number; budget?: number; periodName: string }>
    accounts?: Array<{ name: string; institution?: string | null; amount: number; date: string; periodName: string }>
  }
}

export interface ImportResult {
  imported: {
    items: number
    recipes: number
    todos: number
    finance: { periods: number; income: number; expenses: number; accounts: number }
  }
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
      qc.invalidateQueries({ queryKey: ['finance'] })
    },
  })
}
