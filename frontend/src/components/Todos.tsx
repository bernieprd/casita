import { useState, useRef, useEffect, useCallback, type ReactNode } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { toast } from 'sonner'
import { ChevronUp, ChevronDown, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../api'
import type { Todo } from '../api'
import GuidedImport from './GuidedImport'
import { ImportModal } from './ImportModal'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['Todo', 'In progress', 'On hold', 'Done'] as const
type Status = (typeof STATUSES)[number]

const STATUS_SELECTED_CLASSES: Record<Status, string> = {
  'Todo':        'bg-secondary text-secondary-foreground border-secondary',
  'In progress': 'bg-primary text-primary-foreground border-primary',
  'On hold':     'bg-amber-500 text-white border-amber-500',
  'Done':        'bg-green-600 text-white border-green-600',
}

const PRIORITY_OPTIONS: Array<{ label: string; value: string | null }> = [
  { label: 'None',   value: null },
  { label: 'Low',    value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High',   value: 'High' },
]

const PRIORITY_CHIP_CLASSES: Record<string, string> = {
  High:   'bg-destructive/10 text-destructive border-destructive',
  Medium: 'bg-yellow-50 dark:bg-yellow-950/30 text-orange-700 dark:text-orange-400',
  Low:    'bg-secondary text-secondary-foreground',
}

const PRIORITY_SELECTED_CLASSES: Record<string, string> = {
  High:   'bg-destructive text-white border-destructive',
  Medium: 'bg-amber-500 text-white border-amber-500',
  Low:    'bg-secondary text-secondary-foreground border-secondary',
}

const UNDO_DURATION_MS = 4000

interface PendingDelete {
  ids: string[]
  timeoutId: ReturnType<typeof setTimeout>
}

// ── Date formatting ───────────────────────────────────────────────────────────

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

// ── Priority chip ─────────────────────────────────────────────────────────────

function PriorityChip({ priority }: { priority: string | null }) {
  if (!priority) return null
  const chipClass = PRIORITY_CHIP_CLASSES[priority] ?? 'bg-secondary text-secondary-foreground'
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-px text-[0.65rem] font-semibold leading-none ${chipClass}`}
    >
      {priority}
    </span>
  )
}

// ── Todo row ──────────────────────────────────────────────────────────────────

interface TodoRowProps {
  todo: Todo
  onOpen: (todo: Todo) => void
}

function TodoRow({ todo, onOpen }: TodoRowProps) {
  const dueLabel = formatDue(todo.due)
  const isDone = todo.status === 'Done'
  const hasSecondary = !!(todo.priority || dueLabel)

  return (
    <button
      type="button"
      onClick={e => { const btn = e.currentTarget; btn.blur(); requestAnimationFrame(() => onOpen(todo)) }}
      className="w-full text-left px-4 py-3 hover:bg-accent/50 transition-colors"
    >
      <span
        className={`block text-sm ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}
      >
        {todo.name}
      </span>
      {hasSecondary && (
        <span className="flex items-center gap-1.5 mt-0.5 flex-wrap">
          <PriorityChip priority={todo.priority} />
          {dueLabel && (
            <span
              className={`text-xs shrink-0 ${dueLabel === 'Today' ? 'text-destructive' : 'text-muted-foreground'}`}
            >
              {dueLabel}
            </span>
          )}
        </span>
      )}
    </button>
  )
}

// ── Todo detail sheet ─────────────────────────────────────────────────────────

interface TodoDetailSheetProps {
  todo: Todo | null
  onClose: () => void
  onUpdate: (id: string, fields: Partial<Omit<Todo, 'id'>>) => void
  onDelete: (todo: Todo) => void
}

function TodoDetailSheet({ todo, onClose, onUpdate, onDelete }: TodoDetailSheetProps) {
  const [draftName, setDraftName] = useState('')
  const [draftDue, setDraftDue] = useState('')
  const [draftStatus, setDraftStatus] = useState<Status>('Todo')
  const [draftPriority, setDraftPriority] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const nameRef = useRef<HTMLInputElement>(null)
  const isMobile = useIsMobile()

  useEffect(() => {
    if (!todo) return
    setDraftName(todo.name)
    setDraftDue(todo.due ?? '')
    setDraftStatus((todo.status ?? 'Todo') as Status)
    setDraftPriority(todo.priority)
    setConfirmingDelete(false)
    const t = setTimeout(() => nameRef.current?.focus(), 150)
    return () => clearTimeout(t)
  }, [todo])

  function handleSave() {
    if (!todo) return
    const fields: Partial<Omit<Todo, 'id'>> = {}
    const trimmedName = draftName.trim()
    if (trimmedName && trimmedName !== todo.name) fields.name = trimmedName
    const due = draftDue || null
    if (due !== todo.due) fields.due = due
    if (draftStatus !== (todo.status ?? 'Todo')) fields.status = draftStatus
    if (draftPriority !== todo.priority) fields.priority = draftPriority
    if (Object.keys(fields).length > 0) onUpdate(todo.id, fields)
    onClose()
  }

  const confirmBody = (
    <div className="space-y-3">
      <DialogTitle className="text-sm font-medium">Delete "{todo?.name}"?</DialogTitle>
      <DialogDescription className="text-sm text-muted-foreground">
        This will permanently remove this to-do.
      </DialogDescription>
      <div className="flex justify-end gap-2 pt-1">
        <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
        <Button
          variant="destructive"
          onClick={() => { if (todo) { onDelete(todo); onClose() } }}
        >
          Delete
        </Button>
      </div>
    </div>
  )

  const formBody = (
    <div className={`overflow-y-auto overscroll-contain${isMobile ? ' px-5 pt-2 pb-6' : ' py-1 px-0.5'}`}>
      {/* Name */}
      <Input
        ref={nameRef}
        value={draftName}
        onChange={e => setDraftName(e.target.value)}
        placeholder="To-do name"
        aria-label="To-do name"
        enterKeyHint="done"
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.blur() } }}
        className="w-full"
      />

      <Separator className="my-4" />

      {/* Status */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground leading-none">
        Status
      </p>
      <div className="flex gap-2 flex-wrap mt-2">
        {STATUSES.map(s => {
          const selected = draftStatus === s
          return (
            <button
              key={s}
              type="button"
              onClick={() => setDraftStatus(s)}
              className={`inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-medium transition-colors ${
                selected
                  ? STATUS_SELECTED_CLASSES[s]
                  : 'border-border bg-background text-foreground hover:bg-accent'
              }`}
            >
              {s}
            </button>
          )
        })}
      </div>

      <Separator className="my-4" />

      {/* Priority */}
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground leading-none">
        Priority
      </p>
      <div className="flex gap-2 flex-wrap mt-2">
        {PRIORITY_OPTIONS.map(({ label, value }) => {
          const selected = draftPriority === value
          const selectedClass = value ? PRIORITY_SELECTED_CLASSES[value] : 'bg-secondary text-secondary-foreground border-secondary'
          return (
            <button
              key={label}
              type="button"
              onClick={() => setDraftPriority(value)}
              className={`inline-flex items-center rounded-full border px-3 py-0.5 text-sm font-medium transition-colors ${
                selected
                  ? selectedClass
                  : 'border-border bg-background text-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      <Separator className="my-4" />

      {/* Due date */}
      <Input
        type="date"
        aria-label="Due date"
        value={draftDue}
        onChange={e => setDraftDue(e.target.value)}
        className="text-sm"
      />

      <Separator className="my-4" />

      {/* Actions */}
      <div className="flex justify-between items-center">
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive hover:bg-destructive/10 gap-1.5"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
        <Button onClick={handleSave}>
          Save
        </Button>
      </div>
    </div>
  )

  const content = confirmingDelete ? confirmBody : formBody

  if (isMobile) {
    return (
      <Drawer
        open={!!todo}
        onOpenChange={open => { if (!open) onClose() }}
        direction="bottom"
      >
        <DrawerContent
          className="rounded-t-2xl flex flex-col max-h-[80dvh]"
        >
          {confirmingDelete ? (
            <>
              <DrawerHeader className="px-5 pt-4">
                <DrawerTitle className="text-sm font-medium text-left">Delete "{todo?.name}"?</DrawerTitle>
                <DrawerDescription className="text-sm text-muted-foreground">
                  This will permanently remove this to-do.
                </DrawerDescription>
              </DrawerHeader>
              <div className="flex justify-end gap-2 px-5 pb-6 pt-1">
                <Button variant="outline" onClick={() => setConfirmingDelete(false)}>Cancel</Button>
                <Button
                  variant="destructive"
                  onClick={() => { if (todo) { onDelete(todo); onClose() } }}
                >
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <>
              <DrawerHeader className="sr-only">
                <DrawerTitle>Edit To-do</DrawerTitle>
                <DrawerDescription>Update the to-do details.</DrawerDescription>
              </DrawerHeader>
              {formBody}
            </>
          )}
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={!!todo} onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        {!confirmingDelete && (
          <DialogHeader>
            <DialogTitle>Edit To-do</DialogTitle>
            <DialogDescription className="sr-only">Update the to-do details.</DialogDescription>
          </DialogHeader>
        )}
        {content}
      </DialogContent>
    </Dialog>
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

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  status: Status
  todos: Todo[]
  onOpen: (todo: Todo) => void
  onClearDone?: () => void
  pendingDeleteIds: Set<string>
}

function Section({ status, todos, onOpen, onClearDone, pendingDeleteIds }: SectionProps) {
  const [expanded, setExpanded] = useState(status !== 'Done')
  const visible = todos.filter(t => !pendingDeleteIds.has(t.id))

  if (visible.length === 0) return null

  return (
    <Collapsible
      open={expanded}
      onOpenChange={setExpanded}
      className="bg-card rounded-lg overflow-hidden border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2"
    >
      <CollapsibleTrigger asChild>
        <div
          role="button"
          tabIndex={0}
          aria-label={`${expanded ? 'Collapse' : 'Expand'} ${status}`}
          aria-expanded={expanded}
          className="w-full flex items-center px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer"
        >
          <span className="flex-1 text-left text-xs font-semibold uppercase tracking-widest text-muted-foreground leading-none">
            {status}
          </span>
          <span className="text-xs text-muted-foreground mr-2">{visible.length}</span>
          {onClearDone && visible.length > 0 && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onClearDone() }}
              className="mr-1.5 text-xs text-destructive hover:text-destructive/80 px-2 py-0.5 rounded"
            >
              Clear all
            </button>
          )}
          {expanded
            ? <ChevronUp className="size-4 text-muted-foreground" />
            : <ChevronDown className="size-4 text-muted-foreground" />
          }
        </div>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <Separator />
        <ul>
          {visible.map((todo, idx) => (
            <li key={todo.id}>
              {idx > 0 && <Separator />}
              <TodoRow todo={todo} onOpen={onOpen} />
            </li>
          ))}
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TodosSkeleton() {
  return (
    <div>
      {[3, 2].map((rows, gi) => (
        <div key={gi} className="bg-background rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
          <div className="px-4 py-3">
            <Skeleton className="w-20 h-3.5" />
          </div>
          <Separator />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i}>
              {i > 0 && <Separator />}
              <div className="px-4 py-2.5 flex items-center gap-3 min-h-12">
                <Skeleton className="size-[18px] rounded shrink-0" />
                <Skeleton className="h-4" style={{ width: `${45 + i * 20}%` }} />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function Todos({ setHeader }: { setHeader: (node: ReactNode | null) => void }) {
  const { data: todos, isLoading, error } = useTodos()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  const [inputValue, setInputValue] = useState('')
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [importOpen, setImportOpen] = useState(false)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)

  useEffect(() => { pendingDeleteRef.current = pendingDelete }, [pendingDelete])

  const inputValueRef = useRef(inputValue)
  useEffect(() => { inputValueRef.current = inputValue })

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

  function handleDelete(todo: Todo) {
    startDelete([todo.id], `"${todo.name}" deleted`)
  }

  function handleOpen(todo: Todo) {
    setSelectedTodo(todo)
  }

  function handleCloseSheet() {
    setSelectedTodo(null)
  }

  function handleUpdate(id: string, fields: Partial<Omit<Todo, 'id'>>) {
    updateTodo.mutate({ id, ...fields })
  }

  function handleClearDone() {
    setShowClearConfirm(true)
  }

  function commitClearDone() {
    const doneIds = byStatus('Done').map(t => t.id)
    setShowClearConfirm(false)
    startDelete(doneIds, 'Done to-dos cleared')
  }

  const pendingDeleteIds = new Set(pendingDelete?.ids ?? [])

  const byStatus = (status: Status) =>
    (todos ?? []).filter(t => (t.status ?? 'Todo') === status)

  return (
    <>
      {/* List */}
      <div className="pb-8">
        {isLoading && <TodosSkeleton />}

        {error && (
          <p className="text-destructive p-4">Failed to load to-dos.</p>
        )}

        {!isLoading && !error && todos?.length === 0 && (
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

        {!isLoading && !error && !!todos?.length && STATUSES.map(status => (
          <Section
            key={status}
            status={status}
            todos={byStatus(status)}
            onOpen={handleOpen}
            onClearDone={status === 'Done' ? handleClearDone : undefined}
            pendingDeleteIds={pendingDeleteIds}
          />
        ))}
      </div>

      {/* Detail sheet */}
      <TodoDetailSheet
        todo={selectedTodo}
        onClose={handleCloseSheet}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />

      {/* Clear done confirmation */}
      <ClearDoneConfirm
        open={showClearConfirm}
        onConfirm={commitClearDone}
        onCancel={() => setShowClearConfirm(false)}
      />

      {/* Import dialog */}
      <ImportModal open={importOpen} onOpenChange={setImportOpen} description="Import your to-do list.">
        <GuidedImport onDone={() => setImportOpen(false)} onSkip={() => setImportOpen(false)} />
      </ImportModal>
    </>
  )
}
