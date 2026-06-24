import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import type { FinancePeriod } from '@/api/types'

interface Props {
  periods: FinancePeriod[]
}

export default function SavingsTrendChart({ periods }: Props) {
  if (periods.length < 2) return null

  let running = 0
  const data = periods.map(p => {
    running += (p.incomeCents ?? 0) - (p.expensesCents ?? 0)
    return { name: p.name, savings: running / 100 }
  })

  return (
    <div className="mb-6">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
        Cumulative savings
      </p>
      <ResponsiveContainer width="100%" height={180}>
        <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="savingsGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="var(--chart-2)" stopOpacity={0.25} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis
            tick={{ fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `€${v}`}
          />
          <Tooltip
            formatter={(value: unknown) => [`€${(value as number).toFixed(2)}`, 'Cumulative savings']}
          />
          <Area
            type="monotone"
            dataKey="savings"
            stroke="var(--chart-2)"
            strokeWidth={2}
            fill="url(#savingsGradient)"
            dot={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
