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

// Static icon list for WelcomePreview — keys reuse existing nav.* translations
const WELCOME_FEATURES: { Icon: LucideIcon; navKey: string }[] = [
  { Icon: CalendarDays, navKey: 'nav.calendar' },
  { Icon: CheckSquare,  navKey: 'nav.todos' },
  { Icon: ShoppingCart, navKey: 'nav.shopping' },
  { Icon: BookOpen,     navKey: 'nav.recipes' },
]

function WelcomePreview() {
  const { t } = useTranslation()

  // phase: 'enter' | 'hold' | 'exit' | 'reset'
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit' | 'reset'>('enter')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    function runCycle() {
      // Phase A: stagger icons in
      setPhase('enter')
      setCount(0)
      WELCOME_FEATURES.forEach((_, i) => {
        timers.push(setTimeout(() => setCount(i + 1), i * 130))
      })

      // Phase B: hold
      const holdStart = WELCOME_FEATURES.length * 130 + 200
      timers.push(setTimeout(() => setPhase('hold'), holdStart))

      // Phase C: stagger icons out (upward)
      const exitStart = holdStart + 900
      timers.push(setTimeout(() => {
        setPhase('exit')
        setCount(WELCOME_FEATURES.length)
        WELCOME_FEATURES.forEach((_, i) => {
          timers.push(setTimeout(() => setCount(WELCOME_FEATURES.length - i - 1), i * 100))
        })
      }, exitStart))

      // Phase D: reset, then loop
      const resetStart = exitStart + WELCOME_FEATURES.length * 100 + 300
      timers.push(setTimeout(() => {
        setPhase('reset')
        setCount(0)
        timers.push(setTimeout(runCycle, 80))
      }, resetStart))
    }

    runCycle()
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="flex gap-5 justify-center items-center">
      {WELCOME_FEATURES.map(({ Icon, navKey }, i) => {
        let visible = false
        let exitUp = false
        if (phase === 'enter') visible = i < count
        else if (phase === 'hold') visible = true
        else if (phase === 'exit') { visible = i < count; exitUp = i >= count }
        // reset: all hidden at bottom (default)

        return (
          <div
            key={navKey}
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
            <span className="text-[11px] font-medium text-muted-foreground">{t(navKey)}</span>
          </div>
        )
      })}
    </div>
  )
}

type ShoppingPhase = 'entering' | 'checking' | 'clearing' | 'reset'

// Static item list for ShoppingPreview — nameKey resolves via t(), store is a proper noun
const SHOPPING_ITEMS: { nameKey: string; store: string }[] = [
  { nameKey: 'onboarding.preview.milkItem',  store: 'Lidl' },
  { nameKey: 'onboarding.preview.eggsItem',  store: 'Lidl' },
  { nameKey: 'onboarding.preview.breadItem', store: '' },
]

function ShoppingPreview() {
  const { t } = useTranslation()
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
      SHOPPING_ITEMS.forEach((_, i) => {
        timers.push(setTimeout(() => setEnterCount(i + 1), 150 + i * 160))
      })

      // Start checking after all items visible
      const checkStart = 150 + SHOPPING_ITEMS.length * 160 + 400
      timers.push(setTimeout(() => setPhase('checking'), checkStart))
      SHOPPING_ITEMS.forEach((_, i) => {
        timers.push(setTimeout(() => setCheckCount(i + 1), checkStart + 80 + i * 220))
      })

      // Clear all rows
      const clearStart = checkStart + 80 + SHOPPING_ITEMS.length * 220 + 500
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
  }, [])

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {SHOPPING_ITEMS.map(({ nameKey, store }, i) => {
        const entered = i < enterCount
        const checked = i < checkCount && phase !== 'entering'
        const clearing = phase === 'clearing' || phase === 'reset'

        return (
          <div
            key={nameKey}
            className={cn(
              'flex items-center px-4 py-2.5 gap-3 transition-all duration-300',
              i > 0 && 'border-t border-border',
              entered && !clearing ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2',
            )}
          >
            <span className="text-sm flex-1">{t(nameKey)}</span>
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

// Static recipe list for RecipesPreview — names are internationally understood, tagKey is translated
const RECIPE_ITEMS: { emoji: string; name: string; tagKey: string }[] = [
  { emoji: '🍝', name: 'Spaghetti Carbonara', tagKey: 'onboarding.preview.tagDinner' },
  { emoji: '🥗', name: 'Caesar Salad',         tagKey: 'onboarding.preview.tagLunch' },
  { emoji: '🫐', name: 'Blueberry Pancakes',   tagKey: 'onboarding.preview.tagBreakfast' },
]

function RecipesPreview() {
  const { t } = useTranslation()
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
          setIndex(i => (i + 1) % RECIPE_ITEMS.length)
          showRecipe()
        }, 320))
      }, 1800))
    }

    const timer = setTimeout(showRecipe, 100)
    timers.push(timer)
    return () => timers.forEach(clearTimeout)
  }, [])

  const recipe = RECIPE_ITEMS[index]

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
        <Badge variant="default" className="text-[10px] h-5">{t(recipe.tagKey)}</Badge>
      </div>
    </div>
  )
}

// Static todo list for TodosPreview — nameKey is translated, priority/assignee are display-only
const TODO_ITEMS: { nameKey: string; priority: string; assignee: string | null }[] = [
  { nameKey: 'onboarding.preview.todoFixTap',       priority: 'High',   assignee: null },
  { nameKey: 'onboarding.preview.todoBuyGroceries', priority: 'Medium', assignee: 'AJ' },
  { nameKey: 'onboarding.preview.todoCallInsurance', priority: '',      assignee: null },
]

function TodosPreview() {
  const { t } = useTranslation()
  const [count, setCount] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []
    TODO_ITEMS.forEach((_, i) => {
      timers.push(setTimeout(() => setCount(i + 1), 150 + i * 150))
    })
    function cycle(next: boolean, delay: number) {
      const timer = setTimeout(() => {
        setDone(next)
        cycle(!next, next ? 1800 : 1400)
      }, delay)
      timers.push(timer)
    }
    cycle(true, 1100)
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {TODO_ITEMS.map(({ nameKey, priority, assignee }, i) => (
        <div
          key={nameKey}
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
            {t(nameKey)}
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

// Static event list for CalendarPreview — nameKey and dayKey are translated via t()
const CALENDAR_EVENTS: { nameKey: string; dayKey: string; time: string }[] = [
  { nameKey: 'onboarding.preview.eventDoctor',      dayKey: 'home.today',    time: '10:00' },
  { nameKey: 'onboarding.preview.eventFamilyDinner', dayKey: 'home.tomorrow', time: '7:00 PM' },
]

function CalendarPreview() {
  const { t } = useTranslation()
  // phase: 'entering' items slide in, 'exiting' items slide out downward, 'reset' instant hide
  const [phase, setPhase] = useState<'entering' | 'exiting' | 'reset'>('entering')
  const [count, setCount] = useState(0)

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = []

    function runCycle() {
      setPhase('entering')
      setCount(0)

      // Stagger items in
      CALENDAR_EVENTS.forEach((_, i) => {
        timers.push(setTimeout(() => setCount(i + 1), 150 + i * 200))
      })

      // Hold, then exit downward
      const exitStart = 150 + CALENDAR_EVENTS.length * 200 + 1000
      timers.push(setTimeout(() => {
        setPhase('exiting')
        setCount(0)
        CALENDAR_EVENTS.forEach((_, i) => {
          timers.push(setTimeout(() => setCount(i + 1), i * 150))
        })
      }, exitStart))

      // Reset and loop
      const resetStart = exitStart + CALENDAR_EVENTS.length * 150 + 350
      timers.push(setTimeout(() => {
        setPhase('reset')
        setCount(0)
        timers.push(setTimeout(runCycle, 80))
      }, resetStart))
    }

    runCycle()
    return () => timers.forEach(clearTimeout)
  }, [])

  return (
    <div className="w-full bg-card rounded-lg border border-border overflow-hidden shadow-sm">
      {CALENDAR_EVENTS.map(({ nameKey, dayKey, time }, i) => {
        const entered = phase === 'entering' && i < count
        const held = phase === 'exiting' && i >= count
        const exited = phase === 'exiting' && i < count

        const visible = entered || held
        const slideDown = exited || phase === 'reset'

        return (
          <div
            key={nameKey}
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
            <p className="text-sm flex-1 truncate">{t(nameKey)}</p>
            <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
              {t(dayKey)}
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
