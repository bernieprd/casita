import { useState, useEffect, useRef, useMemo } from 'react'
import { useParams, useNavigate, useBlocker } from 'react-router-dom'
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../api'
import type { Todo } from '../api'
import { useHouseholdSettings, useTodoWorkflow } from '../api/household'
import { useConceptList, useCreateConcept } from '../api/concepts'
import { useTranslation } from 'react-i18next'

const SIMPLE_STATUSES = ['Todo', 'Done'] as const
const BOARD_STATUSES = ['Todo', 'In progress', 'Blocked', 'Done'] as const

const STATUS_TRANSLATION_KEYS: Record<string, string> = {
  'Todo':        'todos.status.todo',
  'Done':        'todos.status.done',
  'In progress': 'todos.status.inProgress',
  'Blocked':     'todos.status.blocked',
}

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
  { label: 'Monthly', value: 'monthly' },
  { label: 'Yearly', value: 'yearly' },
] as const

const DAY_OPTIONS: { label: string; value: string }[] = [
  { label: 'Mon', value: 'Monday' },
  { label: 'Tue', value: 'Tuesday' },
  { label: 'Wed', value: 'Wednesday' },
  { label: 'Thu', value: 'Thursday' },
  { label: 'Fri', value: 'Friday' },
  { label: 'Sat', value: 'Saturday' },
  { label: 'Sun', value: 'Sunday' },
]

export default function TodoFormPage() {
  const { t } = useTranslation()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id
  const navigate = useNavigate()

  const { data: todos } = useTodos()
  const todo = todos?.find((t: Todo) => t.id === id)
  const { data: workflowData } = useTodoWorkflow()
  const { data: categories } = useConceptList('todo-categories')
  const { data: householdSettings } = useHouseholdSettings()

  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()
  const createCategory = useCreateConcept('todo-categories')

  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>('Todo')
  const [priority, setPriority] = useState<string | null>(null)
  const [due, setDue] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [assignedTo, setAssignedTo] = useState<string[]>([])
  const [url, setUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [frequency, setFrequency] = useState<string | null>(null)
  const [frequencyInterval, setFrequencyInterval] = useState<number>(1)
  const [frequencyDays, setFrequencyDays] = useState<string[]>([])

  type TodoSnapshot = {
    name: string; status: string | null; priority: string | null; due: string
    categoryId: string | null; assignedTo: string[]; url: string
    notes: string; frequency: string | null; frequencyInterval: number; frequencyDays: string[]
  }
  const snapshot = useRef<TodoSnapshot | null>(null)

  const [initialized, setInitialized] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [newCategoryInput, setNewCategoryInput] = useState('')
  const [showCategoryInput, setShowCategoryInput] = useState(false)

  const saveDoneRef = useRef(false)

  useEffect(() => {
    saveDoneRef.current = false
    if (initialized) return
    if (!isEdit) {
      snapshot.current = { name: '', status: 'Todo', priority: null, due: '', categoryId: null, assignedTo: [], url: '', notes: '', frequency: null, frequencyInterval: 1, frequencyDays: [] }
      setInitialized(true)
      return
    }
    if (!todo) return
    setName(todo.name)
    setStatus(todo.status ?? 'Todo')
    setPriority(todo.priority)
    setDue(todo.due ?? '')
    setCategoryId(todo.categoryId)
    setAssignedTo(todo.assignedTo ?? [])
    setUrl(todo.url ?? '')
    setNotes(todo.notes ?? '')
    setFrequency(todo.frequency)
    setFrequencyInterval(todo.frequencyInterval ?? 1)
    setFrequencyDays(todo.frequencyDays ?? [])
    snapshot.current = {
      name: todo.name,
      status: todo.status ?? 'Todo',
      priority: todo.priority,
      due: todo.due ?? '',
      categoryId: todo.categoryId,
      assignedTo: todo.assignedTo ?? [],
      url: todo.url ?? '',
      notes: todo.notes ?? '',
      frequency: todo.frequency,
      frequencyInterval: todo.frequencyInterval ?? 1,
      frequencyDays: todo.frequencyDays ?? [],
    }
    setInitialized(true)
  }, [initialized, isEdit, todo])

  const statusOptions = workflowData?.workflow === 'board' ? BOARD_STATUSES : SIMPLE_STATUSES

  const isPending = isEdit ? updateTodo.isPending : createTodo.isPending

  const isDirty = useMemo(() => {
    if (!snapshot.current) return false
    const s = snapshot.current
    return (
      name !== s.name || status !== s.status || priority !== s.priority ||
      due !== s.due || categoryId !== s.categoryId ||
      JSON.stringify(assignedTo) !== JSON.stringify(s.assignedTo) ||
      url !== s.url || notes !== s.notes || frequency !== s.frequency ||
      frequencyInterval !== s.frequencyInterval ||
      JSON.stringify(frequencyDays) !== JSON.stringify(s.frequencyDays)
    )
  }, [name, status, priority, due, categoryId, assignedTo, url, notes, frequency, frequencyInterval, frequencyDays])

  const blocker = useBlocker(() => !saveDoneRef.current && isDirty && !isPending)

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
          frequencyInterval,
          frequencyDays,
        },
        {
          onSuccess: () => {
            saveDoneRef.current = true
            snapshot.current = null
            navigate(-1)
          },
        },
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
          frequencyInterval,
          frequencyDays,
        },
        {
          onSuccess: () => {
            saveDoneRef.current = true
            snapshot.current = null
            navigate('/todos', { replace: true })
          },
        },
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

  function handleFrequencyChange(value: string) {
    const newFreq = value === '__none__' ? null : value
    setFrequency(newFreq)
    if (!newFreq || newFreq === 'daily' || newFreq === 'yearly') {
      setFrequencyInterval(1)
      setFrequencyDays([])
    }
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
          <h1 className="flex-1 text-lg font-bold">{isEdit ? t('todos.editTitle') : t('todos.newTitle')}</h1>
          <Button size="sm" disabled={isPending || !name.trim()} onClick={handleSave}>
            {isPending
              ? isEdit ? t('common.saving') : t('common.creating')
              : isEdit ? t('common.save') : t('common.create')}
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
              <label className="text-sm font-medium">{t('todos.name')}</label>
              <Input
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (nameError) setNameError(false)
                }}
                placeholder={t('todos.namePlaceholder')}
                className={nameError ? 'border-destructive' : ''}
                autoFocus={!isEdit}
              />
              {nameError && <p className="text-xs text-destructive">{t('todos.nameRequired')}</p>}
            </div>

            {/* Status */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.statusLabel')}</label>
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
                      {t(STATUS_TRANSLATION_KEYS[s] ?? s)}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Priority */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.priorityLabel')}</label>
              <div className="flex flex-wrap gap-2">
                {PRIORITY_OPTIONS.map(opt => {
                  const isSelected = priority === opt.value
                  const key = opt.value === null ? 'null' : opt.value
                  const selectedClass = PRIORITY_SELECTED_CLASSES[key] ?? 'bg-secondary text-secondary-foreground border-secondary'
                  const priorityLabel = opt.value === null
                    ? t('priority.none')
                    : t(`priority.${opt.value.toLowerCase()}`, { defaultValue: opt.label })
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
                      {priorityLabel}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Category */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.categoryLabel')}</label>
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
                    <SelectValue placeholder={t('todos.noneOption')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">{t('todos.noneOption')}</SelectItem>
                    {(categories ?? []).map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">{t('todos.newCategory')}</SelectItem>
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
                    placeholder={t('todos.categoryNamePlaceholder')}
                    className="flex-1"
                  />
                  <Button
                    size="sm"
                    onClick={commitNewCategory}
                    disabled={!newCategoryInput.trim() || createCategory.isPending}
                  >
                    {t('common.add')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCategoryInput(false)}>
                    {t('common.cancel')}
                  </Button>
                </div>
              )}
            </div>

            {/* Assigned to */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.assignedTo')}</label>
              <div className="flex flex-wrap gap-2">
                {(householdSettings?.members ?? []).map(m => {
                  const isSelected = assignedTo.includes(m.clerkUserId)
                  return (
                    <button
                      key={m.clerkUserId}
                      type="button"
                      onClick={() => setAssignedTo(prev =>
                        prev.includes(m.clerkUserId)
                          ? prev.filter(id => id !== m.clerkUserId)
                          : [...prev, m.clerkUserId]
                      )}
                      className={[
                        'flex items-center gap-1.5 px-2 py-1 rounded-full text-sm border transition-colors',
                        isSelected
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted',
                      ].join(' ')}
                    >
                      {m.imageUrl && <img src={m.imageUrl} alt="" className="size-5 rounded-full" />}
                      {m.displayName ?? m.email ?? m.clerkUserId}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Due date */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.dueDate')}</label>
              <Input type="date" value={due} onChange={e => setDue(e.target.value)} />
            </div>

            {/* Frequency */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.frequencyLabel')}</label>
              <Select value={frequency ?? '__none__'} onValueChange={handleFrequencyChange}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t('todos.noneOption')} />
                </SelectTrigger>
                <SelectContent>
                  {FREQUENCY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value ?? 'none'} value={opt.value ?? '__none__'}>
                      {opt.value === null ? t('todos.noneOption') : t(`frequency.${opt.value}`, { defaultValue: opt.label })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {frequency === 'weekly' && (
                <div className="flex flex-col gap-2 mt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-muted-foreground">{t('todos.every')}</span>
                    {[1, 2, 3, 4].map(n => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => setFrequencyInterval(n)}
                        className={[
                          'px-3 py-1 rounded-full text-sm border transition-colors',
                          frequencyInterval === n
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background text-foreground border-border hover:bg-muted',
                        ].join(' ')}
                      >
                        {t('todos.nWeeks', { n })}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {DAY_OPTIONS.map(day => {
                      const isDaySelected = frequencyDays.includes(day.value)
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => setFrequencyDays(prev =>
                            prev.includes(day.value)
                              ? prev.filter(d => d !== day.value)
                              : [...prev, day.value]
                          )}
                          className={[
                            'px-3 py-1 rounded-full text-sm border transition-colors',
                            isDaySelected
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-background text-foreground border-border hover:bg-muted',
                          ].join(' ')}
                        >
                          {t(`days.${day.label.toLowerCase()}`, { defaultValue: day.label })}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {frequency === 'monthly' && (
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span className="text-sm text-muted-foreground">{t('todos.every')}</span>
                  {[1, 2, 3, 6].map(n => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setFrequencyInterval(n)}
                      className={[
                        'px-3 py-1 rounded-full text-sm border transition-colors',
                        frequencyInterval === n
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background text-foreground border-border hover:bg-muted',
                      ].join(' ')}
                    >
                      {t('todos.nMonths', { n })}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* URL */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.urlLabel')}</label>
              <Input
                type="url"
                value={url}
                onChange={e => setUrl(e.target.value)}
                placeholder={t('todos.urlPlaceholder')}
              />
            </div>

            {/* Notes */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium">{t('todos.notesLabel')}</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                rows={3}
                placeholder={t('todos.notesPlaceholder')}
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
              <Trash2 className="size-4" /> {t('todos.deleteTodo')}
            </Button>
          </div>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent showCloseButton={false}>
            <DialogHeader>
              <DialogTitle>{t('todos.deleteTodoTitle')}</DialogTitle>
              <DialogDescription>{t('todos.deleteTodoDescription', { name })}</DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  deleteTodo.mutate(id!, {
                    onSuccess: () => { snapshot.current = null; navigate('/todos', { replace: true }) },
                  })
                }}
              >
                {t('common.delete')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={blocker.state === 'blocked'}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('todos.unsavedChanges')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('todos.unsavedDescription')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => blocker.reset?.()}>{t('todos.keepEditing')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => blocker.proceed?.()}>{t('common.leave')}</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  )
}
