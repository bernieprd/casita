import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { CalendarIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useCreateTodo } from '../api/todos'

function tomorrow(): string {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().slice(0, 10)
}

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])
  return isDesktop
}

interface Props {
  open: boolean
  recipeName: string
  onClose: () => void
}

export default function PlanRecipeSheet({ open, recipeName, onClose }: Props) {
  const { t } = useTranslation()
  const [date, setDate] = useState(tomorrow)
  const [calOpen, setCalOpen] = useState(false)
  const createTodo = useCreateTodo()
  const isDesktop = useIsDesktop()

  function handleSubmit() {
    createTodo.mutate(
      { name: t('planRecipe.cookRecipe', { name: recipeName }), due: date },
      {
        onSuccess: () => {
          toast.success(t('planRecipe.addedToTodos'))
          onClose()
        },
      },
    )
  }

  const selectedDate = date ? parseISO(date) : undefined

  const formContent = (
    <div className="px-4 py-5">
      <label className="text-sm font-medium mb-1.5 block">{t('planRecipe.date')}</label>
      <Popover open={calOpen} onOpenChange={setCalOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              'w-full justify-start text-left font-normal',
              !date && 'text-muted-foreground',
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date ? format(parseISO(date), 'PPP') : <span>{t('planRecipe.pickDate')}</span>}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={day => {
              setDate(day ? format(day, 'yyyy-MM-dd') : '')
              setCalOpen(false)
            }}
            autoFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  )

  const footer = (
    <>
      <Button
        onClick={handleSubmit}
        disabled={!date || createTodo.isPending}
        className="w-full"
      >
        {t('planRecipe.addToTodos')}
      </Button>
      <Button variant="ghost" onClick={onClose} className="w-full">
        {t('common.cancel')}
      </Button>
    </>
  )

  if (isDesktop) {
    return (
      <Dialog open={open} onOpenChange={o => { if (!o) onClose() }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('planRecipe.title')}</DialogTitle>
            <DialogDescription>{t('planRecipe.description')}</DialogDescription>
          </DialogHeader>
          <Separator />
          {formContent}
          <Separator />
          <DialogFooter className="gap-2 flex-col sm:flex-col">
            {footer}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Drawer open={open} onOpenChange={o => { if (!o) onClose() }} disablePreventScroll>
      <DrawerContent className="flex flex-col">
        <DrawerHeader className="text-left pb-3">
          <DrawerTitle>{t('planRecipe.title')}</DrawerTitle>
          <DrawerDescription>{t('planRecipe.description')}</DrawerDescription>
        </DrawerHeader>
        <Separator />
        {formContent}
        <Separator />
        <DrawerFooter className="pb-6 gap-2">
          {footer}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
