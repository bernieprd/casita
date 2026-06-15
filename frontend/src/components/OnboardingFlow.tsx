import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Home, ShoppingCart, BookOpen, CheckSquare, CalendarDays,
  ChevronLeft, Check, X,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  Dialog, DialogContent, DialogClose, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import GuidedImport from './GuidedImport'

// ── Preview components ────────────────────────────────────────────────────────

function WelcomePreview() {
  const features: { Icon: LucideIcon; label: string }[] = [
    { Icon: ShoppingCart, label: 'Shopping' },
    { Icon: BookOpen,     label: 'Recipes' },
    { Icon: CheckSquare,  label: 'To-Dos' },
    { Icon: CalendarDays, label: 'Calendar' },
  ]
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timers = features.map((_, i) =>
      setTimeout(() => setCount(i + 1), 100 + i * 100),
    )
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex gap-5 justify-center items-center">
      {features.map(({ Icon, label }, i) => (
        <div
          key={label}
          className={cn(
            'flex flex-col items-center gap-1.5 transition-all duration-400',
            i < count ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3',
          )}
        >
          <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Icon className="size-5 text-primary" />
          </div>
          <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
        </div>
      ))}
    </div>
  )
}

function ShoppingPreview() {
  const items = [
    { name: 'Milk',  store: 'Lidl' },
    { name: 'Eggs',  store: 'Lidl' },
    { name: 'Bread', store: '' },
  ]
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timers = items.map((_, i) =>
      setTimeout(() => setCount(i + 1), 150 + i * 150),
    )
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {items.map(({ name, store }, i) => (
        <div
          key={name}
          className={cn(
            'flex items-center px-3 py-2.5 gap-3 transition-all duration-300',
            i > 0 && 'border-t border-border',
            i < count ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
          <span className="text-sm flex-1">{name}</span>
          {store && (
            <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {store}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

function RecipesPreview() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className={cn(
        'w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm transition-all duration-500',
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
      )}
    >
      <div className="w-full aspect-video bg-accent flex items-center justify-center text-3xl select-none">
        🍽
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold mb-1.5">Spaghetti Carbonara</p>
        <Badge variant="default" className="text-[10px] h-5">Dinner</Badge>
      </div>
    </div>
  )
}

function TodosPreview() {
  const todos = [
    { name: 'Fix bathroom tap', priority: 'High' },
    { name: 'Buy groceries',    priority: 'Medium' },
    { name: 'Call insurance',   priority: '' },
  ]
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    todos.forEach((_, i) => {
      timers.push(setTimeout(() => setCount(i + 1), 150 + i * 150))
    })
    // Cycle: appear done → not done → done ...
    function cycle(next: boolean, delay: number) {
      const t = setTimeout(() => {
        setDone(next)
        cycle(!next, next ? 1800 : 1400)
      }, delay)
      timers.push(t)
    }
    cycle(true, 1100)
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {todos.map(({ name, priority }, i) => (
        <div
          key={name}
          className={cn(
            'flex items-center px-3 py-2.5 gap-3 transition-all duration-300',
            i > 0 && 'border-t border-border',
            i < count ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
            i === 0 && done && 'opacity-40',
          )}
        >
          <div
            className={cn(
              'size-4 rounded shrink-0 border-2 transition-all duration-300 flex items-center justify-center',
              i === 0 && done
                ? 'bg-primary border-primary'
                : 'border-muted-foreground/30',
            )}
          >
            {i === 0 && done && <Check className="size-2.5 text-primary-foreground" />}
          </div>
          <span
            className={cn(
              'text-sm flex-1 transition-all duration-300',
              i === 0 && done && 'line-through text-muted-foreground',
            )}
          >
            {name}
          </span>
          {priority && (
            <Badge
              variant={priority === 'High' ? 'destructive' : 'secondary'}
              className="text-[10px] h-4 px-1.5"
            >
              {priority}
            </Badge>
          )}
        </div>
      ))}
    </div>
  )
}

function CalendarPreview() {
  const events = [
    { name: 'Doctor appointment', day: 'Today',    time: '10:00' },
    { name: 'Family dinner',      day: 'Tomorrow', time: '7:00 PM' },
  ]
  const [count, setCount] = useState(0)
  useEffect(() => {
    const timers = events.map((_, i) =>
      setTimeout(() => setCount(i + 1), 150 + i * 200),
    )
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {events.map(({ name, day, time }, i) => (
        <div
          key={name}
          className={cn(
            'flex items-center px-3 py-2.5 gap-3 transition-all duration-300',
            i > 0 && 'border-t border-border',
            i < count ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
          )}
        >
          <p className="text-sm flex-1 truncate">{name}</p>
          <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
            {day}
          </span>
          <span className="text-xs text-muted-foreground/60 whitespace-nowrap">{time}</span>
        </div>
      ))}
    </div>
  )
}

// ── Slide data ────────────────────────────────────────────────────────────────

interface SlideData {
  key: string
  Icon: LucideIcon
  Preview: () => React.JSX.Element
}

const SLIDES: SlideData[] = [
  { key: 'welcome',  Icon: Home,         Preview: WelcomePreview },
  { key: 'shopping', Icon: ShoppingCart, Preview: ShoppingPreview },
  { key: 'recipes',  Icon: BookOpen,     Preview: RecipesPreview },
  { key: 'todos',    Icon: CheckSquare,  Preview: TodosPreview },
  { key: 'calendar', Icon: CalendarDays, Preview: CalendarPreview },
]

const TOTAL_STEPS = SLIDES.length + 1 // +1 for import step

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  householdName: string | null
  onClose: () => void
}

export default function OnboardingFlow({ householdName, onClose }: Props) {
  const { t } = useTranslation()
  const [slideIndex, setSlideIndex] = useState(0)
  const [showImport, setShowImport] = useState(false)

  const currentDot = showImport ? SLIDES.length : slideIndex
  const isLastSlide = slideIndex === SLIDES.length - 1
  const slide = SLIDES[slideIndex]

  const slideTitle = slide.key === 'welcome'
    ? t('onboarding.slides.welcome.title', { name: householdName ?? 'Casita' })
    : t(`onboarding.slides.${slide.key}.title`)

  function handleNext() {
    if (isLastSlide) setShowImport(true)
    else setSlideIndex(i => i + 1)
  }

  function handleBack() {
    if (showImport) setShowImport(false)
    else setSlideIndex(i => i - 1)
  }

  const dots = (
    <div className="flex justify-center gap-1.5">
      {Array.from({ length: TOTAL_STEPS }, (_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all duration-300',
            i === currentDot ? 'size-2 bg-primary' : 'size-1.5 bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  )

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0" showCloseButton={false}>

        {showImport ? (
          /* ── Import step ── */
          <div className="flex flex-col">
            <div className="px-4 pt-4 pb-3 flex items-center gap-2 border-b border-border shrink-0">
              <Button variant="ghost" size="icon" className="-ml-1 size-8" onClick={handleBack}>
                <ChevronLeft className="size-4" />
              </Button>
              <div className="flex-1 flex justify-center pr-7">
                {dots}
              </div>
            </div>
            <div className="p-5">
              <GuidedImport onDone={onClose} onSkip={onClose} />
            </div>
          </div>
        ) : (
          /* ── Feature slides ── */
          <>
            {/* Preview area */}
            <div className="relative h-48 bg-muted flex items-center justify-center overflow-hidden px-6">
              <div key={slideIndex} className="w-full animate-in fade-in duration-300">
                <slide.Preview />
              </div>
              <DialogClose asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-2 right-2 size-8 text-muted-foreground hover:text-foreground"
                  aria-label={t('common.close')}
                >
                  <X className="size-4" />
                </Button>
              </DialogClose>
            </div>

            {/* Slide text + nav */}
            <div className="p-5 flex flex-col gap-4">
              <div
                key={`text-${slideIndex}`}
                className="animate-in fade-in slide-in-from-bottom-1 duration-300 flex flex-col gap-1"
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <slide.Icon className="size-4 text-primary shrink-0" />
                  <DialogTitle className="text-base font-bold leading-tight">
                    {slideTitle}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-sm leading-relaxed">
                  {t(`onboarding.slides.${slide.key}.description`)}
                </DialogDescription>
              </div>

              {dots}

              <div className="flex items-center justify-between">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className={cn('gap-1 text-muted-foreground', slideIndex === 0 && 'invisible')}
                >
                  <ChevronLeft className="size-3.5" />
                  {t('onboarding.back')}
                </Button>
                <Button size="sm" onClick={handleNext}>
                  {isLastSlide ? t('onboarding.letsGo') : t('onboarding.next')}
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
