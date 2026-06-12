import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useCalendarEvents, useGoogleStatus, useUserCalendars } from '../api'
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
    <div
      className={`flex items-stretch bg-card rounded-lg border border-border overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2 ${event.source === 'free-busy' ? 'opacity-70' : ''}`}
    >
      {/* Color strip */}
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />

      {/* Content */}
      <div className="px-3 py-2.5 flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{event.title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}

function DaySection({ dateKey, events }: { dateKey: string; events: CalendarEvent[] }) {
  const isToday = dateKey === todayKey()
  return (
    <div className="mb-5">
      <p
        className={`block mb-2 text-xs font-semibold uppercase tracking-[.06em] leading-none ${
          isToday ? 'text-primary font-bold' : 'text-muted-foreground'
        }`}
      >
        {dayLabel(dateKey)}
      </p>
      {events.map(e => <EventCard key={e.id} event={e} />)}
    </div>
  )
}

function AgendaSkeleton() {
  return (
    <>
      {[0, 1, 2].map(i => (
        <div key={i} className="mb-5">
          <Skeleton className="w-20 h-3 mb-3" />
          <div className="flex items-stretch rounded-xl overflow-hidden mb-2 bg-background">
            <Skeleton className="w-1 h-14 shrink-0" />
            <div className="px-3 py-2.5 flex-1">
              <Skeleton className="w-3/5 h-3.5 mb-2" />
              <Skeleton className="w-[90px] h-3" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// ── Calendar ──────────────────────────────────────────────────────────────────

export default function Calendar({ setHeader }: { setHeader: (node: ReactNode | null) => void }) {
  const today = new Date()
  const [viewYear, setViewYear]   = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const timeMin = useMemo(() => timeMinFor(viewYear, viewMonth),          [viewYear, viewMonth])
  const timeMax = useMemo(() => endOfMonth(viewYear, viewMonth).toISOString(), [viewYear, viewMonth])

  const { data: googleStatus, isLoading: statusLoading } = useGoogleStatus()
  const { data: userCalendars } = useUserCalendars()
  const { data: events, isLoading: eventsLoading } = useCalendarEvents(timeMin, timeMax)
  const isLoading = statusLoading || eventsLoading

  const noneEnabled = googleStatus?.connected &&
    userCalendars?.calendars !== undefined &&
    !userCalendars.calendars.some(c => c.enabled)

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

  const prevMonth = useCallback(() => {
    if (isCurrentMonth) return
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }, [isCurrentMonth, viewMonth])

  const nextMonth = useCallback(() => {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }, [viewMonth])

  const monthLabel = startOfMonth(viewYear, viewMonth)
    .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

  useEffect(() => {
    setHeader(
      <>
        <Button variant="ghost" size="icon" onClick={prevMonth} disabled={isCurrentMonth} className="-ml-2 text-muted-foreground">
          <ChevronLeft className="size-5" />
        </Button>
        <p className="flex-1 text-center text-base font-bold">{monthLabel}</p>
        <Button variant="ghost" size="icon" onClick={nextMonth} className="-mr-2 text-muted-foreground">
          <ChevronRight className="size-5" />
        </Button>
      </>
    )
    return () => setHeader(null)
  }, [monthLabel, isCurrentMonth, prevMonth, nextMonth, setHeader])

  return (
    <div>

      {/* Event list */}
      {isLoading ? (
        <AgendaSkeleton />
      ) : dayGroups.length === 0 ? (
        <div className="pt-10 text-center px-8">
          <img src="/casita.webp" alt="" className="w-20 mb-4 mx-auto opacity-70" />
          <p className="text-sm font-medium text-muted-foreground mb-1">Nothing coming up</p>
          <p className="text-sm text-muted-foreground/60">
            {!googleStatus?.connected
              ? <>Connect Google Calendar in{' '}<Link to="/settings/calendar" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Settings</Link>{' '}to see your events</>
              : noneEnabled
                ? <>No calendars selected —{' '}<Link to="/settings/calendar" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">choose which ones to show</Link></>
                : 'Enjoy the quiet'}
          </p>
        </div>
      ) : (
        <>
          {dayGroups.map(({ dateKey, events: evs }) => (
            <DaySection key={dateKey} dateKey={dateKey} events={evs} />
          ))}
          {!googleStatus?.connected && (
            <div className="pt-4 text-center px-8 pb-4">
              <p className="text-sm text-muted-foreground/60">
                Connect Google Calendar in{' '}<Link to="/settings/calendar" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Settings</Link>{' '}to add your own events
              </p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
