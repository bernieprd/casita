import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import type { FinanceExpense } from '@/api/types'

interface Props {
  expenses: FinanceExpense[]
}

const COLORS = ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5'] as const

function buildDonutData(expenses: FinanceExpense[]) {
  const map = new Map<string, number>()
  for (const e of expenses) {
    const key = e.tag ?? 'Other'
    map.set(key, (map.get(key) ?? 0) + e.amountCents)
  }
  const named = [...map.entries()].filter(([n]) => n !== 'Other').sort((a, b) => b[1] - a[1])
  const top5 = named.slice(0, 5)
  const overflow = named.slice(5)
  const otherCents = overflow.reduce((s, [, v]) => s + v, 0) + (map.get('Other') ?? 0)
  const result = top5.map(([name, value], i) => ({
    name,
    value: value / 100,
    fill: `var(${COLORS[i]})`,
  }))
  if (otherCents > 0) {
    result.push({ name: 'Other', value: otherCents / 100, fill: `var(${COLORS[4]})` })
  }
  return result
}

export default function SpendingDonutChart({ expenses }: Props) {
  const data = buildDonutData(expenses)
  if (data.length === 0) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={52}
          outerRadius={78}
          paddingAngle={2}
        >
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.fill} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value: unknown) => [`€${(value as number).toFixed(2)}`]}
        />
        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
      </PieChart>
    </ResponsiveContainer>
  )
}
