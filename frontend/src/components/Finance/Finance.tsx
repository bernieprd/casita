import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useUser } from '@clerk/clerk-react'
import { useHousehold } from '@/context/AuthContext'
import {
  useFinancePeriods,
  useFinanceIncome,
  useFinanceExpenses,
  useFinanceAccounts,
} from '@/api/finance'
import PeriodSelector from './PeriodSelector'
import SummaryCards from './SummaryCards'
import SavingsTrendChart from './SavingsTrendChart'
import IncomeSection from './IncomeSection'
import ExpenseSection from './ExpenseSection'
import AccountsSection from './AccountsSection'

export default function Finance() {
  const { t } = useTranslation()
  const { user } = useUser()
  const { household } = useHousehold()
  const memberCount = (household as { members?: unknown[] } | null)?.members?.length ?? 1

  const { data: periods = [] } = useFinancePeriods()
  const [selectedIndex, setSelectedIndex] = useState(() => Math.max(0, (periods?.length ?? 1) - 1))
  const period = periods[selectedIndex]
  const periodId = period?.id ?? ''

  const { data: income = [] } = useFinanceIncome(periodId)
  const { data: expenses = [] } = useFinanceExpenses(periodId)
  const { data: accounts = [] } = useFinanceAccounts(periodId)

  // Cost-split: shared expenses ÷ memberCount + personal expenses owned by this user
  const userId = user?.id ?? ''
  const sharedCents = expenses.filter(e => e.type === 'shared').reduce((s, e) => s + e.amountCents, 0)
  const personalCents = expenses.filter(e => e.type === 'personal' && e.userId === userId).reduce((s, e) => s + e.amountCents, 0)
  const yourShareCents = personalCents + Math.round(sharedCents / memberCount)
  const incomeCents = income.reduce((s, e) => s + e.amountCents, 0)

  return (
    <div>
      <PeriodSelector
        periods={periods}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
      />

      {!period ? (
        <p className="text-sm text-muted-foreground text-center py-8">{t('finance.noPeriods')}</p>
      ) : (
        <>
          <SummaryCards
            incomeCents={incomeCents}
            yourShareCents={yourShareCents}
            periods={periods}
          />

          <SavingsTrendChart periods={periods} />

          <IncomeSection periodId={periodId} income={income} />
          <ExpenseSection periodId={periodId} expenses={expenses} memberCount={memberCount} />
          <AccountsSection periodId={periodId} accounts={accounts} periods={periods} />
        </>
      )}
    </div>
  )
}
