import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'
import type { FinanceExpense } from '@/api/types'
import EntryRow from './EntryRow'
import ExpenseForm from './ExpenseForm'

interface Props {
  periodId: string
  expenses: FinanceExpense[]
  memberCount: number
}

export default function ExpenseSection({ periodId, expenses, memberCount }: Props) {
  const { t } = useTranslation()
  const [editEntry, setEditEntry] = useState<FinanceExpense | null | undefined>(undefined)
  const open = editEntry !== undefined

  const shared = expenses.filter(e => e.type === 'shared')
  const personal = expenses.filter(e => e.type === 'personal')

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('finance.expenses')}
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditEntry(null)}>
          <Plus className="size-3.5 mr-1" />{t('finance.addExpense')}
        </Button>
      </div>

      {shared.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground mb-1.5 px-1">{t('finance.shared')}</p>
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {shared.map(entry => (
              <EntryRow
                key={entry.id}
                source={entry.source}
                tag={entry.tag}
                amountCents={entry.amountCents}
                badge={
                  memberCount > 1 ? (
                    <Badge variant="outline" className="text-[10px] px-1 py-0">÷{memberCount}</Badge>
                  ) : undefined
                }
                onEdit={() => setEditEntry(entry)}
              />
            ))}
          </div>
        </div>
      )}

      {personal.length > 0 && (
        <div>
          {shared.length > 0 && (
            <p className="text-xs text-muted-foreground mb-1.5 px-1">{t('finance.personal')}</p>
          )}
          <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
            {personal.map(entry => (
              <EntryRow
                key={entry.id}
                source={entry.source}
                tag={entry.tag}
                amountCents={entry.amountCents}
                onEdit={() => setEditEntry(entry)}
              />
            ))}
          </div>
        </div>
      )}

      {expenses.length === 0 && (
        <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)]">
          <p className="px-4 py-3 text-sm text-muted-foreground">{t('finance.addExpense')}</p>
        </div>
      )}

      <Separator className="mt-4" />

      <ExpenseForm
        periodId={periodId}
        entry={editEntry}
        open={open}
        onClose={() => setEditEntry(undefined)}
      />
    </div>
  )
}
