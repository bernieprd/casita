import { useState, useMemo } from 'react'
import { RotateCcw } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useShoppingList, useRecipes, useTodos, useCalendarEvents, useGoogleStatus } from '../api'
import { useNavigate } from 'react-router-dom'

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

// ── Calendar preview ──────────────────────────────────────────────────────────

function dayLabel(dateStr: string, includeDatePart = false): string {
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  if (includeDatePart)
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function timeLabel(dateStr: string): string | null {
  if (!dateStr.includes('T')) return null
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function CalendarSection({ onNavigate }: { onNavigate: () => void }) {
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
      <SectionHeader
        label="Coming up"
        action={
          <button
            onClick={onNavigate}
            className="text-xs font-semibold text-primary cursor-pointer"
          >
            See all
          </button>
        }
      />
      <SectionCard>
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
          <EmptyState text="No upcoming events" />
        ) : (
          upcoming.map((event, i) => (
            <div
              key={event.id}
              className={cn(
                'px-4 py-3 flex items-center gap-3',
                i > 0 && 'border-t border-border'
              )}
            >
              <p className="text-sm flex-1 truncate">{event.title}</p>
              <span className="text-xs font-semibold text-primary whitespace-nowrap">
                {dayLabel(event.start)}
              </span>
              {timeLabel(event.start) && (
                <span className="text-xs text-muted-foreground/60 whitespace-nowrap">
                  {timeLabel(event.start)}
                </span>
              )}
            </div>
          ))
        )}
      </SectionCard>
    </div>
  )
}

// ── Todo summary ──────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

function TodoSection({ onSeeAll }: { onSeeAll: () => void }) {
  const { data: todos, isLoading } = useTodos()

  const { topTodos, remaining } = useMemo(() => {
    if (!todos) return { topTodos: [], remaining: 0 }
    const incomplete = todos
      .filter(t => t.status !== 'Done')
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
  }, [todos])

  return (
    <div className="mb-6">
      <SectionHeader
        label="To do"
        action={
          <button
            onClick={onSeeAll}
            className="text-xs font-semibold text-primary cursor-pointer"
          >
            See all
          </button>
        }
      />
      <SectionCard>
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
          <EmptyState text="All caught up" />
        ) : (
          <>
            {topTodos.map((todo, i) => (
              <div
                key={todo.id}
                className={cn(
                  'px-4 py-3 flex items-center gap-3',
                  i > 0 && 'border-t border-border'
                )}
              >
                <p className="text-sm truncate flex-1">{todo.name}</p>
                {todo.priority && (
                  <Badge
                    variant={todo.priority === 'High' ? 'destructive' : todo.priority === 'Medium' ? 'secondary' : 'outline'}
                    className="text-[10px] h-[18px] shrink-0"
                  >
                    {todo.priority}
                  </Badge>
                )}
                {todo.due && (
                  <span className="text-xs font-semibold text-primary whitespace-nowrap shrink-0">
                    {dayLabel(todo.due, true)}
                  </span>
                )}
              </div>
            ))}
            {remaining > 0 && (
              <div
                onClick={onSeeAll}
                className="px-4 py-2.5 border-t border-border cursor-pointer"
              >
                <span className="text-xs text-muted-foreground">+{remaining} more</span>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}

// ── Shopping summary ──────────────────────────────────────────────────────────

function ShoppingSection({ onNavigate }: { onNavigate: () => void }) {
  const { data: items, isLoading } = useShoppingList()

  const storeBreakdown = useMemo(() => {
    if (!items?.length) return { count: 0, stores: [], unassigned: 0 }
    const countMap: Record<string, number> = {}
    let unassigned = 0
    for (const item of items) {
      if (item.supermarkets.length === 0) {
        unassigned++
      } else {
        for (const s of item.supermarkets) {
          countMap[s] = (countMap[s] ?? 0) + 1
        }
      }
    }
    const stores = Object.entries(countMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
    return { count: items.length, stores, unassigned }
  }, [items])

  const allUnassigned = storeBreakdown.count > 0 && storeBreakdown.stores.length === 0

  return (
    <div className="mb-6">
      <SectionHeader
        label="Shopping list"
        action={
          <button
            onClick={onNavigate}
            className="text-xs font-semibold text-primary cursor-pointer"
          >
            See all
          </button>
        }
      />
      <SectionCard>
        {isLoading ? (
          <div className="px-4 py-3.5">
            <Skeleton className="h-[18px] w-[110px] mb-2" />
            <Skeleton className="h-3.5 w-4/5 mb-1.5" />
            <Skeleton className="h-3.5 w-3/5" />
          </div>
        ) : storeBreakdown.count === 0 ? (
          <EmptyState text="Nothing on the list" />
        ) : (
          <div className="px-4 py-3.5">
            <p className="text-sm font-semibold mb-2">
              {`${storeBreakdown.count} item${storeBreakdown.count !== 1 ? 's' : ''} to buy`}
            </p>
            {allUnassigned && (
              <p className="text-xs text-muted-foreground">
                Add stores to your items for guidance
              </p>
            )}
            {storeBreakdown.stores.map((store, i) => (
              <div key={store.name} className="flex items-center mb-1">
                <span
                  className={cn(
                    'text-xs flex-1',
                    i === 0 ? 'font-bold text-primary' : 'font-normal text-foreground'
                  )}
                >
                  {i === 0 ? '★ ' : ''}
                  {store.name}
                </span>
                <span
                  className={cn(
                    'text-xs',
                    i === 0 ? 'font-bold text-primary' : 'font-normal text-muted-foreground'
                  )}
                >
                  {store.count}
                </span>
              </div>
            ))}
            {storeBreakdown.unassigned > 0 && storeBreakdown.stores.length > 0 && (
              <div className="flex items-center">
                <span className="text-xs text-muted-foreground/60 flex-1">Not assigned</span>
                <span className="text-xs text-muted-foreground/60">{storeBreakdown.unassigned}</span>
              </div>
            )}
          </div>
        )}
      </SectionCard>
    </div>
  )
}

// ── Random recipe ─────────────────────────────────────────────────────────────

function RecipeSection({ onNavigate }: { onNavigate: (id: string) => void }) {
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
        label="Cook this week"
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
        <SectionCard><EmptyState text="No recipes yet" /></SectionCard>
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
              {recipe.day  && <Badge variant="outline" className="text-[11px] h-5">{recipe.day}</Badge>}
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
