import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { FinancePeriod, FinanceIncome, FinanceExpense, FinanceAccount } from './types'
import { financeKeys } from './queryKeys'

export { financeKeys }

export function eurosToCents(euros: number | string): number {
  return Math.round(parseFloat(String(euros)) * 100)
}

export function centsToEuros(cents: number): string {
  return (cents / 100).toFixed(2)
}

// ── Periods ───────────────────────────────────────────────────────────────────

export function useFinancePeriods() {
  return useQuery({
    queryKey: financeKeys.periods(),
    queryFn: () => api.get<FinancePeriod[]>('/finance/periods'),
  })
}

export function useCreateFinancePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) =>
      api.post<FinancePeriod>('/finance/periods', data),
    onSettled: () => { qc.invalidateQueries({ queryKey: financeKeys.periods() }) },
  })
}

export function useDeleteFinancePeriod() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/finance/periods/${id}`),
    onSettled: () => { qc.invalidateQueries({ queryKey: financeKeys.periods() }) },
  })
}

// ── Income ────────────────────────────────────────────────────────────────────

export function useFinanceIncome(periodId: string) {
  return useQuery({
    queryKey: financeKeys.income(periodId),
    queryFn: () => api.get<FinanceIncome[]>(`/finance/income?periodId=${periodId}`),
    enabled: Boolean(periodId),
  })
}

export function useCreateFinanceIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      periodId: string
      source: string
      tag?: string | null
      amountCents: number
    }) => api.post<FinanceIncome>('/finance/income', data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: financeKeys.income(data.periodId) })
      const previous = qc.getQueryData<FinanceIncome[]>(financeKeys.income(data.periodId))
      const optimistic: FinanceIncome = {
        id: `optimistic-${Date.now()}`,
        householdId: '',
        userId: '',
        periodId: data.periodId,
        source: data.source,
        tag: data.tag ?? null,
        amountCents: data.amountCents,
        createdAt: Date.now(),
      }
      qc.setQueryData<FinanceIncome[]>(financeKeys.income(data.periodId), old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(financeKeys.income(vars.periodId), ctx.previous)
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.income(vars.periodId) })
      qc.invalidateQueries({ queryKey: financeKeys.periods() })
    },
  })
}

export function useUpdateFinanceIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Partial<Omit<FinanceIncome, 'id'>>) =>
      api.patch<FinanceIncome>(`/finance/income/${id}`, fields),
    onSettled: (_data, _err, vars) => {
      if (vars.periodId) qc.invalidateQueries({ queryKey: financeKeys.income(vars.periodId) })
      qc.invalidateQueries({ queryKey: financeKeys.periods() })
    },
  })
}

export function useDeleteFinanceIncome() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; periodId: string }) => api.delete(`/finance/income/${id}`),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.income(vars.periodId) })
      qc.invalidateQueries({ queryKey: financeKeys.periods() })
    },
  })
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export function useFinanceExpenses(periodId: string) {
  return useQuery({
    queryKey: financeKeys.expenses(periodId),
    queryFn: () => api.get<FinanceExpense[]>(`/finance/expenses?periodId=${periodId}`),
    enabled: Boolean(periodId),
  })
}

export function useCreateFinanceExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      periodId: string
      source: string
      tag?: string | null
      type?: 'shared' | 'personal'
      amountCents: number
      budgetCents?: number
    }) => api.post<FinanceExpense>('/finance/expenses', data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: financeKeys.expenses(data.periodId) })
      const previous = qc.getQueryData<FinanceExpense[]>(financeKeys.expenses(data.periodId))
      const optimistic: FinanceExpense = {
        id: `optimistic-${Date.now()}`,
        householdId: '',
        userId: '',
        periodId: data.periodId,
        source: data.source,
        tag: data.tag ?? null,
        type: data.type ?? 'personal',
        amountCents: data.amountCents,
        budgetCents: data.budgetCents ?? 0,
        createdAt: Date.now(),
      }
      qc.setQueryData<FinanceExpense[]>(financeKeys.expenses(data.periodId), old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(financeKeys.expenses(vars.periodId), ctx.previous)
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.expenses(vars.periodId) })
      qc.invalidateQueries({ queryKey: financeKeys.periods() })
    },
  })
}

export function useUpdateFinanceExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Partial<Omit<FinanceExpense, 'id'>>) =>
      api.patch<FinanceExpense>(`/finance/expenses/${id}`, fields),
    onSettled: (_data, _err, vars) => {
      if (vars.periodId) qc.invalidateQueries({ queryKey: financeKeys.expenses(vars.periodId) })
      qc.invalidateQueries({ queryKey: financeKeys.periods() })
    },
  })
}

export function useDeleteFinanceExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; periodId: string }) => api.delete(`/finance/expenses/${id}`),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.expenses(vars.periodId) })
      qc.invalidateQueries({ queryKey: financeKeys.periods() })
    },
  })
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export function useFinanceAccounts(periodId: string) {
  return useQuery({
    queryKey: financeKeys.accounts(periodId),
    queryFn: () => api.get<FinanceAccount[]>(`/finance/accounts?periodId=${periodId}`),
    enabled: Boolean(periodId),
  })
}

export function useCreateFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: {
      periodId: string
      name: string
      institution?: string | null
      amountCents: number
      date: string
    }) => api.post<FinanceAccount>('/finance/accounts', data),
    onMutate: async (data) => {
      await qc.cancelQueries({ queryKey: financeKeys.accounts(data.periodId) })
      const previous = qc.getQueryData<FinanceAccount[]>(financeKeys.accounts(data.periodId))
      const optimistic: FinanceAccount = {
        id: `optimistic-${Date.now()}`,
        householdId: '',
        userId: '',
        periodId: data.periodId,
        name: data.name,
        institution: data.institution ?? null,
        amountCents: data.amountCents,
        date: data.date,
        createdAt: Date.now(),
      }
      qc.setQueryData<FinanceAccount[]>(financeKeys.accounts(data.periodId), old => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(financeKeys.accounts(vars.periodId), ctx.previous)
    },
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.accounts(vars.periodId) })
    },
  })
}

export function useUpdateFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...fields }: { id: string } & Partial<Omit<FinanceAccount, 'id'>>) =>
      api.patch<FinanceAccount>(`/finance/accounts/${id}`, fields),
    onSettled: (_data, _err, vars) => {
      if (vars.periodId) qc.invalidateQueries({ queryKey: financeKeys.accounts(vars.periodId) })
    },
  })
}

export function useDeleteFinanceAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id }: { id: string; periodId: string }) => api.delete(`/finance/accounts/${id}`),
    onSettled: (_data, _err, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.accounts(vars.periodId) })
    },
  })
}
