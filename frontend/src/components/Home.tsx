import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { RotateCcw, ExternalLink, ChevronUp, ChevronDown, Link2, FileText, Repeat2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { cn, memberInitials, safeUrl, formatFrequency } from '@/lib/utils'
import { toast } from 'sonner'
import { useShoppingList, useRecipes, useTodos, useCalendarEvents, useGoogleStatus, useToggleShoppingList, useUpdateTodo, useHouseholdSettings, useConceptList } from '../api'
import type { Item } from '../api/types'
import { useNavigate } from 'react-router-dom'
import { ItemRow } from './ItemRow'
import { SwipeAction } from './SwipeAction'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/hooks/useLocale'
import { makeDayLabel } from '@/lib/dayLabel'

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center mb-1">
      <span className="flex-1 text-xs font-medium tracking-widest uppercase text-muted-foreground leading-none">
        {label}
      </span>
      {action}
    </div>
  )
}

function SectionCard({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] overflow-hidden',
        onClick && 'cursor-pointer transition-opacity active:opacity-75'
      )}
    >
      {children}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="px-4 py-5 text-center">
      <p className="text-sm text-muted-foreground/60">{text}</p>
    </div>
  )
}

const COLLAPSE_DURATION_MS = 220
// How long the toast stays up; mutation fires 100ms after this.
const TOAST_DURATION_MS = 4000

// ── Date helpers ──────────────────────────────────────────────────────────────

function makeTimeLabel(locale: string) {
  return (dateStr: string): string | null => {
    if (!dateStr.includes('T')) return null
    return new Date(dateStr).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
  }
}

function useCollapsible() {
  const [collapsed, setCollapsed] = useState(false)
  const [contentVisible, setContentVisible] = useState(true)
  const handleToggle = () => {
    if (collapsed) { setContentVisible(true); setCollapsed(false) }
    else setCollapsed(true)
  }
  return { collapsed, contentVisible, handleToggle, onCollapsed: () => setContentVisible(false) }
}

function CollapsibleBody({ collapsed, onCollapsed, children }: {
  collapsed: boolean
  onCollapsed: () => void
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateRows: collapsed ? '0fr' : '1fr',
        transition: `grid-template-rows ${COLLAPSE_DURATION_MS}ms ease, opacity ${COLLAPSE_DURATION_MS}ms ease`,
        opacity: collapsed ? 0 : 1,
      }}
      onTransitionEnd={e => { if (e.target === e.currentTarget && collapsed) onCollapsed() }}
    >
      <div style={{ overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}

function useDeferredAction(
  mutate: (id: string) => void,
  formatMessage: (name: string) => string,
) {
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  const toastIds = useRef<Map<string, string | number>>(new Map())
  const mutateRef = useRef(mutate)
  useEffect(() => { mutateRef.current = mutate })

  useEffect(() => {
    const t = timers.current
    const tid = toastIds.current
    return () => {
      t.forEach((timer, id) => {
        clearTimeout(timer)
        mutateRef.current(id)
        const toastId = tid.get(id)
        if (toastId !== undefined) toast.dismiss(toastId)
      })
    }
  }, [])

  const trigger = useCallback((id: string, name: string) => {
    if (timers.current.has(id)) return
    setRemovingIds(prev => new Set(prev).add(id))
    const timer = setTimeout(() => {
      mutateRef.current(id)
      setRemovingIds(prev => { const s = new Set(prev); s.delete(id); return s })
      timers.current.delete(id)
      toastIds.current.delete(id)
    }, TOAST_DURATION_MS + 100)
    timers.current.set(id, timer)
    const toastId = toast(formatMessage(name), {
      duration: TOAST_DURATION_MS,
      action: {
        label: 'Undo',
        onClick: () => {
          const t = timers.current.get(id)
          if (t !== undefined) { clearTimeout(t); timers.current.delete(id) }
          toastIds.current.delete(id)
          setRemovingIds(prev => { const s = new Set(prev); s.delete(id); return s })
        },
      },
    })
    toastIds.current.set(id, toastId)
  }, [formatMessage])

  return { removingIds, trigger }
}

function CardHeader({
  label,
  showBorder,
  collapsed,
  onToggle,
  seeAllLabel,
  onSeeAll,
}: {
  label: string
  showBorder: boolean
  collapsed: boolean
  onToggle: () => void
  seeAllLabel?: string
  onSeeAll?: () => void
}) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex items-center px-4 py-3', showBorder && 'border-b border-border')}>
      <span className="flex-1 text-xs font-medium tracking-widest uppercase text-muted-foreground leading-none">
        {label}
      </span>
      {onSeeAll && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onSeeAll() }}
          className="text-xs font-semibold text-primary cursor-pointer mr-3"
        >
          {seeAllLabel ?? t('home.seeAll')}
        </button>
      )}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onToggle() }}
        className="text-muted-foreground/60 -mr-1"
        aria-label={collapsed ? t('home.expandSection') : t('home.collapseSection')}
      >
        {collapsed
          ? <ChevronDown className="size-4" />
          : <ChevronUp className="size-4" />}
      </button>
    </div>
  )
}

// ── Calendar preview ──────────────────────────────────────────────────────────

function CalendarSection({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dayLabel = useMemo(() => makeDayLabel(locale, t('home.today'), t('home.tomorrow'), 'weekday'), [locale, t])
  const timeLabel = useMemo(() => makeTimeLabel(locale), [locale])
  const { collapsed, contentVisible, handleToggle, onCollapsed } = useCollapsible()
  const { data: googleStatus } = useGoogleStatus()
  const timeMin = useMemo(() => new Date().toISOString(), [])
  const timeMax = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + 14)
    return d.toISOString()
  }, [])

  const { data: events, isLoading } = useCalendarEvents(timeMin, timeMax)

  const upcoming = useMemo(() => {
    if (!events) return []
    const now = new Date()
    return events
      .filter(e => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3)
  }, [events])

  if (!googleStatus?.connected && !isLoading && upcoming.length === 0) return null

  return (
    <div className="mb-6">
      <SectionCard>
        <CardHeader
          label={t('home.comingUp')}
          showBorder={contentVisible}
          collapsed={collapsed}
          onToggle={handleToggle}
          onSeeAll={onNavigate}
        />
        <CollapsibleBody collapsed={collapsed} onCollapsed={onCollapsed}>
          {isLoading ? (
            <div className="px-4">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('flex gap-3 items-center py-3', i > 0 && 'border-t border-border')}>
                  <Skeleton className="h-3.5 w-[55%]" />
                  <Skeleton className="h-3.5 w-8 ml-auto" />
                  <Skeleton className="h-3.5 w-10" />
                </div>
              ))}
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState text={t('home.noUpcomingEvents')} />
          ) : (
            upcoming.map((event, i) => {
              const time = timeLabel(event.start)
              return (
                <div
                  key={event.id}
                  className={cn(
                    'px-4 py-3 flex items-center gap-3',
                    i > 0 && 'border-t border-border'
                  )}
                >
                  <p className="text-sm flex-1 truncate">{event.title}</p>
                  <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full whitespace-nowrap">
                    {dayLabel(event.start)}
                  </span>
                  {time && (
                    <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                      {time}
                    </span>
                  )}
                </div>
              )
            })
          )}
        </CollapsibleBody>
      </SectionCard>
    </div>
  )
}

// ── Todo summary ──────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

function TodoSection({ onSeeAll }: { onSeeAll: () => void }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dayLabel = useMemo(() => makeDayLabel(locale, t('home.today'), t('home.tomorrow'), 'date'), [locale, t])
  const { collapsed, contentVisible, handleToggle, onCollapsed } = useCollapsible()
  const { data: todos, isLoading } = useTodos()
  const { data: settings } = useHouseholdSettings()
  const members = settings?.members ?? []
  const { data: categories = [] } = useConceptList('todo-categories')
  const updateTodo = useUpdateTodo()
  const formatTodoDone = useCallback((name: string) => t('home.markedAsDone', { name }), [t])
  const { removingIds: removingTodoIds, trigger: handleDone } = useDeferredAction(
    (id) => updateTodo.mutate({ id, status: 'Done' }),
    formatTodoDone,
  )

  const { topTodos, remaining } = useMemo(() => {
    if (!todos) return { topTodos: [], remaining: 0 }
    const incomplete = todos
      .filter(t => t.status !== 'Done' && !removingTodoIds.has(t.id))
      .sort((a, b) => {
        const hasDueA = !!a.due, hasDueB = !!b.due
        if (hasDueA !== hasDueB) return hasDueA ? -1 : 1
        if (hasDueA && hasDueB) {
          const dateCmp = a.due!.localeCompare(b.due!)
          if (dateCmp !== 0) return dateCmp
          const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 3
          const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 3
          return pa - pb
        }
        const hasPriA = !!a.priority, hasPriB = !!b.priority
        if (hasPriA !== hasPriB) return hasPriA ? -1 : 1
        const pa = PRIORITY_ORDER[a.priority ?? ''] ?? 3
        const pb = PRIORITY_ORDER[b.priority ?? ''] ?? 3
        return pa - pb
      })
    return { topTodos: incomplete.slice(0, 3), remaining: Math.max(0, incomplete.length - 3) }
  }, [todos, removingTodoIds])

  return (
    <div className="mb-6">
      <SectionCard>
        <CardHeader
          label={t('home.todos')}
          showBorder={contentVisible}
          collapsed={collapsed}
          onToggle={handleToggle}
          onSeeAll={onSeeAll}
        />
        <CollapsibleBody collapsed={collapsed} onCollapsed={onCollapsed}>
          {isLoading ? (
            <div className="px-4">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('flex items-center gap-3 py-3', i > 0 && 'border-t border-border')}>
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-4 w-10 ml-auto" />
                </div>
              ))}
            </div>
          ) : topTodos.length === 0 ? (
            <EmptyState text={t('home.allCaughtUp')} />
          ) : (
            <>
              {topTodos.map((todo, i) => {
                const cat = categories.find(c => c.id === todo.categoryId) ?? null
                const assignees = todo.assignedTo ?? []
                const freqLabel = formatFrequency(todo.frequency, todo.frequencyInterval, todo.frequencyDays, t)
                return (
                  <div key={todo.id} className={cn(i > 0 && 'border-t border-border')}>
                    <SwipeAction onAction={() => handleDone(todo.id, todo.name)}>
                    <ItemRow
                      variant="todo"
                      name={todo.name}
                      removing={removingTodoIds.has(todo.id)}
                      onDone={() => handleDone(todo.id, todo.name)}
                      meta={
                        <>
                          {todo.priority && (
                            <Badge
                              variant={todo.priority === 'High' ? 'destructive' : todo.priority === 'Medium' ? 'secondary' : 'outline'}
                              className="text-[10px] h-[18px]"
                            >
                              {todo.priority}
                            </Badge>
                          )}
                          {todo.due && (
                            <span className="text-xs font-semibold text-primary whitespace-nowrap">
                              {dayLabel(todo.due)}
                            </span>
                          )}
                          {cat && (
                            <Badge variant="outline" className="text-[0.6rem] h-4 px-1 py-0 font-normal">
                              {cat.name}
                            </Badge>
                          )}
                          {assignees.length > 0 && (
                            <div className="flex -space-x-1">
                              {assignees.slice(0, 3).map(uid => {
                                const m = members.find(m => m.clerkUserId === uid)
                                if (!m) return null
                                return (
                                  <Avatar key={uid} className="size-4 shrink-0 ring-1 ring-background">
                                    {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.displayName ?? ''} />}
                                    <AvatarFallback className="text-[0.5rem]">{memberInitials(m)}</AvatarFallback>
                                  </Avatar>
                                )
                              })}
                            </div>
                          )}
                          {safeUrl(todo.url) && (
                            <a
                              href={safeUrl(todo.url)}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={e => e.stopPropagation()}
                              aria-label="Open link"
                            >
                              <Link2 className="size-3 text-muted-foreground shrink-0" />
                            </a>
                          )}
                          {todo.notes && <FileText className="size-3 text-muted-foreground shrink-0" />}
                          {freqLabel && (
                            <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
                              <Repeat2 className="size-3" />
                              {freqLabel}
                            </span>
                          )}
                        </>
                      }
                    />
                    </SwipeAction>
                  </div>
                )
              })}
              {remaining > 0 && (
                <div
                  onClick={onSeeAll}
                  className="px-4 py-2.5 border-t border-border cursor-pointer"
                >
                  <span className="text-xs text-muted-foreground">{t('home.moreItems', { count: remaining })}</span>
                </div>
              )}
            </>
          )}
        </CollapsibleBody>
      </SectionCard>
    </div>
  )
}

// ── Shopping summary ──────────────────────────────────────────────────────────

interface ShoppingPlan {
  topItems: Item[]
  remaining: number
}

function useShoppingPlan(items: Item[] | undefined): ShoppingPlan {
  return useMemo(() => {
    const empty: ShoppingPlan = { topItems: [], remaining: 0 }
    if (!items?.length) return empty

    // Build store → items map
    const storeMap = new Map<string, Item[]>()
    for (const item of items) {
      for (const s of item.supermarkets) {
        if (!storeMap.has(s)) storeMap.set(s, [])
        storeMap.get(s)!.push(item)
      }
    }

    const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

    // No stores assigned to any item — sort all alphabetically
    if (storeMap.size === 0) {
      const sorted = [...items].sort(byName)
      return { topItems: sorted.slice(0, 3), remaining: Math.max(0, sorted.length - 3) }
    }

    const storeRanked = [...storeMap.entries()].sort((a, b) => b[1].length - a[1].length)
    const [firstName, firstItems] = storeRanked[0]

    // Only one store, or one strictly dominant store
    if (storeRanked.length === 1 || firstItems.length > storeRanked[1][1].length) {
      const storeFirst = [...firstItems].sort(byName)
      const rest = [...items]
        .filter(i => !i.supermarkets.includes(firstName))
        .sort(byName)
      const ordered = [...storeFirst, ...rest]
      return { topItems: ordered.slice(0, 3), remaining: Math.max(0, items.length - 3) }
    }

    // Two or more stores tied for first place
    const [secondName, secondItems] = storeRanked[1]

    // Check if the two top stores share exactly the same items
    const firstSet = new Set(firstItems.map(i => i.id))
    const secondSet = new Set(secondItems.map(i => i.id))
    const sameItems =
      firstSet.size === secondSet.size &&
      [...firstSet].every(id => secondSet.has(id))

    let ordered: Item[]
    if (sameItems) {
      // Shared items first alphabetically, then remaining alphabetically
      const sharedSorted = [...firstItems].sort(byName)
      const rest = [...items]
        .filter(i => !firstSet.has(i.id))
        .sort(byName)
      ordered = [...sharedSorted, ...rest]
    } else {
      // Different items — sort by store name order; the alphabetically earlier store's
      // exclusive items come first, then the other store's exclusive items, then the rest
      const [storeA, storeB] =
        firstName.localeCompare(secondName) <= 0
          ? [firstName, secondName]
          : [secondName, firstName]
      const storeAItems = (storeMap.get(storeA) ?? [])
        .filter(i => !i.supermarkets.includes(storeB))
        .sort(byName)
      const storeBItems = (storeMap.get(storeB) ?? [])
        .filter(i => !i.supermarkets.includes(storeA))
        .sort(byName)
      const shared = items
        .filter(i => i.supermarkets.includes(storeA) && i.supermarkets.includes(storeB))
        .sort(byName)
      const rest = items
        .filter(i => !i.supermarkets.includes(storeA) && !i.supermarkets.includes(storeB))
        .sort(byName)
      ordered = [...storeAItems, ...storeBItems, ...shared, ...rest]
    }

    return { topItems: ordered.slice(0, 3), remaining: Math.max(0, items.length - 3) }
  }, [items])
}

function ShoppingSection({ onNavigate }: { onNavigate: () => void }) {
  const { t } = useTranslation()
  const { collapsed, contentVisible, handleToggle, onCollapsed } = useCollapsible()
  const { data: items, isLoading } = useShoppingList()
  const toggle = useToggleShoppingList()
  const formatShoppingRemoved = useCallback((name: string) => t('home.removedFromList', { name }), [t])
  const { removingIds, trigger: handleRemove } = useDeferredAction(
    (id) => toggle.mutate({ id, onShoppingList: false }),
    formatShoppingRemoved,
  )
  const filteredItems = useMemo(
    () => items?.filter(i => !removingIds.has(i.id)),
    [items, removingIds],
  )
  const plan = useShoppingPlan(filteredItems)

  const remainderLabel = useMemo(() => {
    if (!items) return null
    if (plan.remaining === 0) return null
    const topIds = new Set(plan.topItems.map(i => i.id))
    const remainderItems = items.filter(i => !topIds.has(i.id) && !removingIds.has(i.id))

    // Count per store; items with no supermarkets go to the "no store" bucket
    const storeCounts = new Map<string, number>()
    let noStoreCount = 0
    for (const item of remainderItems) {
      if (item.supermarkets.length === 0) {
        noStoreCount++
      } else {
        for (const store of item.supermarkets) {
          storeCounts.set(store, (storeCounts.get(store) ?? 0) + 1)
        }
      }
    }

    // If no item has a store, fall back to the plain "+N more" format
    if (storeCounts.size === 0) {
      return t('home.moreItems', { count: plan.remaining })
    }

    // Sort stores by their total count across the full list, not just the remainder
    const globalStoreTotals = new Map<string, number>()
    for (const item of items.filter(i => !removingIds.has(i.id))) {
      for (const store of item.supermarkets) {
        globalStoreTotals.set(store, (globalStoreTotals.get(store) ?? 0) + 1)
      }
    }
    const sortedStores = [...storeCounts.entries()].sort(
      (a, b) => (globalStoreTotals.get(b[0]) ?? 0) - (globalStoreTotals.get(a[0]) ?? 0)
    )
    const parts = sortedStores.map(([store, count]) => t('home.moreInStore', { count, store }))
    if (noStoreCount > 0) {
      parts.push(t('home.moreItems', { count: noStoreCount }))
    }
    return parts.join(', ')
  }, [items, plan.topItems, removingIds, plan.remaining])

  return (
    <div className="mb-6">
      <SectionCard>
        <CardHeader
          label={t('home.shoppingList')}
          showBorder={contentVisible}
          collapsed={collapsed}
          onToggle={handleToggle}
          onSeeAll={onNavigate}
        />
        <CollapsibleBody collapsed={collapsed} onCollapsed={onCollapsed}>
          {isLoading ? (
            <div className="px-4">
              {[0, 1, 2].map(i => (
                <div key={i} className={cn('py-2.5 flex items-center gap-3', i > 0 && 'border-t border-border')}>
                  <div className="flex-1">
                    <Skeleton className="h-3.5 w-[55%]" />
                    <Skeleton className="h-3 w-[28%] mt-1" />
                  </div>
                  <Skeleton className="h-4 w-4 rounded-full shrink-0" />
                </div>
              ))}
            </div>
          ) : plan.topItems.length === 0 ? (
            <EmptyState text={t('home.nothingOnTheList')} />
          ) : (
            <>
              {plan.topItems.map((item, i) => (
                <div key={item.id} className={cn(i > 0 && 'border-t border-border')}>
                  <SwipeAction onAction={() => handleRemove(item.id, item.name)}>
                    <ItemRow
                      variant="shopping"
                      name={item.name}
                      subtitle={item.supermarkets.length > 0 ? item.supermarkets.join(', ') : undefined}
                      removing={removingIds.has(item.id)}
                      onRemove={() => handleRemove(item.id, item.name)}
                    />
                  </SwipeAction>
                </div>
              ))}
              {remainderLabel && (
                <div onClick={onNavigate} className="px-4 py-2.5 border-t border-border cursor-pointer">
                  <span className="text-xs text-muted-foreground truncate block">{remainderLabel}</span>
                </div>
              )}
            </>
          )}
        </CollapsibleBody>
      </SectionCard>
    </div>
  )
}

// ── Random recipe ─────────────────────────────────────────────────────────────

function RecipeSection({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { t } = useTranslation()
  const { data: recipes, isLoading } = useRecipes()
  const [seed, setSeed] = useState(() => Math.random())
  const [recentImgError, setRecentImgError] = useState(false)

  const recipe = useMemo(() => {
    if (!recipes?.length) return null
    return recipes[Math.floor(seed * recipes.length) % recipes.length]
  }, [recipes, seed])

  return (
    <div className="mb-6">
      <SectionHeader
        label={t('home.cookThisWeek')}
        action={
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSeed(Math.random())}
            className="text-muted-foreground/60 -mr-1"
          >
            <RotateCcw className="size-4" />
          </Button>
        }
      />
      {isLoading ? (
        <div className="bg-card rounded-lg border border-border overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)]">
          <Skeleton className="w-full aspect-video" />
          <div className="p-3">
            <Skeleton className="h-5 w-[70%] mb-2" />
            <div className="flex gap-1">
              <Skeleton className="h-5 w-15 rounded-full" />
              <Skeleton className="h-5 w-13 rounded-full" />
            </div>
          </div>
        </div>
      ) : !recipe ? (
        <SectionCard><EmptyState text={t('home.noRecipesYet')} /></SectionCard>
      ) : (
        <SectionCard onClick={() => onNavigate(recipe.id)}>
          <div className="relative w-full aspect-video">
            <div className="absolute inset-0 bg-accent flex items-center justify-center text-4xl">
              {recentImgError ? '🖼️' : '🍽'}
            </div>
            {recipe.coverPhotoUrl && (
              <>
                <Skeleton className="absolute inset-0 w-full h-full z-[1]" />
                <img
                  src={recipe.coverPhotoUrl}
                  alt={recipe.name}
                  decoding="async"
                  className="absolute inset-0 w-full h-full object-cover block opacity-0 transition-opacity duration-[250ms] z-[2]"
                  onLoad={e => {
                    const img = e.target as HTMLImageElement
                    img.style.opacity = '1';
                    (img.previousElementSibling as HTMLElement | null)?.style.setProperty('display', 'none')
                  }}
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    (img.previousElementSibling as HTMLElement | null)?.style.setProperty('display', 'none')
                    setRecentImgError(true)
                  }}
                />
              </>
            )}
          </div>
          <div className="p-3">
            <p className="text-base font-semibold mb-2">{recipe.name}</p>
            <div className="flex gap-1 flex-wrap">
              {recipe.type && <Badge variant="default" className="text-[11px] h-5">{recipe.type}</Badge>}
                {recipe.url && (
                  <a
                    href={recipe.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="text-[11px] h-5 px-1.5 inline-flex items-center rounded-full border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="size-2.5 mr-1" />
                    {t('home.recipe')}
                  </a>
                )}
            </div>
          </div>
        </SectionCard>
      )}
    </div>
  )
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()
  return (
    <div className="pb-2">
      <CalendarSection onNavigate={() => navigate('/calendar')} />
      <TodoSection     onSeeAll={() => navigate('/todos')} />
      <ShoppingSection onNavigate={() => navigate('/shopping')} />
      <RecipeSection   onNavigate={id => navigate(`/recipes/${id}`)} />
    </div>
  )
}
