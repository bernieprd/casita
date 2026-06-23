import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'
import type { FinanceIncome } from '@/api/types'
import EntryRow from './EntryRow'
import IncomeForm from './IncomeForm'

interface Props {
  periodId: string
  income: FinanceIncome[]
}

export default function IncomeSection({ periodId, income }: Props) {
  const { t } = useTranslation()
  const [editEntry, setEditEntry] = useState<FinanceIncome | null | undefined>(undefined)
  const open = editEntry !== undefined

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('finance.income')}
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditEntry(null)}>
          <Plus className="size-3.5 mr-1" />{t('finance.addIncome')}
        </Button>
      </div>

      <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
        {income.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{t('finance.addIncome')}</p>
        ) : (
          income.map(entry => (
            <EntryRow
              key={entry.id}
              source={entry.source}
              tag={entry.tag}
              amountCents={entry.amountCents}
              onEdit={() => setEditEntry(entry)}
            />
          ))
        )}
      </div>

      <Separator className="mt-4" />

      <IncomeForm
        periodId={periodId}
        entry={editEntry}
        open={open}
        onClose={() => setEditEntry(undefined)}
      />
    </div>
  )
}
