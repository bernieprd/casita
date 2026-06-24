import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import type { FinanceAccount } from '@/api/types'
import { useCreateFinanceAccount, useUpdateFinanceAccount, useDeleteFinanceAccount, eurosToCents, centsToEuros } from '@/api/finance'

interface Props {
  periodId: string
  entry?: FinanceAccount | null
  open: boolean
  onClose: () => void
}

export default function AccountForm({ periodId, entry, open, onClose }: Props) {
  const { t } = useTranslation()
  const isEdit = Boolean(entry)

  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState('')

  useEffect(() => {
    if (open) {
      setName(entry?.name ?? '')
      setInstitution(entry?.institution ?? '')
      setAmount(entry ? centsToEuros(entry.amountCents) : '')
      setDate(entry?.date ?? new Date().toISOString().slice(0, 10))
    }
  }, [open, entry])

  const { mutate: create, isPending: creating } = useCreateFinanceAccount()
  const { mutate: update, isPending: updating } = useUpdateFinanceAccount()
  const { mutate: remove, isPending: deleting } = useDeleteFinanceAccount()

  function handleSave() {
    const amountCents = eurosToCents(amount)
    if (!name.trim() || isNaN(amountCents) || !date) return

    const payload = {
      name: name.trim(),
      institution: institution.trim() || null,
      amountCents,
      date,
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
          <SheetTitle>{isEdit ? t('finance.editAccount') : t('finance.addAccount')}</SheetTitle>
        </SheetHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>{t('common.rename')}</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Revolut Savings"
              autoFocus={!isEdit}
            />
          </div>

          <div className="space-y-1.5">
            <Label>{t('finance.institution')}</Label>
            <Input
              value={institution}
              onChange={e => setInstitution(e.target.value)}
              placeholder="Revolut, Sabadell…"
            />
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
            <Label>{t('finance.date')}</Label>
            <Input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button className="flex-1" onClick={handleSave} disabled={busy || !name.trim()}>
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
