import { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import RefreshIcon from '@mui/icons-material/Refresh'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useShoppingList, useRecipes, useTodos, useUpdateTodo, useCalendarEvents } from '../api'
import type { TabId } from '../App'

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionHeader({ label, action }: { label: string; action?: React.ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <Typography variant="overline" color="text.secondary" sx={{ flex: 1, letterSpacing: '.08em', lineHeight: 1 }}>
        {label}
      </Typography>
      {action}
    </Box>
  )
}

function SectionCard({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <Box
      onClick={onClick}
      sx={{
        bgcolor: 'background.paper',
        borderRadius: 2,
        boxShadow: '0 1px 2px rgba(0,0,0,.06)',
        overflow: 'hidden',
        ...(onClick && { cursor: 'pointer', transition: 'opacity .15s', '&:active': { opacity: 0.75 } }),
      }}
    >
      {children}
    </Box>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <Box sx={{ px: 2, py: 2.5, textAlign: 'center' }}>
      <Typography variant="body2" color="text.disabled">{text}</Typography>
    </Box>
  )
}

// ── Calendar preview ──────────────────────────────────────────────────────────

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', { weekday: 'short' })
}

function timeLabel(dateStr: string): string | null {
  if (!dateStr.includes('T')) return null
  return new Date(dateStr).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function CalendarSection({ onNavigate }: { onNavigate: () => void }) {
  const { data: events, isLoading } = useCalendarEvents()

  const upcoming = useMemo(() => {
    if (!events) return []
    const now = new Date()
    return events
      .filter(e => new Date(e.start) >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
      .slice(0, 3)
  }, [events])

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader
        label="Coming up"
        action={
          <IconButton size="small" onClick={onNavigate} sx={{ color: 'text.disabled', mr: -0.5 }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        }
      />
      <SectionCard onClick={onNavigate}>
        {isLoading ? (
          <Box sx={{ px: 2, py: 1.5 }}>
            {[0, 1, 2].map(i => (
              <Box key={i} sx={{ display: 'flex', gap: 2, alignItems: 'center', py: 0.75 }}>
                <Skeleton width={44} height={14} />
                <Skeleton width="55%" height={14} />
                <Skeleton width={40} height={14} sx={{ ml: 'auto' }} />
              </Box>
            ))}
          </Box>
        ) : upcoming.length === 0 ? (
          <EmptyState text="No upcoming events" />
        ) : (
          upcoming.map((event, i) => (
            <Box
              key={event.id}
              sx={{
                px: 2, py: 1.25,
                display: 'flex', alignItems: 'center', gap: 2,
                borderTop: i > 0 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Typography variant="caption" color="primary.main" fontWeight={600} sx={{ minWidth: 44 }}>
                {dayLabel(event.start)}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1 }} noWrap>{event.title}</Typography>
              {timeLabel(event.start) && (
                <Typography variant="caption" color="text.disabled" sx={{ whiteSpace: 'nowrap' }}>
                  {timeLabel(event.start)}
                </Typography>
              )}
            </Box>
          ))
        )}
      </SectionCard>
    </Box>
  )
}

// ── Todo summary ──────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<string, number> = { High: 0, Medium: 1, Low: 2 }

function TodoSection({ onSeeAll }: { onSeeAll: () => void }) {
  const { data: todos, isLoading } = useTodos()
  const updateTodo = useUpdateTodo()

  const { topTodos, remaining } = useMemo(() => {
    if (!todos) return { topTodos: [], remaining: 0 }
    const incomplete = todos
      .filter(t => t.status !== 'Done')
      .sort((a, b) => {
        const pa = a.priority ? (PRIORITY_ORDER[a.priority] ?? 3) : 3
        const pb = b.priority ? (PRIORITY_ORDER[b.priority] ?? 3) : 3
        if (pa !== pb) return pa - pb
        if (a.due && b.due) return a.due.localeCompare(b.due)
        if (a.due) return -1
        if (b.due) return 1
        return 0
      })
    return { topTodos: incomplete.slice(0, 3), remaining: Math.max(0, incomplete.length - 3) }
  }, [todos])

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader
        label="To do"
        action={
          <Typography
            variant="caption"
            color="primary.main"
            fontWeight={600}
            onClick={onSeeAll}
            sx={{ cursor: 'pointer' }}
          >
            See all
          </Typography>
        }
      />
      <SectionCard>
        {isLoading ? (
          <Box sx={{ px: 1, py: 1 }}>
            {[0, 1, 2].map(i => (
              <Box key={i} sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 0.5 }}>
                <Skeleton variant="circular" width={20} height={20} sx={{ ml: 0.75 }} />
                <Skeleton width="60%" height={16} />
              </Box>
            ))}
          </Box>
        ) : topTodos.length === 0 ? (
          <EmptyState text="All caught up" />
        ) : (
          <>
            {topTodos.map((todo, i) => (
              <Box
                key={todo.id}
                sx={{
                  px: 1, py: 0.5,
                  display: 'flex', alignItems: 'center',
                  borderTop: i > 0 ? '1px solid' : 'none',
                  borderColor: 'divider',
                }}
              >
                <Checkbox
                  size="small"
                  checked={todo.status === 'Done'}
                  onChange={() => updateTodo.mutate({ id: todo.id, status: 'Done' })}
                  sx={{ p: 0.75 }}
                />
                <Typography variant="body2" noWrap sx={{ flex: 1 }}>{todo.name}</Typography>
                {todo.priority && (
                  <Chip
                    label={todo.priority}
                    size="small"
                    color={todo.priority === 'High' ? 'error' : todo.priority === 'Medium' ? 'warning' : 'default'}
                    sx={{ fontSize: 10, height: 18, ml: 1 }}
                  />
                )}
                {todo.due && (
                  <Typography variant="caption" color="text.disabled" sx={{ ml: 1, whiteSpace: 'nowrap' }}>
                    {new Date(todo.due).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </Typography>
                )}
              </Box>
            ))}
            {remaining > 0 && (
              <Box
                onClick={onSeeAll}
                sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider', cursor: 'pointer' }}
              >
                <Typography variant="caption" color="text.secondary">+{remaining} more</Typography>
              </Box>
            )}
          </>
        )}
      </SectionCard>
    </Box>
  )
}

// ── Shopping summary ──────────────────────────────────────────────────────────

function ShoppingSection({ onNavigate }: { onNavigate: () => void }) {
  const { data: items, isLoading } = useShoppingList()

  const preview = useMemo(() => {
    if (!items?.length) return { count: 0, groups: [] }
    const groupMap: Record<string, string[]> = {}
    let taken = 0
    for (const item of items) {
      if (taken >= 4) break
      const key = item.category ?? 'Other'
      ;(groupMap[key] ??= []).push(item.name)
      taken++
    }
    return {
      count: items.length,
      groups: Object.entries(groupMap).map(([cat, names]) => `${cat}: ${names.join(', ')}`),
    }
  }, [items])

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader
        label="Shopping list"
        action={
          <IconButton size="small" onClick={onNavigate} sx={{ color: 'text.disabled', mr: -0.5 }}>
            <ChevronRightIcon fontSize="small" />
          </IconButton>
        }
      />
      <SectionCard onClick={onNavigate}>
        {isLoading ? (
          <Box sx={{ px: 2, py: 1.75 }}>
            <Skeleton width={110} height={18} sx={{ mb: 0.75 }} />
            <Skeleton width="75%" height={14} />
          </Box>
        ) : (
          <Box sx={{ px: 2, py: 1.75 }}>
            <Typography variant="body2" fontWeight={600} sx={{ mb: preview.groups.length ? 0.5 : 0 }}>
              {preview.count === 0
                ? 'Nothing on the list'
                : `${preview.count} item${preview.count !== 1 ? 's' : ''} to buy`}
            </Typography>
            {preview.groups.length > 0 && (
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {preview.groups.join(' · ')}
              </Typography>
            )}
          </Box>
        )}
      </SectionCard>
    </Box>
  )
}

// ── Random recipe ─────────────────────────────────────────────────────────────

function RecipeSection({ onNavigate }: { onNavigate: (id: string) => void }) {
  const { data: recipes, isLoading } = useRecipes()
  const [seed, setSeed] = useState(() => Math.random())

  const recipe = useMemo(() => {
    if (!recipes?.length) return null
    return recipes[Math.floor(seed * recipes.length) % recipes.length]
  }, [recipes, seed])

  return (
    <Box sx={{ mb: 3 }}>
      <SectionHeader
        label="Cook this week"
        action={
          <IconButton size="small" onClick={() => setSeed(Math.random())} sx={{ color: 'text.disabled', mr: -0.5 }}>
            <RefreshIcon sx={{ fontSize: 16 }} />
          </IconButton>
        }
      />
      {isLoading ? (
        <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
          <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '16/9' }} />
          <Box sx={{ p: 1.5 }}>
            <Skeleton width="70%" height={20} sx={{ mb: 0.75 }} />
            <Box sx={{ display: 'flex', gap: 0.5 }}>
              <Skeleton width={60} height={20} sx={{ borderRadius: 10 }} />
              <Skeleton width={52} height={20} sx={{ borderRadius: 10 }} />
            </Box>
          </Box>
        </Box>
      ) : !recipe ? (
        <SectionCard><EmptyState text="No recipes yet" /></SectionCard>
      ) : (
        <SectionCard onClick={() => onNavigate(recipe.id)}>
          <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16/9' }}>
            <Box sx={{
              position: 'absolute', inset: 0, bgcolor: 'action.hover',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40,
            }}>
              🍽
            </Box>
            {recipe.coverPhotoUrl && (
              <>
                <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />
                <Box
                  component="img"
                  src={recipe.coverPhotoUrl}
                  alt={recipe.name}
                  decoding="async"
                  sx={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%',
                    objectFit: 'cover', display: 'block',
                    opacity: 0, transition: 'opacity .25s', zIndex: 2,
                  }}
                  onLoad={e => {
                    const img = e.target as HTMLImageElement
                    img.style.opacity = '1';
                    (img.previousElementSibling as HTMLElement | null)?.style.setProperty('display', 'none')
                  }}
                  onError={e => {
                    const img = e.target as HTMLImageElement;
                    (img.previousElementSibling as HTMLElement | null)?.style.setProperty('display', 'none')
                  }}
                />
              </>
            )}
          </Box>
          <Box sx={{ p: 1.5 }}>
            <Typography variant="body1" fontWeight={600} sx={{ mb: 0.75 }}>{recipe.name}</Typography>
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {recipe.type && <Chip label={recipe.type} size="small" color="primary" variant="filled" sx={{ fontSize: 11, height: 20 }} />}
              {recipe.day  && <Chip label={recipe.day}  size="small" variant="outlined"              sx={{ fontSize: 11, height: 20 }} />}
            </Box>
          </Box>
        </SectionCard>
      )}
    </Box>
  )
}

// ── Home ──────────────────────────────────────────────────────────────────────

export default function Home({ onNavigate }: { onNavigate: (tab: TabId, recipeId?: string) => void }) {
  return (
    <Box sx={{ pb: 2 }}>
      <CalendarSection onNavigate={() => onNavigate('calendar')} />
      <TodoSection     onSeeAll={() => onNavigate('todos')} />
      <ShoppingSection onNavigate={() => onNavigate('shopping')} />
      <RecipeSection   onNavigate={id => onNavigate('recipes', id)} />
    </Box>
  )
}
