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
import {
  Drawer, DrawerContent, DrawerClose, DrawerTitle, DrawerDescription,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useIsMobile } from '@/hooks/useIsMobile'
import GuidedImport from './GuidedImport'

// ── Preview components ────────────────────────────────────────────────────────

function WelcomePreview() {
  // Icons in bottom-tab order: Calendar, Todos, Shopping, Recipes
  const features: { Icon: LucideIcon; label: string }[] = [
    { Icon: CalendarDays, label: 'Calendar' },
    { Icon: CheckSquare,  label: 'To-Dos' },
    { Icon: ShoppingCart, label: 'Shopping' },
    { Icon: BookOpen,     label: 'Recipes' },
  ]

  // phase: 'enter' | 'hold' | 'exit' | 'reset'
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'reset'>('enter')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    function runCycle() {
      // Phase A: stagger icons in
      setPhase('enter')
      setCount(0)
      features.forEach((_, i) => {
        timers.push(setTimeout(() => setCount(i + 1), i * 130))
      })

      // Phase B: hold
      const holdStart = features.length * 130 + 200
      timers.push(setTimeout(() => setPhase('hold'), holdStart))

      // Phase C: stagger icons out (upward)
      const exitStart = holdStart + 900
      timers.push(setTimeout(() => {
        setPhase('exit')
        setCount(features.length)
        features.forEach((_, i) => {
          timers.push(setTimeout(() => setCount(features.length - i - 1), i * 100))
        })
      }, exitStart))

      // Phase D: reset, then loop
      const resetStart = exitStart + features.length * 100 + 300
      timers.push(setTimeout(() => {
        setPhase('reset')
        setCount(0)
        timers.push(setTimeout(runCycle, 80))
      }, resetStart))
    }

    runCycle()
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex gap-5 justify-center items-center">
      {features.map(({ Icon, label }, i) => {
        let visible = false
        let exitUp = false
        if (phase === 'enter') visible = i < count
        else if (phase === 'hold') visible = true
        else if (phase === 'exit') { visible = i < count; exitUp = i >= count }
        // reset: all hidden at bottom (default)

        return (
          <div
            key={label}
            className={cn(
              'flex flex-col items-center gap-1.5 transition-all duration-400',
              phase === 'reset' && 'duration-0',
              visible
                ? 'opacity-100 translate-y-0'
                : exitUp
                  ? 'opacity-0 -translate-y-8'
                  : 'opacity-0 translate-y-8',
            )}
          >
            <div className="size-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Icon className="size-5 text-primary" />
            </div>
            <span className="text-[11px] font-medium text-muted-foreground">{label}</span>
          </div>
        )
      })}
    </div>
  )
}

type ShoppingPhase = 'entering' | 'checking' | 'clearing' | 'reset'

function ShoppingPreview() {
  const items = [
    { name: 'Milk',   store: 'Lidl' },
    { name: 'Eggs',   store: 'Lidl' },
    { name: 'Bread',  store: '' },
  ]
  const [phase, setPhase] = useState<ShoppingPhase>('entering')
  const [enterCount, setEnterCount] = useState(0)
  const [checkCount, setCheckCount] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    function runCycle() {
      setPhase('entering')
      setEnterCount(0)
      setCheckCount(0)

      // Stagger items in
      items.forEach((_, i) => {
        timers.push(setTimeout(() => setEnterCount(i + 1), 150 + i * 160))
      })

      // Start checking after all items visible
      const checkStart = 150 + items.length * 160 + 400
      timers.push(setTimeout(() => setPhase('checking'), checkStart))
      items.forEach((_, i) => {
        timers.push(setTimeout(() => setCheckCount(i + 1), checkStart + 80 + i * 220))
      })

      // Clear all rows
      const clearStart = checkStart + 80 + items.length * 220 + 500
      timers.push(setTimeout(() => setPhase('clearing'), clearStart))

      // Reset and loop
      const resetStart = clearStart + 400
      timers.push(setTimeout(() => {
        setPhase('reset')
        timers.push(setTimeout(runCycle, 80))
      }, resetStart))
    }

    runCycle()
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {items.map(({ name, store }, i) => {
        const entered = i < enterCount
        const checked = i < checkCount && phase !== 'entering'
        const clearing = phase === 'clearing' || phase === 'reset'

        return (
          <div
            key={name}
            className={cn(
              'flex items-center px-4 py-2.5 gap-3 transition-all duration-300',
              i > 0 && 'border-t border-border',
              entered && !clearing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
            )}
          >
            <span className="text-sm flex-1">{name}</span>
            {store && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {store}
              </span>
            )}
            <div className="shrink-0 transition-all duration-300">
              {checked
                ? <Check className="size-4 text-primary" />
                : <ShoppingCart className="size-4 text-muted-foreground" />
              }
            </div>
          </div>
        )
      })}
    </div>
  )
}

function RecipesPreview() {
  const recipes = [
    { emoji: '🍝', name: 'Spaghetti Carbonara', tag: 'Dinner' },
    { emoji: '🥗', name: 'Caesar Salad',         tag: 'Lunch' },
    { emoji: '🫐', name: 'Blueberry Pancakes',   tag: 'Breakfast' },
  ]
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    function showRecipe() {
      setVisible(true)
      // Hold for 1800ms then fade out
      timers.push(setTimeout(() => {
        setVisible(false)
        // After fade out, advance to next recipe
        timers.push(setTimeout(() => {
          setIndex(i => (i + 1) % recipes.length)
          showRecipe()
        }, 320))
      }, 1800))
    }

    const t = setTimeout(showRecipe, 100)
    timers.push(t)
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const recipe = recipes[index]

  return (
    <div
      className={cn(
        'w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm transition-all duration-400',
        visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95',
      )}
    >
      <div className="w-full aspect-video bg-accent flex items-center justify-center text-3xl select-none">
        {recipe.emoji}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold mb-1.5">{recipe.name}</p>
        <Badge variant="default" className="text-[10px] h-5">{recipe.tag}</Badge>
      </div>
    </div>
  )
}

function TodosPreview() {
  const todos = [
    { name: 'Fix bathroom tap', priority: 'High',   assignee: null },
    { name: 'Buy groceries',    priority: 'Medium', assignee: 'AJ' },
    { name: 'Call insurance',   priority: '',       assignee: null },
  ]
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    todos.forEach((_, i) => {
      timers.push(setTimeout(() => setCount(i + 1), 150 + i * 150))
    })
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
      {todos.map(({ name, priority, assignee }, i) => (
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
          {assignee && (
            <div className="size-5 rounded-full bg-primary/20 text-primary text-[9px] font-bold flex items-center justify-center shrink-0">
              {assignee}
            </div>
          )}
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
  // phase: 'entering' items slide in, 'exiting' items slide out downward, 'reset' instant hide
  const [phase, setPhase] = useState<'entering' | 'exiting' | 'reset'>('entering')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    function runCycle() {
      setPhase('entering')
      setCount(0)

      // Stagger items in
      events.forEach((_, i) => {
        timers.push(setTimeout(() => setCount(i + 1), 150 + i * 200))
      })

      // Hold, then exit downward
      const exitStart = 150 + events.length * 200 + 1000
      timers.push(setTimeout(() => {
        setPhase('exiting')
        setCount(0)
        events.forEach((_, i) => {
          timers.push(setTimeout(() => setCount(i + 1), i * 150))
        })
      }, exitStart))

      // Reset and loop
      const resetStart = exitStart + events.length * 150 + 350
      timers.push(setTimeout(() => {
        setPhase('reset')
        setCount(0)
        timers.push(setTimeout(runCycle, 80))
      }, resetStart))
    }

    runCycle()
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {events.map(({ name, day, time }, i) => {
        const entered = phase === 'entering' && i < count
        const held = phase === 'exiting' && i >= count
        const exited = phase === 'exiting' && i < count

        const visible = entered || held
        const slideDown = exited || phase === 'reset'

        return (
          <div
            key={name}
            className={cn(
              'flex items-center px-3 py-2.5 gap-3 transition-all duration-300',
              phase === 'reset' && 'duration-0',
              i > 0 && 'border-t border-border',
              visible
                ? 'opacity-100 translate-y-0'
                : slideDown
                  ? 'opacity-0 translate-y-3'
                  : 'opacity-0 -translate-y-2',
            )}
          >
            <p className="text-sm flex-1 truncate">{name}</p>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
              {day}
            </span>
            <span className="text-xs text-muted-foreground/60 whitespace-nowrap">{time}</span>
          </div>
        )
      })}
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
  { key: 'calendar', Icon: CalendarDays, Preview: CalendarPreview },
  { key: 'todos',    Icon: CheckSquare,  Preview: TodosPreview },
  { key: 'shopping', Icon: ShoppingCart, Preview: ShoppingPreview },
  { key: 'recipes',  Icon: BookOpen,     Preview: RecipesPreview },
]

const TOTAL_STEPS = SLIDES.length

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  householdName: string | null
  onClose: () => void
}

// Shared inner content — rendered identically inside both Dialog and Drawer.
// CloseWrapper is the platform-appropriate close primitive (DialogClose or DrawerClose).
interface InnerProps {
  householdName: string | null
  onClose: () => void
  CloseWrapper: React.ComponentType<{ asChild?: boolean; children: React.ReactNode }>
  TitleWrapper: React.ComponentType<{ className?: string; children: React.ReactNode }>
  DescriptionWrapper: React.ComponentType<{ className?: string; children: React.ReactNode }>
  previewHeightClass: string
}

function OnboardingInner({
  householdName,
  onClose,
  CloseWrapper,
  TitleWrapper,
  DescriptionWrapper,
  previewHeightClass,
}: InnerProps) {
  const { t } = useTranslation()
  const [slideIndex, setSlideIndex] = useState(0)
  const [showImport, setShowImport] = useState(false)

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
            i === slideIndex ? 'size-2 bg-primary' : 'size-1.5 bg-muted-foreground/30',
          )}
        />
      ))}
    </div>
  )

  if (showImport) {
    return (
      <div className="flex flex-col">
        <div className="p-5">
          <GuidedImport onDone={onClose} onSkip={onClose} />
        </div>
        <div className="px-5 pb-5 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            className="gap-1 text-muted-foreground"
          >
            <ChevronLeft className="size-3.5" />
            {t('onboarding.back')}
          </Button>
          <div className="invisible">
            <Button size="sm">{t('onboarding.next')}</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      {/* Preview area */}
      <div className={cn('relative bg-muted flex items-center justify-center overflow-hidden px-6', previewHeightClass)}>
        <div key={slideIndex} className="w-full animate-in fade-in duration-300">
          <slide.Preview />
        </div>
        <CloseWrapper asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-2 right-2 size-8 text-muted-foreground hover:text-foreground"
            aria-label={t('common.close')}
          >
            <X className="size-4" />
          </Button>
        </CloseWrapper>
      </div>

      {/* Slide text + nav */}
      <div className="p-5 flex flex-col gap-4">
        <div
          key={`text-${slideIndex}`}
          className="animate-in fade-in slide-in-from-bottom-1 duration-300 flex flex-col gap-1"
        >
          <div className="flex items-center gap-2 mb-0.5">
            <slide.Icon className="size-4 text-primary shrink-0" />
            <TitleWrapper className="text-base font-bold leading-tight">
              {slideTitle}
            </TitleWrapper>
          </div>
          <DescriptionWrapper className="text-sm leading-relaxed">
            {t(`onboarding.slides.${slide.key}.description`)}
          </DescriptionWrapper>
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
  )
}

export default function OnboardingFlow({ householdName, onClose }: Props) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open dismissible={false} onOpenChange={(open) => { if (!open) onClose() }}>
        <DrawerContent className="p-0 gap-0 overflow-hidden">
          <OnboardingInner
            householdName={householdName}
            onClose={onClose}
            CloseWrapper={DrawerClose}
            TitleWrapper={DrawerTitle}
            DescriptionWrapper={DrawerDescription}
            previewHeightClass="h-40"
          />
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-sm p-0 overflow-hidden gap-0" showCloseButton={false}>
        <OnboardingInner
          householdName={householdName}
          onClose={onClose}
          CloseWrapper={DialogClose}
          TitleWrapper={DialogTitle}
          DescriptionWrapper={DialogDescription}
          previewHeightClass="h-48"
        />
      </DialogContent>
    </Dialog>
  )
}
