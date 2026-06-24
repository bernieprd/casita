import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { FinancePeriod } from '@/api/types'

interface Props {
  periods: FinancePeriod[]
}

export default function NetWorthChart({ periods }: Props) {
  if (periods.length < 2) return null

  const data = periods.map(p => ({
    name: p.name,
    netWorth: (p.accountsCents ?? 0) / 100,
  }))

  return (
    <div className="mb-4">
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `€${v}`}
          />
          <Tooltip
            formatter={(value: unknown) => [`€${(value as number).toFixed(2)}`, 'Net worth']}
          />
          <Line
            type="monotone"
            dataKey="netWorth"
            stroke="var(--chart-3)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--chart-3)' }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
