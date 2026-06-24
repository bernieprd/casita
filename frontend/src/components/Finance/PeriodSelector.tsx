import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useTranslation } from 'react-i18next'
import type { FinancePeriod } from '@/api/types'
import { useCreateFinancePeriod } from '@/api/finance'

interface Props {
  periods: FinancePeriod[]
  selectedIndex: number
  onSelect: (index: number) => void
}

export default function PeriodSelector({ periods, selectedIndex, onSelect }: Props) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const { mutate: createPeriod, isPending } = useCreateFinancePeriod()

  const selected = periods[selectedIndex]

  function suggestDates() {
    const last = periods[periods.length - 1]
    if (!last) {
      const today = new Date()
      const startDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0)
      return {
        name: today.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
        startDate,
        endDate: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`,
      }
    }
    const nextStart = new Date(last.endDate)
    nextStart.setDate(nextStart.getDate() + 1)
    const nextEnd = new Date(nextStart)
    nextEnd.setDate(nextEnd.getDate() + 30)
    const fmt = (d: Date) => d.toISOString().slice(0, 10)
    return {
      name: nextStart.toLocaleDateString('en', { month: 'short', year: 'numeric' }),
      startDate: fmt(nextStart),
      endDate: fmt(nextEnd),
    }
  }

  const suggested = suggestDates()
  const [name, setName] = useState(suggested.name)
  const [startDate, setStartDate] = useState(suggested.startDate)
  const [endDate, setEndDate] = useState(suggested.endDate)

  function handleOpen() {
    const s = suggestDates()
    setName(s.name)
    setStartDate(s.startDate)
    setEndDate(s.endDate)
    setOpen(true)
  }

  function handleCreate() {
    if (!name.trim() || !startDate || !endDate) return
    createPeriod({ name: name.trim(), startDate, endDate }, {
      onSuccess: () => setOpen(false),
    })
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <Button
          variant="ghost"
          size="icon"
          disabled={selectedIndex <= 0}
          onClick={() => onSelect(selectedIndex - 1)}
          aria-label="Previous period"
        >
          <ChevronLeft className="size-5" />
        </Button>

        <span className="text-base font-semibold">
          {selected ? selected.name : t('finance.noPeriods')}
        </span>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            disabled={selectedIndex >= periods.length - 1}
            onClick={() => onSelect(selectedIndex + 1)}
            aria-label="Next period"
          >
            <ChevronRight className="size-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleOpen} aria-label={t('finance.newPeriod')}>
            <Plus className="size-5" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('finance.newPeriod')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="period-name">{t('finance.periodName')}</Label>
              <Input
                id="period-name"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jan 2026"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-start">{t('finance.periodStart')}</Label>
              <Input
                id="period-start"
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="period-end">{t('finance.periodEnd')}</Label>
              <Input
                id="period-end"
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleCreate} disabled={isPending || !name.trim() || !startDate || !endDate}>
              {isPending ? t('common.creating') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
