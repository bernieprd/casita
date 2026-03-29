import { useState, useRef, useEffect, useCallback } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import TextField from '@mui/material/TextField'
import Button from '@mui/material/Button'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemIcon from '@mui/material/ListItemIcon'
import ListItemText from '@mui/material/ListItemText'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import Skeleton from '@mui/material/Skeleton'
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useTodos, useCreateTodo, useUpdateTodo, useDeleteTodo } from '../api'
import type { Todo } from '../api'

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUSES = ['Todo', 'In progress', 'On hold', 'Done'] as const
type Status = (typeof STATUSES)[number]

// Checking the checkbox cycles: non-Done → Done; Done → Todo
function nextStatus(current: string | null): Status {
  return current === 'Done' ? 'Todo' : 'Done'
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

const PRIORITY_COLORS: Record<string, { bg: string; color: string }> = {
  High:   { bg: '#fde8e8', color: '#c62828' },
  Medium: { bg: '#fff8e1', color: '#e65100' },
  Low:    { bg: '#f3f3f3', color: '#616161' },
}

function PriorityChip({ priority }: { priority: string | null }) {
  if (!priority) return null
  const style = PRIORITY_COLORS[priority] ?? { bg: '#f3f3f3', color: '#616161' }
  return (
    <Chip
      label={priority}
      size="small"
      sx={{
        height: 20,
        fontSize: '0.68rem',
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
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}

function TodoRow({ todo, onToggle, onDelete }: TodoRowProps) {
  const dueLabel = formatDue(todo.due)
  const isDone = todo.status === 'Done'

  return (
    <ListItem
      disablePadding
      secondaryAction={
        <IconButton
          edge="end"
          size="small"
          aria-label={`Delete ${todo.name}`}
          onClick={() => onDelete(todo)}
          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
        >
          <DeleteOutlineIcon fontSize="small" />
        </IconButton>
      }
      sx={{ px: 2, py: 1 }}
    >
      <ListItemIcon sx={{ minWidth: 40 }}>
        <Checkbox
          edge="start"
          checked={isDone}
          onChange={() => onToggle(todo)}
          size="small"
          tabIndex={-1}
          inputProps={{ 'aria-label': todo.name }}
        />
      </ListItemIcon>
      <ListItemText
        primary={
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
            <Typography
              variant="body2"
              sx={{
                textDecoration: isDone ? 'line-through' : 'none',
                color: isDone ? 'text.disabled' : 'text.primary',
                flexShrink: 1,
                minWidth: 0,
              }}
            >
              {todo.name}
            </Typography>
            <PriorityChip priority={todo.priority} />
            {dueLabel && (
              <Typography
                variant="caption"
                sx={{ color: dueLabel === 'Today' ? 'error.main' : 'text.secondary', flexShrink: 0 }}
              >
                {dueLabel}
              </Typography>
            )}
          </Box>
        }
      />
    </ListItem>
  )
}

// ── Section ───────────────────────────────────────────────────────────────────

interface SectionProps {
  status: Status
  todos: Todo[]
  collapsedByDefault?: boolean
  pendingDeleteId: string | null
  onToggle: (todo: Todo) => void
  onDelete: (todo: Todo) => void
}

function Section({ status, todos, collapsedByDefault, pendingDeleteId, onToggle, onDelete }: SectionProps) {
  const [expanded, setExpanded] = useState(!collapsedByDefault)
  const visible = todos.filter(t => t.id !== pendingDeleteId)

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
              {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
              <TodoRow todo={todo} onToggle={onToggle} onDelete={onDelete} />
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

  function handleToggle(todo: Todo) {
    updateTodo.mutate({ id: todo.id, status: nextStatus(todo.status) })
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

        {!isLoading && !error && STATUSES.map(status => (
          <Section
            key={status}
            status={status}
            todos={byStatus(status)}
            collapsedByDefault={status === 'Done'}
            pendingDeleteId={pendingDeleteId}
            onToggle={handleToggle}
            onDelete={handleDelete}
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
    </>
  )
}
