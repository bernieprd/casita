import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../api'
import type { Todo } from '../api'
import { useHouseholdSettings, useTodoWorkflow } from '../api/household'
import { useConceptList, useCreateConcept } from '../api/concepts'

const SIMPLE_STATUSES = ['Todo', 'Done'] as const
const BOARD_STATUSES = ['Todo', 'In progress', 'Blocked', 'Done'] as const

const STATUS_SELECTED_CLASSES: Record<string, string> = {
  'Todo':        'bg-secondary text-secondary-foreground border-secondary',
  'In progress': 'bg-primary text-primary-foreground border-primary',
  'Blocked':     'bg-amber-500 text-white border-amber-500',
  'Done':        'bg-green-600 text-white border-green-600',
}

const PRIORITY_OPTIONS = [
  { label: 'None', value: null },
  { label: 'Low', value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High', value: 'High' },
] as const

const PRIORITY_SELECTED_CLASSES: Record<string, string> = {
  'null':   'bg-secondary text-secondary-foreground border-secondary',
  'Low':    'bg-secondary text-secondary-foreground border-secondary',
  'Medium': 'bg-amber-500 text-white border-amber-500',
  'High':   'bg-destructive text-white border-destructive',
}

const FREQUENCY_OPTIONS = [
  { label: 'None', value: null },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Biweekly', value: 'biweekly' },
  { label: 'Monthly', value: 'monthly' },
  { label: 'Quarterly', value: 'quarterly' },
  { label: 'Yearly', value: 'yearly' },
] as const

export default function TodoFormPage() {
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  // Data queries
  const { data: todos } = useTodos()
  const todo = todos?.find((t: Todo) => t.id === id)
  const { data: workflowData } = useTodoWorkflow()
  const { data: categories } = useConceptList('todo-categories')
  const { data: householdSettings } = useHouseholdSettings()

  // Mutations
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()
  const createCategory = useCreateConcept('todo-categories')

  // Form state
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>('Todo')
  const [priority, setPriority] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [frequency, setFrequency] = useState<string | null>(null)

  // UI state
  const [initialized, setInitialized] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [showCategoryInput, setShowCategoryInput] = useState(false)

  // Initialize form in edit mode
  useEffect(() => {
    if (initialized) return
    if (!isEdit) {
      setInitialized(true)
      return
    }
    if (!todo) return
    setName(todo.name)
    setStatus(todo.status ?? 'Todo')
    setPriority(todo.priority)
    setDue(todo.due ?? '')
    setCategoryId(todo.categoryId)
    setAssignedTo(todo.assignedTo)
    setUrl(todo.url ?? '')
    setNotes(todo.notes ?? '')
    setFrequency(todo.frequency)
    setInitialized(true)
  }, [initialized, isEdit, todo])

  const statusOptions = workflowData?.workflow === 'board' ? BOARD_STATUSES : SIMPLE_STATUSES

  const isPending = isEdit ? updateTodo.isPending : createTodo.isPending

  function handleSave() {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    if (isEdit && id) {
      updateTodo.mutate(
        {
          id,
          name: name.trim(),
          status,
          priority,
          due: due || null,
          categoryId,
          assignedTo,
          url: url || null,
          notes: notes || null,
          frequency,
        },
        { onSuccess: () => navigate(-1) },
      )
    } else {
      createTodo.mutate(
        {
          name: name.trim(),
          status,
          priority,
          due: due || null,
          categoryId,
          assignedTo,
          url: url || null,
          notes: notes || null,
          frequency,
        },
        { onSuccess: () => navigate('/todos', { replace: true }) },
      )
    }
  }

  function commitNewCategory() {
    const trimmed = newCategoryInput.trim()
    if (!trimmed) return
    createCategory.mutate(trimmed, {
      onSuccess: (newItem) => {
        setCategoryId(newItem.id)
        setShowCategoryInput(false)
      },
    })
  }

  return (
    <div className="h-dvh bg-background flex flex-col">
      <header className="sticky top-0 z-50 bg-background border-b shrink-0">
        <div className="max-w-xl mx-auto flex items-center px-2 h-14">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            disabled={isPending}
            className="-ml-2"
          >
            <ArrowLeft />
          </Button>
          <h1 className="flex-1 text-lg font-bold">{isEdit ? 'Edit To-Do' : 'New To-Do'}</h1>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleSave}>
            {isPending
              ? isEdit ? 'Saving…' : 'Creating…'
              : isEdit ? 'Save' : 'Create'}
          </Button>
        </div>
      </header>

      <div className="px-4 py-4 overflow-y-auto overscroll-contain flex-1 max-w-xl mx-auto w-full">
        {isEdit && !initialized ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Name</label>
              <Input
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (nameError) setNameError(false)
                }}
                placeholder="What needs to be done?"
                className={nameError ? 'border-destructive' : ''}
                autoFocus={!isEdit}
              />
              {nameError && <p className="text-xs text-destructive">Name is required</p>}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Status</label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map(s => {
                  const isSelected = status === s
                  const selectedClass = STATUS_SELECTED_CLASSES[s] ?? 'bg-secondary text-secondary-foreground border-secondary'
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStatus(s)}
                      className={[
                        'px-3 py-1 rounded-full text-sm border transition-colors',
                        isSelected
                          ? selectedClass
                          : 'bg-background text-foreground border-border hover:bg-muted',
                      ].join(' ')}
                    >
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Priority</label>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map(opt => {
                  const isSelected = priority === opt.value
                  const key = opt.value === null ? 'null' : opt.value
                  const selectedClass = PRIORITY_SELECTED_CLASSES[key] ?? 'bg-secondary text-secondary-foreground border-secondary'
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={[
                        'px-3 py-1 rounded-full text-sm border transition-colors',
                        isSelected
                          ? selectedClass
                          : 'bg-background text-foreground border-border hover:bg-muted',
                      ].join(' ')}
                    >
                      {opt.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Category</label>
              {!showCategoryInput ? (
                <Select
                  value={categoryId ?? '__none__'}
                  onValueChange={v => {
                    if (v === '__new__') {
                      setShowCategoryInput(true)
                      setNewCategoryInput('')
                    } else {
                      setCategoryId(v === '__none__' ? null : v)
                    }
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {(categories ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ New category…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    value={newCategoryInput}
                    onChange={e => setNewCategoryInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitNewCategory()
                      if (e.key === 'Escape') setShowCategoryInput(false)
                    }}
                    placeholder="Category name"
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={commitNewCategory}
                    disabled={!newCategoryInput.trim() || createCategory.isPending}
                  >
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCategoryInput(false)}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Assigned to */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Assigned to</label>
              <Select value={assignedTo ?? '__none__'} onValueChange={v => setAssignedTo(v === '__none__' ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Unassigned</SelectItem>
                  {(householdSettings?.members ?? []).map(m => (
                    <SelectItem key={m.clerkUserId} value={m.clerkUserId}>
                      <div className="flex items-center gap-2">
                        {m.imageUrl && (
                          <img src={m.imageUrl} alt="" className="size-5 rounded-full" />
                        )}
                        {m.displayName ?? m.email ?? m.clerkUserId}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Due date</label>
              <Input type="date" value={due} onChange={e => setDue(e.target.value)} />
            </div>

            {/* Frequency */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Frequency</label>
              <Select value={frequency ?? '__none__'} onValueChange={v => setFrequency(v === '__none__' ? null : v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value ?? 'none'} value={opt.value ?? '__none__'}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">URL</label>
              <Input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">Notes</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder="Any details…"
              />
            </div>
          </div>
        )}

        {/* Delete — edit only */}
        {isEdit && initialized && (
          <div className="mt-8 mb-4 flex justify-center">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeleteDialogOpen(true)}
              disabled={isPending || deleteTodo.isPending}
              className="text-destructive hover:text-destructive gap-1"
            >
              <Trash2 className="size-4" /> Delete to-do
            </Button>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>Delete to-do?</DialogTitle>
              <DialogDescription>"{name}" will be permanently deleted.</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteTodo.mutate(id!, {
                    onSuccess: () => navigate('/todos', { replace: true }),
                  })
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
