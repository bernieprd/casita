import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useTranslation } from 'react-i18next'
import type { FinanceAccount } from '@/api/types'
import { centsToEuros } from '@/api/finance'
import EntryRow from './EntryRow'
import AccountForm from './AccountForm'

interface Props {
  periodId: string
  accounts: FinanceAccount[]
}

export default function AccountsSection({ periodId, accounts }: Props) {
  const { t } = useTranslation()
  const [editEntry, setEditEntry] = useState<FinanceAccount | null | undefined>(undefined)
  const open = editEntry !== undefined

  const totalCents = accounts.reduce((s, a) => s + a.amountCents, 0)

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t('finance.accounts')}
        </p>
        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditEntry(null)}>
          <Plus className="size-3.5 mr-1" />{t('finance.addAccount')}
        </Button>
      </div>

      {accounts.length > 0 && (
        <p className="text-xs text-muted-foreground mb-2 px-1">
          Net worth: €{centsToEuros(totalCents)}
        </p>
      )}

      <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] divide-y divide-border">
        {accounts.length === 0 ? (
          <p className="px-4 py-3 text-sm text-muted-foreground">{t('finance.addAccount')}</p>
        ) : (
          accounts.map(entry => (
            <EntryRow
              key={entry.id}
              source={entry.name}
              tag={entry.institution}
              amountCents={entry.amountCents}
              onEdit={() => setEditEntry(entry)}
            />
          ))
        )}
      </div>

      <Separator className="mt-4" />

      <AccountForm
        periodId={periodId}
        entry={editEntry}
        open={open}
        onClose={() => setEditEntry(undefined)}
      />
    </div>
  )
}
