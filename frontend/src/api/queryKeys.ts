export const todoKeys = {
  all: ['todos'] as const,
}

export const financeKeys = {
  periods:  () => ['finance', 'periods'] as const,
  income:   (periodId: string) => ['finance', 'income', periodId] as const,
  expenses: (periodId: string) => ['finance', 'expenses', periodId] as const,
  accounts: (periodId: string) => ['finance', 'accounts', periodId] as const,
}
