import { useMemo, useState } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft'
import ChevronRightIcon from '@mui/icons-material/ChevronRight'
import { useCalendarEvents } from '../api'
import type { CalendarEvent } from '../api/types'

// ── Date helpers ──────────────────────────────────────────────────────────────

function startOfMonth(year: number, month: number): Date {
  return new Date(year, month, 1)
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

/** Returns ISO string for the start of the visible window for a given month. */
function timeMinFor(year: number, month: number): string {
  const now = new Date()
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth()
  return isCurrentMonth ? now.toISOString() : startOfMonth(year, month).toISOString()
}

/** Day key: "YYYY-MM-DD" extracted from an ISO or date-only string. */
function dayKey(start: string): string {
  return start.slice(0, 10)
}

/** Returns today as "YYYY-MM-DD". */
function todayKey(): string {
  return dayKey(new Date().toISOString().slice(0, 10))
}

/** Human-readable day label. */
function dayLabel(dateStr: string): string {
  // Parse as local midnight to avoid UTC-offset shifting the date
  const [y, m, d] = dateStr.split('-').map(Number)
  const date = new Date(y, m - 1, d)
  const today = new Date()
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)

  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow'

  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' }) // "Wed"
  const day     = date.getDate()                                          // 2
  const month   = date.toLocaleDateString('en-GB', { month: 'short' })   // "Apr"
  return `${weekday}, ${day} ${month}`
}

/** "10:00 AM – 11:30 AM" or "All day". */
function timeRange(event: CalendarEvent): string {
  if (event.allDay) return 'All day'
  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  return `${fmt(event.start)} – ${fmt(event.end)}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

const DEFAULT_EVENT_COLOR = '#1976d2'

function EventCard({ event }: { event: CalendarEvent }) {
  const color = event.color ?? DEFAULT_EVENT_COLOR
  const time  = timeRange(event)

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        bgcolor: 'background.paper',
        borderRadius: 1.5,
        overflow: 'hidden',
        boxShadow: '0 1px 2px rgba(0,0,0,.06)',
        mb: 1,
      }}
    >
      {/* Color strip */}
      <Box sx={{ width: 4, flexShrink: 0, bgcolor: color }} />

      {/* Content */}
      <Box sx={{ px: 1.5, py: 1.25, flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={600} noWrap>
          {event.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {time}
        </Typography>
      </Box>
    </Box>
  )
}

function DaySection({ dateKey, events }: { dateKey: string; events: CalendarEvent[] }) {
  const isToday = dateKey === todayKey()
  return (
    <Box sx={{ mb: 2.5 }}>
      <Typography
        variant="overline"
        sx={{
          display: 'block',
          mb: 0.75,
          letterSpacing: '.06em',
          lineHeight: 1,
          color: isToday ? 'primary.main' : 'text.secondary',
          fontWeight: isToday ? 700 : 400,
        }}
      >
        {dayLabel(dateKey)}
      </Typography>
      {events.map(e => <EventCard key={e.id} event={e} />)}
    </Box>
  )
}

function AgendaSkeleton() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <Box key={i} sx={{ mb: 2.5 }}>
          <Skeleton width={80} height={12} sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', alignItems: 'stretch', borderRadius: 1.5, overflow: 'hidden', mb: 1, bgcolor: 'background.paper' }}>
            <Skeleton variant="rectangular" width={4} height={56} sx={{ flexShrink: 0 }} />
            <Box sx={{ px: 1.5, py: 1.25, flex: 1 }}>
              <Skeleton width="60%" height={14} sx={{ mb: 0.75 }} />
              <Skeleton width={90} height={12} />
            </Box>
          </Box>
        </Box>
      ))}
    </>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export default function Calendar() {
  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const timeMin = useMemo(() => timeMinFor(viewYear, viewMonth),          [viewYear, viewMonth])
  const timeMax = useMemo(() => endOfMonth(viewYear, viewMonth).toISOString(), [viewYear, viewMonth])

  const { data: events, isLoading } = useCalendarEvents(timeMin, timeMax)

  // Group events by day, sorted chronologically
  const dayGroups = useMemo((): Array<{ dateKey: string; events: CalendarEvent[] }> => {
    if (!events?.length) return []

    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = dayKey(e.start)
      const bucket = map.get(key) ?? []
      bucket.push(e)
      map.set(key, bucket)
    }

    // Sort days, then sort events within each day by start time
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dateKey, evs]) => ({
        dateKey,
        events: evs.slice().sort((a, b) => a.start.localeCompare(b.start)),
      }))
  }, [events])

  // Month navigation
  const isCurrentMonth = viewYear === today.getFullYear() && viewMonth === today.getMonth()

  function prevMonth() {
    if (isCurrentMonth) return
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const monthLabel = startOfMonth(viewYear, viewMonth)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  return (
    <Box>
      {/* Month header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 2.5,
        }}
      >
        <IconButton
          size="small"
          onClick={prevMonth}
          disabled={isCurrentMonth}
          sx={{ color: 'text.secondary' }}
        >
          <ChevronLeftIcon />
        </IconButton>

        <Typography
          variant="subtitle1"
          fontWeight={700}
          sx={{ flex: 1, textAlign: 'center' }}
        >
          {monthLabel}
        </Typography>

        <IconButton size="small" onClick={nextMonth} sx={{ color: 'text.secondary' }}>
          <ChevronRightIcon />
        </IconButton>
      </Box>

      {/* Event list */}
      {isLoading ? (
        <AgendaSkeleton />
      ) : dayGroups.length === 0 ? (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <Typography color="text.disabled">Nothing coming up</Typography>
        </Box>
      ) : (
        dayGroups.map(({ dateKey, events: evs }) => (
          <DaySection key={dateKey} dateKey={dateKey} events={evs} />
        ))
      )}
    </Box>
  )
}
