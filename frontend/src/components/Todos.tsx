import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import Chip from '@mui/material/Chip'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import Drawer from '@mui/material/Drawer'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../api'
import type { Todo } from '../api'
import { useKeyboardOffset } from '../useKeyboardOffset'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['Todo', 'In progress', 'On hold', 'Done'] as const
type Status = (typeof STATUSES)[number]

const STATUS_COLORS: Record<Status, 'default' | 'primary' | 'warning' | 'success'> = {
  'Todo':        'default',
  'In progress': 'primary',
  'On hold':     'warning',
  'Done':        'success',
}

const PRIORITY_OPTIONS: Array<{ label: string; value: string | null }> = [
  { label: 'None',   value: null },
  { label: 'Low',    value: 'Low' },
  { label: 'Medium', value: 'Medium' },
  { label: 'High',   value: 'High' },
]

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  High:   { bg: '#fde8e8', color: '#c62828' },
  Medium: { bg: '#fff8e1', color: '#e65100' },
  Low:    { bg: '#f3f3f3', color: '#616161' },
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
  const style = PRIORITY_COLORS[priority] ?? { bg: '#f3f3f3', color: '#616161' }
  return (
    <Chip
      label={priority}
      size="small"
      sx={{
        height: 18,
        fontSize: '0.65rem',
        fontWeight: 600,
        bgcolor: style.bg,
        color: style.color,
        border: 'none',
        flexShrink: 0,
      }}
    />
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
    <ListItemButton
      onClick={() => onOpen(todo)}
      sx={{ px: 2, py: 0.75 }}
    >
        <ListItemText
          primary={
            <Typography
              variant="body2"
              sx={{
                textDecoration: isDone ? 'line-through' : 'none',
                color: isDone ? 'text.disabled' : 'text.primary',
              }}
            >
              {todo.name}
            </Typography>
          }
          secondary={
            hasSecondary ? (
              <Box
                component="span"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.25, flexWrap: 'wrap' }}
              >
                <PriorityChip priority={todo.priority} />
                {dueLabel && (
                  <Typography
                    variant="caption"
                    component="span"
                    sx={{ color: dueLabel === 'Today' ? 'error.main' : 'text.secondary', flexShrink: 0 }}
                  >
                    {dueLabel}
                  </Typography>
                )}
              </Box>
            ) : null
          }
          secondaryTypographyProps={{ component: 'span' }}
        />
    </ListItemButton>
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
  const nameRef = useRef<HTMLInputElement>(null)
  const keyboardOffset = useKeyboardOffset()

  useEffect(() => {
    if (!todo) return
    setDraftName(todo.name)
    setDraftDue(todo.due ?? '')
    setDraftStatus((todo.status ?? 'Todo') as Status)
    setDraftPriority(todo.priority)
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

  function handleStatusChip(status: Status) {
    setDraftStatus(status)
  }

  function handlePriorityChip(value: string | null) {
    setDraftPriority(value)
  }

  return (
    <Drawer
      anchor="bottom"
      open={!!todo}
      onClose={onClose}
      ModalProps={{ disableScrollLock: true }}
      PaperProps={{
        sx: {
          borderRadius: '16px 16px 0 0',
          display: 'flex',
          flexDirection: 'column',
          bottom: keyboardOffset,
          transition: 'bottom 150ms ease-out',
        },
      }}
    >
      {/* Drag handle */}
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5, flexShrink: 0 }}>
        <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
      </Box>

      {/* Scrollable content */}
      <Box sx={{ overflowY: 'auto', px: 2.5, pt: 1, pb: 3 }}>
        {/* Name */}
        <TextField
          value={draftName}
          onChange={e => setDraftName(e.target.value)}
          variant="standard"
          fullWidth
          inputRef={nameRef}
          inputProps={{ enterKeyHint: 'done', 'aria-label': 'Todo name' }}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); nameRef.current?.blur() } }}
          sx={{ mb: 0.5 }}
        />

        <Divider sx={{ my: 2 }} />

        {/* Status */}
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
          Status
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
          {STATUSES.map(s => {
            const selected = draftStatus === s
            return (
              <Chip
                key={s}
                label={s}
                clickable
                size="small"
                onClick={() => handleStatusChip(s)}
                variant={selected ? 'filled' : 'outlined'}
                color={selected ? STATUS_COLORS[s] : 'default'}
                sx={{ fontSize: '0.8rem' }}
              />
            )
          })}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Priority */}
        <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
          Priority
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 0.75 }}>
          {PRIORITY_OPTIONS.map(({ label, value }) => {
            const selected = draftPriority === value
            const chipColor = value === 'High' ? 'error' : value === 'Medium' ? 'warning' : 'default'
            return (
              <Chip
                key={label}
                label={label}
                clickable
                size="small"
                onClick={() => handlePriorityChip(value)}
                variant={selected ? 'filled' : 'outlined'}
                color={selected ? chipColor : 'default'}
                sx={{ fontSize: '0.8rem' }}
              />
            )
          })}
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Due date */}
        <TextField
          type="date"
          label="Due date"
          size="small"
          fullWidth
          value={draftDue}
          onChange={e => setDraftDue(e.target.value)}
          InputLabelProps={{ shrink: true }}
        />

        <Divider sx={{ my: 2 }} />

        {/* Actions */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Button
            color="error"
            variant="text"
            startIcon={<DeleteOutlineIcon />}
            onClick={() => { if (todo) { onDelete(todo); onClose() } }}
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSave}
            sx={{ textTransform: 'none' }}
          >
            Save
          </Button>
        </Box>
      </Box>
    </Drawer>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  status: Status
  todos: Todo[]
  pendingDeleteId: string | null
  onOpen: (todo: Todo) => void
  onClearDone?: () => void
}

function Section({ status, todos, pendingDeleteId, onOpen, onClearDone }: SectionProps) {
  const [expanded, setExpanded] = useState(true)
  const visible = todos.filter(t => t.id !== pendingDeleteId)

  if (visible.length === 0) return null

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
      <ListItemButton onClick={() => setExpanded(v => !v)} sx={{ px: 2, py: 1.25 }}>
        <ListItemText
          primary={
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
              {status}
            </Typography>
          }
        />
        <Typography variant="caption" color="text.disabled" sx={{ mr: 1 }}>
          {visible.length}
        </Typography>
        {onClearDone && visible.length > 0 && (
          <Button
            size="small"
            color="error"
            variant="text"
            onClick={e => { e.stopPropagation(); onClearDone() }}
            sx={{ mr: 0.5, textTransform: 'none', fontSize: '0.75rem', minWidth: 0, px: 1, py: 0.25 }}
          >
            Clear all
          </Button>
        )}
        {expanded
          ? <ExpandLess fontSize="small" sx={{ color: 'text.disabled' }} />
          : <ExpandMore fontSize="small" sx={{ color: 'text.disabled' }} />
        }
      </ListItemButton>

      <Collapse in={expanded} timeout="auto" unmountOnExit>
        <Divider />
        <List disablePadding>
          {visible.map((todo, idx) => (
            <span key={todo.id}>
              {idx > 0 && <Divider component="li" sx={{ ml: 2 }} />}
              <TodoRow todo={todo} onOpen={onOpen} />
            </span>
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function TodosSkeleton() {
  return (
    <Box>
      {[3, 2].map((rows, gi) => (
        <Box key={gi} sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
          <Box sx={{ px: 2, py: 1.25 }}>
            <Skeleton width={80} height={14} />
          </Box>
          <Divider />
          {Array.from({ length: rows }).map((_, i) => (
            <Box key={i}>
              {i > 0 && <Divider sx={{ ml: 7 }} />}
              <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5, minHeight: 48 }}>
                <Skeleton variant="rectangular" width={18} height={18} sx={{ borderRadius: 0.5, flexShrink: 0 }} />
                <Skeleton width={`${45 + i * 20}%`} height={16} />
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ── Main screen ───────────────────────────────────────────────────────────────

const UNDO_DURATION_MS = 3000

interface PendingDelete {
  todo: Todo
  timeoutId: ReturnType<typeof setTimeout>
}

export default function Todos() {
  const { data: todos, isLoading, error } = useTodos()
  const createTodo = useCreateTodo()
  const updateTodo = useUpdateTodo()
  const deleteTodo = useDeleteTodo()

  const [inputValue, setInputValue] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null)
  const [undoVisible, setUndoVisible] = useState(false)
  const [selectedTodo, setSelectedTodo] = useState<Todo | null>(null)
  const pendingDeleteRef = useRef<PendingDelete | null>(null)

  useEffect(() => {
    pendingDeleteRef.current = pendingDelete
  }, [pendingDelete])

  function handleAdd() {
    const name = inputValue.trim()
    if (!name) return
    setInputValue('')
    createTodo.mutate({ name })
  }

  const commitDelete = useCallback((todo: Todo) => {
    deleteTodo.mutate(todo.id)
    setPendingDelete(null)
    setUndoVisible(false)
  }, [deleteTodo])

  function handleDelete(todo: Todo) {
    const existing = pendingDeleteRef.current
    if (existing) {
      clearTimeout(existing.timeoutId)
      commitDelete(existing.todo)
    }

    const timeoutId = setTimeout(() => commitDelete(todo), UNDO_DURATION_MS)
    const next: PendingDelete = { todo, timeoutId }
    setPendingDelete(next)
    pendingDeleteRef.current = next
    setUndoVisible(true)
  }

  function handleUndo() {
    const existing = pendingDeleteRef.current
    if (!existing) return
    clearTimeout(existing.timeoutId)
    setPendingDelete(null)
    pendingDeleteRef.current = null
    setUndoVisible(false)
  }

  function handleUndoClose(_: React.SyntheticEvent | Event, reason?: string) {
    if (reason === 'clickaway') return
    setUndoVisible(false)
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
    byStatus('Done').forEach(todo => deleteTodo.mutate(todo.id))
  }

  const pendingDeleteId = pendingDelete?.todo.id ?? null
  const byStatus = (status: Status) =>
    (todos ?? []).filter(t => (t.status ?? 'Todo') === status)

  return (
    <>
      {/* List */}
      <Box sx={{ pb: 10 }}>
        {isLoading && <TodosSkeleton />}

        {error && (
          <Typography color="error" sx={{ p: 2 }}>
            Failed to load todos.
          </Typography>
        )}

        {!isLoading && !error && todos?.length === 0 && (
          <Box sx={{ pt: 10, textAlign: 'center', px: 4 }}>
            <Box component="img" src="/casita.png" alt="" sx={{ width: 80, mb: 2, opacity: 0.7 }} />
            <Typography variant="body1" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
              All caught up
            </Typography>
            <Typography variant="body2" color="text.disabled">
              Add a to-do below to get started
            </Typography>
          </Box>
        )}

        {!isLoading && !error && !!todos?.length && STATUSES.map(status => (
          <Section
            key={status}
            status={status}
            todos={byStatus(status)}
            pendingDeleteId={pendingDeleteId}
            onOpen={handleOpen}
            onClearDone={status === 'Done' ? handleClearDone : undefined}
          />
        ))}
      </Box>

      {/* Fixed input bar above tab bar */}
      <Box
        component="form"
        onSubmit={e => { e.preventDefault(); handleAdd() }}
        sx={{
          position: 'fixed',
          bottom: 'calc(56px + env(safe-area-inset-bottom))',
          left: 0,
          right: 0,
          zIndex: 1050,
          display: 'flex',
          gap: 1,
          px: 2,
          py: 1.5,
          bgcolor: 'background.paper',
          borderTop: '1px solid',
          borderColor: 'divider',
          boxShadow: '0 -2px 8px rgba(0,0,0,.06)',
        }}
      >
        <TextField
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          placeholder="Add a to-do…"
          size="small"
          fullWidth
          autoComplete="off"
          inputProps={{ 'aria-label': 'New to-do name' }}
        />
        <Button
          type="submit"
          variant="contained"
          disableElevation
          disabled={!inputValue.trim()}
          sx={{ flexShrink: 0, textTransform: 'none' }}
        >
          Add
        </Button>
      </Box>

      {/* Undo toast — sits above the input bar */}
      <Snackbar
        open={undoVisible}
        autoHideDuration={UNDO_DURATION_MS}
        onClose={handleUndoClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        sx={{ mb: 'calc(112px + env(safe-area-inset-bottom))' }}
      >
        <Alert
          severity="info"
          onClose={handleUndoClose}
          action={
            <Button color="inherit" size="small" onClick={handleUndo} sx={{ fontWeight: 700 }}>
              Undo
            </Button>
          }
          sx={{ width: '100%' }}
        >
          To-do deleted
        </Alert>
      </Snackbar>

      {/* Detail sheet */}
      <TodoDetailSheet
        todo={selectedTodo}
        onClose={handleCloseSheet}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </>
  )
}
