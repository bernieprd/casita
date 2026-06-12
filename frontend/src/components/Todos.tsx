import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useIsMobile } from '../hooks/useIsMobile'
import { toast } from 'sonner'
import { ChevronUp, ChevronDown } from 'lucide-react'
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
  closestCorners,
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
import GuidedImport from './GuidedImport'
import { ImportModal } from './ImportModal'

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

interface PendingDelete {
  ids: string[]
  timeoutId: ReturnType<typeof setTimeout>
}

type Member = HouseholdSettings['members'][number]

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDue(due: string | null): string | null {
  if (!due) return null
  const d = new Date(due + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function memberInitials(member: Member): string {
  const name = member.displayName ?? member.email ?? ''
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0])
    .join('')
    .toUpperCase()
}

// ── Priority chip ─────────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority: string | null }) {
  if (!priority) return null
  const cls = PRIORITY_CHIP_CLASSES[priority] ?? 'bg-secondary text-secondary-foreground'
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[0.65rem] font-semibold leading-none border ${cls}`}>
      {priority}
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
  ref?: React.Ref<HTMLDivElement>
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
  const dueLabel = formatDue(todo.due)
  const isDone = todo.status === 'Done'
  const category = todo.categoryId ? categories.find(c => c.id === todo.categoryId) : null
  const assignee = todo.assignedTo ? members.find(m => m.clerkUserId === todo.assignedTo) : null

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

      {(todo.priority || dueLabel || category || assignee) && (
        <div className="mt-2 flex items-center gap-1.5 flex-wrap">
          <PriorityChip priority={todo.priority} />
          {dueLabel && (
            <span className={`text-xs shrink-0 font-medium ${dueLabel === 'Today' ? 'text-destructive' : 'text-muted-foreground'}`}>
              {dueLabel}
            </span>
          )}
          {category && (
            <Badge variant="outline" className="text-[0.6rem] h-4 px-1 py-0 font-normal">
              {category.name}
            </Badge>
          )}
          {assignee && (
            <Avatar className="size-4 shrink-0">
              {assignee.imageUrl && <AvatarImage src={assignee.imageUrl} alt={assignee.displayName ?? ''} />}
              <AvatarFallback className="text-[0.5rem]">{memberInitials(assignee)}</AvatarFallback>
            </Avatar>
          )}
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
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={o => { if (!o) onCancel() }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Clear all done to-dos?</DrawerTitle>
            <p className="text-sm text-muted-foreground">
              This will permanently delete all done to-dos and any data associated with them.
            </p>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="destructive" onClick={onConfirm}>Clear all</Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) onCancel() }}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Clear all done to-dos?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="text-sm text-muted-foreground">
          This will permanently delete all done to-dos and any data associated with them.
        </DialogDescription>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Clear all</Button>
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
  isMobile: boolean
  isOver?: boolean
}

function KanbanColumn({ status, todos, members, categories, onOpen, onClearDone, isMobile, isOver }: KanbanColumnProps) {
  const { setNodeRef } = useDroppable({ id: status })
  const isBlocked = status === 'Blocked'
  const isDone = status === 'Done'
  const [expanded, setExpanded] = useState(!isDone)

  const headerContent = (
    <>
      <span className={`flex-1 text-left text-xs font-semibold uppercase tracking-widest leading-none ${isBlocked ? BLOCKED_HEADER_CLASS : 'text-muted-foreground'}`}>
        {status}
      </span>
      <span className="text-xs text-muted-foreground mr-2">{todos.length}</span>
      {onClearDone && todos.length > 0 && (
        <button
          type="button"
          onClick={e => { e.stopPropagation(); onClearDone() }}
          className="mr-1.5 text-xs text-destructive hover:text-destructive/80 px-2 py-0.5 rounded"
        >
          Clear all
        </button>
      )}
    </>
  )

  const cardList = (
    <SortableContext items={todos.map(t => t.id)} strategy={verticalListSortingStrategy}>
      <div className="flex flex-col gap-2">
        {todos.map(todo => (
          <SortableCard key={todo.id} todo={todo} members={members} categories={categories} onOpen={onOpen} />
        ))}
        {todos.length === 0 && (
          <div className="rounded-lg border-2 border-dashed border-border/50 h-16 flex items-center justify-center">
            <span className="text-xs text-muted-foreground/40">Drop here</span>
          </div>
        )}
      </div>
    </SortableContext>
  )

  if (isMobile) {
    return (
      <div ref={setNodeRef} className="mb-2">
      <Collapsible
        open={expanded}
        onOpenChange={setExpanded}
        className={`bg-card rounded-lg overflow-hidden border shadow-[0_1px_2px_rgba(0,0,0,.06)] transition-colors ${isOver ? 'border-primary/40' : 'border-border'}`}
      >
        <CollapsibleTrigger asChild>
          <div
            role="button"
            tabIndex={0}
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${status}`}
            aria-expanded={expanded}
            className="w-full flex items-center px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
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

  return (
    <div ref={setNodeRef} className={`w-72 flex-shrink-0 flex flex-col rounded-lg border bg-muted/30 transition-colors ${isOver ? 'border-primary/50 bg-primary/5' : 'border-border'}`}>
      <div className="flex items-center px-3 py-2.5 border-b border-border">
        {headerContent}
      </div>
      <div className="flex-1 p-2 overflow-y-auto max-h-[calc(100vh-200px)]">
        {cardList}
      </div>
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
    <div className="flex gap-3 overflow-x-hidden">
      {[3, 2, 1].map((rows, gi) => (
        <div key={gi} className="w-72 flex-shrink-0 rounded-lg border border-border bg-muted/30">
          <div className="px-3 py-2.5 border-b border-border">
            <Skeleton className="w-20 h-3.5" />
          </div>
          <div className="p-2 flex flex-col gap-2">
            {Array.from({ length: rows }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3">
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
        label: 'Undo',
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
          placeholder="Add a to-do…"
          autoComplete="off"
          aria-label="New to-do name"
          className="flex-1"
        />
        <Button type="submit" disabled={!inputValue.trim()} className="shrink-0">
          Add
        </Button>
      </form>
    )
    return () => setHeader(null)
  }, [inputValue, setHeader])

  // ── Derived data ────────────────────────────────────────────────────────────

  const pendingDeleteIds = new Set(pendingDelete?.ids ?? [])

  function byStatus(status: string): Todo[] {
    return (todos ?? []).filter(t => (t.status ?? 'Todo') === status && !pendingDeleteIds.has(t.id))
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

  function handleDragOver(event: DragOverEvent) {
    const { over } = event
    if (!over) return
    const overId = over.id as string
    // Check if hovering over a column droppable
    if (statuses.includes(overId)) {
      setOverColumnStatus(overId)
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

    // Determine target status
    let targetStatus = activeStatus
    if (statuses.includes(overId)) {
      targetStatus = overId
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
    startDelete(doneIds, 'Done to-dos cleared')
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const isEmpty = !isLoading && !error && (todos?.length ?? 0) === 0

  return (
    <>
      <div className="pb-0">
        {isLoading && <TodosSkeleton isMobile={isMobile} />}

        {error && (
          <p className="text-destructive p-4">Failed to load to-dos.</p>
        )}

        {isEmpty && (
          <div className="pt-10 text-center px-8">
            <img src="/casita.webp" alt="" className="w-20 mb-4 mx-auto opacity-70" />
            <p className="text-sm font-medium text-muted-foreground mb-1">All caught up</p>
            <p className="text-sm text-muted-foreground/60">Add a to-do above to get started</p>
            <button
              type="button"
              onClick={() => setImportOpen(true)}
              className="mt-3 text-sm text-primary hover:underline underline-offset-4 transition-colors"
            >
              Or import your to-dos →
            </button>
          </div>
        )}

        {!isLoading && !error && !isEmpty && (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {isMobile ? (
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
                    isMobile
                    isOver={overColumnStatus === status && activeId !== null}
                  />
                ))}
              </div>
            ) : (
              <div className="flex gap-3 overflow-x-auto pb-2">
                {statuses.map(status => (
                  <KanbanColumn
                    key={status}
                    status={status}
                    todos={getColumnTodos(status)}
                    members={members}
                    categories={categories}
                    onOpen={todo => navigate(`/todos/${todo.id}/edit`)}
                    onClearDone={status === 'Done' ? handleClearDone : undefined}
                    isMobile={false}
                    isOver={overColumnStatus === status && activeId !== null}
                  />
                ))}
              </div>
            )}

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

      <ImportModal open={importOpen} onOpenChange={setImportOpen} description="Import your to-do list.">
        <GuidedImport onDone={() => setImportOpen(false)} onSkip={() => setImportOpen(false)} />
      </ImportModal>
    </>
  )
}
