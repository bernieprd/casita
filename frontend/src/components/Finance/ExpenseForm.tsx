import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import type { FinanceExpense } from '@/api/types'
import { useCreateFinanceExpense, useUpdateFinanceExpense, useDeleteFinanceExpense, eurosToCents, centsToEuros } from '@/api/finance'

const EXPENSE_TAGS = [
  'rent', 'utilities', 'groceries', 'restaurants', 'healthcare',
  'transportation', 'travel', 'entertainment', 'shopping',
  'transfers', 'insurance', 'services', 'taxes', 'cash', 'donation',
]

interface Props {
  periodId: string
  entry?: FinanceExpense | null
  open: boolean
  onClose: () => void
}

export default function ExpenseForm({ periodId, entry, open, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = Boolean(entry)

  const [source, setSource] = useState('')
  const [tag, setTag] = useState<string>('none')
  const [shared, setShared] = useState(false)
  const [amount, setAmount] = useState('')
  const [budget, setBudget] = useState('')

  useEffect(() => {
    if (open) {
      setSource(entry?.source ?? '')
      setTag(entry?.tag ?? 'none')
      setShared(entry?.type === 'shared')
      setAmount(entry ? centsToEuros(entry.amountCents) : '')
      setBudget(entry ? centsToEuros(entry.budgetCents) : '')
    }
  }, [open, entry])

  const { mutate: create, isPending: creating } = useCreateFinanceExpense()
  const { mutate: update, isPending: updating } = useUpdateFinanceExpense()
  const { mutate: remove, isPending: deleting } = useDeleteFinanceExpense()

  function handleSave() {
    const amountCents = eurosToCents(amount)
    const budgetCents = budget ? eurosToCents(budget) : 0
    if (!source.trim() || isNaN(amountCents) || amountCents < 0) return

    const payload = {
      source: source.trim(),
      tag: tag === 'none' ? null : tag,
      type: (shared ? 'shared' : 'personal') as 'shared' | 'personal',
      amountCents,
      budgetCents,
    }

    if (isEdit && entry) {
      update({ id: entry.id, periodId, ...payload }, {
        onSuccess: () => { toast.success(t('common.save')); onClose() },
      })
    } else {
      create({ periodId, ...payload }, {
        onSuccess: () => { toast.success(t('common.done')); onClose() },
      })
    }
  }

  function handleDelete() {
    if (!entry) return
    remove({ id: entry.id, periodId }, {
      onSuccess: () => { toast.success(t('common.delete')); onClose() },
    })
  }

  const busy = creating || updating || deleting

  return (
    <Sheet open={open} onOpenChange={v => { if (!v) onClose() }}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? t('finance.editExpense') : t('finance.addExpense')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('finance.source')}</Label>
            <Input
              value={source}
              onChange={e => setSource(e.target.value)}
              placeholder="Rent, groceries…"
              autoFocus={!isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('finance.tag')}</Label>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">—</SelectItem>
                {EXPENSE_TAGS.map(tg => <SelectItem key={tg} value={tg}>{tg}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between">
            <Label>{t('finance.shared')}</Label>
            <Switch checked={shared} onCheckedChange={setShared} />
          </div>

          <div className="space-y-1.5">
            <Label>{t('finance.amount')} (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={e => setAmount(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('finance.budget')} (€)</Label>
            <Input
              type="text"
              inputMode="decimal"
              value={budget}
              onChange={e => setBudget(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={busy || !source.trim()}>
              {busy ? t('common.saving') : t('common.save')}
            </Button>
            {isEdit && (
              <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10" onClick={handleDelete} disabled={busy}>
                {t('common.delete')}
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
