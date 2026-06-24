import { useTranslation } from 'react-i18next'
import { centsToEuros } from '@/api/finance'
import type { FinancePeriod } from '@/api/types'
import IncomeExpensesChart from './IncomeExpensesChart'

interface Props {
  incomeCents: number
  yourShareCents: number
  periods: FinancePeriod[]
}

export default function SummaryCards({ incomeCents, yourShareCents, periods }: Props) {
  const { t } = useTranslation()
  const netCents = incomeCents - yourShareCents
  const savingsCents = netCents > 0 ? netCents : 0

  const cards = [
    { label: t('finance.income'),   value: incomeCents,    positive: true },
    { label: t('finance.yourShare'), value: yourShareCents, positive: false },
    { label: t('finance.net'),       value: netCents,        positive: netCents >= 0 },
    { label: t('finance.savings'),   value: savingsCents,    positive: true },
  ]

  return (
    <div className="mb-4">
      <div className="grid grid-cols-2 gap-3 mb-4">
        {cards.map(({ label, value, positive }) => (
          <div
            key={label}
            className="bg-card border border-border rounded-lg shadow-[0_1px_2px_rgba(0,0,0,.06)] px-3 py-3"
          >
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-lg font-bold tabular-nums ${value < 0 ? 'text-destructive' : positive ? 'text-primary' : 'text-foreground'}`}>
              €{centsToEuros(Math.abs(value))}
            </p>
          </div>
        ))}
      </div>
      {periods.length >= 2 && <IncomeExpensesChart periods={periods} />}
    </div>
  )
}
