import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { FinancePeriod } from '@/api/types'

interface Props {
  periods: FinancePeriod[]
}

export default function IncomeExpensesChart({ periods }: Props) {
  if (periods.length < 2) return null

  const data = periods.slice(-6).map(p => ({
    name: p.name,
    income:   (p.incomeCents   ?? 0) / 100,
    expenses: (p.expensesCents ?? 0) / 100,
  }))

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
        <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v: number) => `€${v}`}
        />
        <Tooltip
          formatter={(value: unknown, name: unknown) => [
            `€${(value as number).toFixed(2)}`,
            name === 'income' ? 'Income' : 'Expenses',
          ]}
        />
        <Bar dataKey="income"   name="Income"   fill="var(--chart-2)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="expenses" name="Expenses" fill="var(--chart-1)" radius={[3, 3, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}
