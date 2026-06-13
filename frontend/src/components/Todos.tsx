import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { toast } from 'sonner'
import { ChevronUp, ChevronDown, Link2, FileText, Repeat2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDroppable,
  rectIntersection,
  pointerWithin,
  type DragStartEvent,
  type DragOverEvent,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo, useHouseholdSettings, useConceptList } from '../api'
import { useReorderTodos } from '../api/todos'
import type { Todo, ConceptItem, HouseholdSettings } from '../api'
import { useTodoWorkflow } from '../api/household'
import { memberInitials, safeUrl, formatFrequency } from '@/lib/utils'
import GuidedImport from './GuidedImport'
import { ImportModal } from './ImportModal'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/hooks/useLocale'

// ── Constants ─────────────────────────────────────────────────────────────────

const SIMPLE_STATUSES = ['Todo', 'Done'] as const
const BOARD_STATUSES  = ['Todo', 'In progress', 'Blocked', 'Done'] as const

const PRIORITY_CHIP_CLASSES: Record<string, string> = {
  High:   'bg-destructive/10 text-destructive border-destructive/30',
  Medium: 'bg-yellow-50 dark:bg-yellow-950/30 text-orange-700 dark:text-orange-400',
  Low:    'bg-secondary text-secondary-foreground',
}

const BLOCKED_HEADER_CLASS = 'text-amber-600 dark:text-amber-400'

const UNDO_DURATION_MS = 4000

const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  'Todo':        'todos.status.todo',
  'Done':        'todos.status.done',
  'In progress': 'todos.status.inProgress',
  'Blocked':     'todos.status.blocked',
}

interface PendingDelete {
  ids: string[]
  timeoutId: ReturnType<typeof setTimeout>
}

type Member = HouseholdSettings['members'][number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDue(due: string | null, locale: string, today: string, tomorrow: string): string | null {
  if (!due) return null
  const d = new Date(due + 'T00:00:00')
  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - todayDate.getTime()) / 86400000)
  if (diff === 0) return today
  if (diff === 1) return tomorrow
  return d.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })
}

// ── Priority chip ─────────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority: string | null }) {
  const { t } = useTranslation()
  if (!priority) return null
  const cls = PRIORITY_CHIP_CLASSES[priority] ?? 'bg-secondary text-secondary-foreground'
  const label = t(`priority.${priority.toLowerCase()}`, { defaultValue: priority })
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[0.65rem] font-semibold leading-none border ${cls}`}>
      {label}
    </span>
  )
}

// ── Todo card ─────────────────────────────────────────────────────────────────

interface TodoCardProps {
  todo: Todo
  members: Member[]
  categories: ConceptItem[]
  onOpen: (todo: Todo) => void
  isOverlay?: boolean
  style?: React.CSSProperties
  dragHandleProps?: Record<string, unknown>
}

function TodoCard({
  todo,
  members,
  categories,
  onOpen,
  isOverlay,
  style,
  dragHandleProps,
}: TodoCardProps) {
  const { t } = useTranslation()
  const locale = useLocale()
  const isDueToday = useMemo(() => {
    if (!todo.due) return false
    const d = new Date(todo.due + 'T00:00:00')
    const todayDate = new Date()
    todayDate.setHours(0, 0, 0, 0)
    return d.getTime() === todayDate.getTime()
  }, [todo.due])
  const dueLabel = useMemo(
    () => formatDue(todo.due, locale, t('home.today'), t('home.tomorrow')),
    [todo.due, locale, t],
  )
  const isDone = todo.status === 'Done'
  const category = todo.categoryId ? categories.find(c => c.id === todo.categoryId) : null
  const assignees = todo.assignedTo ?? []
  const freqLabel = formatFrequency(todo.frequency, todo.frequencyInterval, todo.frequencyDays, t)
  const todoUrl = safeUrl(todo.url)

  return (
    <div
      style={style}
      className={`group bg-card border border-border rounded-lg p-3 cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all select-none ${isOverlay ? 'shadow-lg rotate-1 opacity-95' : ''}`}
      onClick={() => onOpen(todo)}
      {...(dragHandleProps ?? {})}
    >
      <p className={`text-sm font-medium leading-snug ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
        {todo.name}
      </p>

      {(todo.priority || dueLabel || category || assignees.length > 0 || freqLabel || todoUrl || todo.notes) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <PriorityChip priority={todo.priority} />
          {dueLabel && (
            <span className={`text-xs shrink-0 font-medium ${isDueToday ? 'text-destructive' : 'text-muted-foreground'}`}>
              {dueLabel}
            </span>
          )}
          {category && (
            <Badge variant="outline" className="text-[0.6rem] h-4 px-1 py-0 font-normal">
              {category.name}
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
          {freqLabel && (
            <span className="flex items-center gap-0.5 text-xs text-muted-foreground shrink-0">
              <Repeat2 className="size-3" />
              {freqLabel}
            </span>
          )}
          {todoUrl && (
            <a
              href={todoUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              aria-label={t('common.openLink')}
            >
              <Link2 className="size-3 text-muted-foreground shrink-0" />
            </a>
          )}
          {todo.notes && <FileText className="size-3 text-muted-foreground shrink-0" />}
        </div>
      )}
    </div>
  )
}

// ── Sortable card wrapper ─────────────────────────────────────────────────────

interface SortableCardProps {
  todo: Todo
  members: Member[]
  categories: ConceptItem[]
  onOpen: (todo: Todo) => void
}

function SortableCard({ todo, members, categories, onOpen }: SortableCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: todo.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <TodoCard todo={todo} members={members} categories={categories} onOpen={onOpen} />
    </div>
  )
}

// ── Clear done confirmation ───────────────────────────────────────────────────

interface ClearDoneConfirmProps {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

function ClearDoneConfirm({ open, onConfirm, onCancel }: ClearDoneConfirmProps) {
  const { t } = useTranslation()
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={o => { if (!o) onCancel() }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>{t('todos.clearAllDone')}</DrawerTitle>
            <p className="text-sm text-muted-foreground">
              {t('todos.clearAllDescription')}
            </p>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="destructive" onClick={onConfirm}>{t('todos.clearAll')}</Button>
            <Button variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel() }}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>{t('todos.clearAllDone')}</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-sm text-muted-foreground">
          {t('todos.clearAllDescription')}
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>{t('common.cancel')}</Button>
          <Button variant="destructive" onClick={onConfirm}>{t('todos.clearAll')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Kanban column ─────────────────────────────────────────────────────────────

interface KanbanColumnProps {
  status: string
  todos: Todo[]
  members: Member[]
  categories: ConceptItem[]
  onOpen: (todo: Todo) => void
  onClearDone?: () => void
  isOver?: boolean
}

function KanbanColumn({ status, todos, members, categories, onOpen, onClearDone, isOver }: KanbanColumnProps) {
  const { t } = useTranslation()
  // Primary droppable — lives on the card-list div inside CollapsibleContent.
  // This is the main drop target when the column is expanded.
  const { setNodeRef } = useDroppable({ id: status })
  // Secondary droppable — lives on the header trigger so that drops can target
  // this column even when it is collapsed (CollapsibleContent has no rect then).
  const { setNodeRef: setHeaderDropRef } = useDroppable({ id: `${status}--header` })
  const isBlocked = status === 'Blocked'
  const isDone = status === 'Done'
  const [expanded, setExpanded] = useState(!isDone)
  const statusLabel = t(STATUS_TRANSLATION_KEYS[status] ?? status)

  const headerContent = (
    <>
      <span className={`flex-1 text-left text-xs font-semibold uppercase tracking-widest leading-none ${isBlocked ? BLOCKED_HEADER_CLASS : 'text-muted-foreground'}`}>
        {statusLabel}
      </span>
      <span className="text-xs text-muted-foreground mr-2">{todos.length}</span>
      {onClearDone && todos.length > 0 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onClearDone() }}
          className="mr-1.5 text-xs text-destructive hover:text-destructive/80 px-2 py-0.5 rounded"
        >
          {t('todos.clearAll')}
        </button>
      )}
    </>
  )

  const cardList = (
    <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
      {/* setNodeRef is placed on the card-list div so the droppable rect matches
          the actual card area rather than the outer wrapper, which fixes pointer
          detection for the middle columns ("In progress", "Blocked") where the
          Collapsible's overflow:hidden would otherwise clip hit-testing. */}
      <div ref={setNodeRef} className="flex flex-col gap-2 min-h-[4rem]">
        {todos.map(todo => (
          <SortableCard key={todo.id} todo={todo} members={members} categories={categories} onOpen={onOpen} />
        ))}
        {todos.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-border/50 h-16 flex items-center justify-center">
            <span className="text-xs text-muted-foreground/40">{t('todos.dropHere')}</span>
          </div>
        )}
      </div>
    </SortableContext>
  )

  return (
    <div className="mb-2">
      <Collapsible
        open={expanded}
        onOpenChange={setExpanded}
        className={`bg-card rounded-lg overflow-hidden border shadow-[0_1px_2px_rgba(0,0,0,.06)] transition-colors ${isOver ? 'border-primary/40' : 'border-border'}`}
      >
        <CollapsibleTrigger asChild>
          {/* setHeaderDropRef makes the header a valid drop target so that a
              collapsed column (whose card-list has no rect) can still receive
              drops — the handleDragOver/handleDragEnd logic maps the `--header`
              suffix back to the real status string. */}
          <div
            ref={setHeaderDropRef}
            role="button"
            tabIndex={0}
            aria-label={expanded ? t('todos.collapseStatus', { status: statusLabel }) : t('todos.expandStatus', { status: statusLabel })}
            aria-expanded={expanded}
            className="w-full flex items-center px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
            // Prevent the trigger from consuming pointer events during a drag so
            // dnd-kit can still detect the column droppable beneath it.
            data-no-dnd="true"
          >
            {headerContent}
            {expanded
              ? <ChevronUp className="size-4 text-muted-foreground" />
              : <ChevronDown className="size-4 text-muted-foreground" />
            }
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <Separator />
          <div className="p-3">
            {cardList}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TodosSkeleton({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div>
        {[3, 2].map((rows, gi) => (
          <div key={gi} className="bg-card rounded-lg overflow-hidden border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
            <div className="px-4 py-3">
              <Skeleton className="w-20 h-3.5" />
            </div>
            <Separator />
            <div className="p-3 flex flex-col gap-2">
              {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="rounded-lg border border-border p-3">
                  <Skeleton className="h-4" style={{ width: `${45 + i * 20}%` }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div>
      {[3, 2, 1, 1].map((rows, gi) => (
        <div key={gi} className="bg-card rounded-lg overflow-hidden border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
          <div className="px-4 py-3">
            <Skeleton className="w-20 h-3.5" />
          </div>
          <Separator />
          <div className="p-3 flex flex-col gap-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border p-3">
                <Skeleton className="h-4" style={{ width: `${45 + i * 20}%` }} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Todos({ setHeader }: { setHeader: (node: ReactNode | null) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isMobile = useIsMobile()

  const { data: todos, isLoading, error } = useTodos()
  const { data: workflowSettings } = useTodoWorkflow()
  const { data: householdSettings } = useHouseholdSettings()
  const { data: categoriesData } = useConceptList('todo-categories')

  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()
  const reorderTodos = useReorderTodos()

  const workflow = workflowSettings?.workflow ?? 'simple'
  const statuses: readonly string[] = workflow === 'board' ? BOARD_STATUSES : SIMPLE_STATUSES
  const members: Member[] = householdSettings?.members ?? []
  const categories: ConceptItem[] = categoriesData ?? []

  const [inputValue, setInputValue] = useState('')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overColumnStatus, setOverColumnStatus] = useState<string | null>(null)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set())

  const pendingDeleteRef = useRef<PendingDelete | null>(null)
  useEffect(() => { pendingDeleteRef.current = pendingDelete }, [pendingDelete])

  const inputValueRef = useRef(inputValue)
  useEffect(() => { inputValueRef.current = inputValue })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  // ── Delete helpers ──────────────────────────────────────────────────────────

  const commitDelete = useCallback((ids: string[]) => {
    ids.forEach(id => deleteTodo.mutate(id))
    setPendingDelete(null)
  }, [deleteTodo.mutate])

  function startDelete(ids: string[], message: string) {
    const existing = pendingDeleteRef.current
    if (existing) {
      clearTimeout(existing.timeoutId)
      commitDelete(existing.ids)
    }
    const timeoutId = setTimeout(() => commitDelete(ids), UNDO_DURATION_MS)
    const next: PendingDelete = { ids, timeoutId }
    setPendingDelete(next)
    pendingDeleteRef.current = next
    toast(message, {
      duration: UNDO_DURATION_MS,
      action: {
        label: t('common.undo'),
        onClick: () => {
          const cur = pendingDeleteRef.current
          if (!cur) return
          clearTimeout(cur.timeoutId)
          setPendingDelete(null)
          pendingDeleteRef.current = null
        },
      },
    })
  }

  // ── Add handler ─────────────────────────────────────────────────────────────

  const handleAdd = useCallback(() => {
    const name = inputValueRef.current.trim()
    if (!name) return
    setInputValue('')
    createTodo.mutate({ name })
  }, [createTodo.mutate])

  useEffect(() => {
    setHeader(
      <form
        onSubmit={e => { e.preventDefault(); handleAdd() }}
        className="flex-1 flex gap-2 px-2"
      >
        <Input
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder={t('todos.addPlaceholder')}
          autoComplete="off"
          aria-label={t('todos.newTodoName')}
          className="flex-1"
        />
        <Button type="submit" disabled={!inputValue.trim()} className="shrink-0">
          {t('todos.add')}
        </Button>
      </form>
    )
    return () => setHeader(null)
  }, [inputValue, setHeader, handleAdd, t])

  // ── Derived data ────────────────────────────────────────────────────────────

  const pendingDeleteIds = new Set(pendingDelete?.ids ?? [])

  const filterableCategories = useMemo(() => {
    if (!categories.length) return []
    return [...new Set(
      (todos ?? [])
        .filter(t => t.categoryId)
        .map(t => categories.find(c => c.id === t.categoryId)?.name)
        .filter((n): n is string => !!n)
    )].sort()
  }, [todos, categories])

  const displayTodos = useMemo(() => {
    if (!todos) return []
    if (selectedCategories.size === 0) return todos
    return todos.filter(t => {
      const cat = categories.find(c => c.id === t.categoryId)
      return cat && selectedCategories.has(cat.name)
    })
  }, [todos, categories, selectedCategories])

  function byStatus(status: string): Todo[] {
    return displayTodos.filter(t => (t.status ?? 'Todo') === status && !pendingDeleteIds.has(t.id))
  }

  function getColumnTodos(status: string): Todo[] {
    if (!activeId || !overColumnStatus) return byStatus(status)

    const activeTodo = (todos ?? []).find(t => t.id === activeId)
    if (!activeTodo) return byStatus(status)

    const activeStatus = activeTodo.status ?? 'Todo'
    if (activeStatus === overColumnStatus) return byStatus(status)

    if (status === activeStatus) {
      return byStatus(status).filter(t => t.id !== activeId)
    }
    if (status === overColumnStatus) {
      return [...byStatus(status), activeTodo]
    }
    return byStatus(status)
  }

  const activeTodo = activeId ? (todos ?? []).find(t => t.id === activeId) ?? null : null

  // ── DnD handlers ────────────────────────────────────────────────────────────

  function handleDragStart(event: DragStartEvent) {
    const id = event.active.id as string
    setActiveId(id)
    const todo = (todos ?? []).find(t => t.id === id)
    setOverColumnStatus(todo?.status ?? 'Todo')
  }

  // `--header` droppable IDs (e.g. "Done--header") map to their real status so
  // that drops onto a collapsed column header resolve correctly.
  function resolveColumnStatus(overId: string): string | null {
    if (statuses.includes(overId)) return overId
    const headerSuffix = '--header'
    if (overId.endsWith(headerSuffix)) {
      const base = overId.slice(0, -headerSuffix.length)
      if (statuses.includes(base)) return base
    }
    return null
  }

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) return
    const overId = over.id as string
    // Check if hovering over a column droppable (or its header variant)
    const colStatus = resolveColumnStatus(overId)
    if (colStatus) {
      setOverColumnStatus(colStatus)
      return
    }
    // Hovering over a card — find its column
    const overTodo = (todos ?? []).find(t => t.id === overId)
    if (overTodo) {
      setOverColumnStatus(overTodo.status ?? 'Todo')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event

    setActiveId(null)
    setOverColumnStatus(null)

    if (!over || !todos) return

    const draggedTodo = todos.find(t => t.id === active.id)
    if (!draggedTodo) return

    const activeStatus = draggedTodo.status ?? 'Todo'
    const overId = over.id as string

    // Determine target status — handle header droppables for collapsed columns
    let targetStatus = activeStatus
    const colStatus = resolveColumnStatus(overId)
    if (colStatus) {
      targetStatus = colStatus
    } else {
      const overTodo = todos.find(t => t.id === overId)
      if (overTodo) targetStatus = overTodo.status ?? 'Todo'
    }

    if (targetStatus !== activeStatus) {
      // Cross-column drop — change status
      updateTodo.mutate({ id: draggedTodo.id, status: targetStatus })
    } else {
      // Within-column — reorder
      const columnTodos = byStatus(activeStatus)
      const activeIndex = columnTodos.findIndex(t => t.id === active.id)
      const overIndex = statuses.includes(overId)
        ? columnTodos.length - 1
        : columnTodos.findIndex(t => t.id === overId)

      if (activeIndex !== -1 && overIndex !== -1 && activeIndex !== overIndex) {
        const reordered = arrayMove(columnTodos, activeIndex, overIndex)
        reorderTodos.mutate(reordered.map(t => t.id))
      }
    }
  }

  // ── Clear done ──────────────────────────────────────────────────────────────

  function handleClearDone() {
    setShowClearConfirm(true)
  }

  function commitClearDone() {
    const doneIds = byStatus('Done').map(t => t.id)
    setShowClearConfirm(false)
    startDelete(doneIds, t('todos.clearedDone'))
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isEmpty = !isLoading && !error && (todos?.length ?? 0) === 0

  return (
    <>
      <div className="pb-0">
        {isLoading && <TodosSkeleton isMobile={isMobile} />}

        {error && (
          <p className="text-destructive p-4">{t('todos.failedToLoad')}</p>
        )}

        {isEmpty && (
          <div className="pt-10 text-center px-8">
            <img src="/casita.webp" alt="" className="w-20 mb-4 mx-auto opacity-70" />
            <p className="text-sm font-medium text-muted-foreground mb-1">{t('todos.allCaughtUp')}</p>
            <p className="text-sm text-muted-foreground/60">{t('todos.getStarted')}</p>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="mt-3 text-sm text-primary hover:underline underline-offset-4 transition-colors"
            >
              {t('todos.orImport')}
            </button>
          </div>
        )}

        {!isLoading && !error && !isEmpty && filterableCategories.length > 0 && (
          <div className="flex gap-1.5 flex-wrap mb-3">
            {filterableCategories.map(name => (
              <Badge
                key={name}
                variant={selectedCategories.has(name) ? 'default' : 'outline'}
                className="cursor-pointer"
                onClick={() => setSelectedCategories(prev => {
                  const next = new Set(prev)
                  next.has(name) ? next.delete(name) : next.add(name)
                  return next
                })}
              >
                {name}
              </Badge>
            ))}
          </div>
        )}

        {!isLoading && !error && !isEmpty && (
          <DndContext
            sensors={sensors}
            collisionDetection={(args) => {
              const withinHits = pointerWithin(args)
              if (withinHits.length > 0) {
                // Prefer card hits over column hits so within-column reorder
                // positions correctly. Fall back to column hit if only the
                // droppable (card-list div) is hit but no individual card.
                const cardHits = withinHits.filter(c => !statuses.includes(c.id as string))
                return cardHits.length > 0 ? cardHits : withinHits
              }
              // rectIntersection is better than closestCorners for stacked
              // vertical columns — it picks the column whose rect overlaps the
              // most with the dragged item's bounding box.
              return rectIntersection(args)
            }}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            <div>
              {statuses.map(status => (
                <KanbanColumn
                  key={status}
                  status={status}
                  todos={getColumnTodos(status)}
                  members={members}
                  categories={categories}
                  onOpen={todo => navigate(`/todos/${todo.id}/edit`)}
                  onClearDone={status === 'Done' ? handleClearDone : undefined}
                  isOver={overColumnStatus === status && activeId !== null}
                />
              ))}
            </div>

            <DragOverlay>
              {activeTodo && (
                <TodoCard
                  todo={activeTodo}
                  members={members}
                  categories={categories}
                  onOpen={() => {}}
                  isOverlay
                />
              )}
            </DragOverlay>
          </DndContext>
        )}
      </div>

      <ClearDoneConfirm
        open={showClearConfirm}
        onConfirm={commitClearDone}
        onCancel={() => setShowClearConfirm(false)}
      />

      <ImportModal open={importOpen} onOpenChange={setImportOpen} description={t('todos.importDescription')}>
        <GuidedImport onDone={() => setImportOpen(false)} onSkip={() => setImportOpen(false)} />
      </ImportModal>
    </>
  )
}
