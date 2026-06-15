import { useMemo, useState, useEffect, useCallback, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { useCalendarEvents, useGoogleStatus, useUserCalendars } from '../api'
import type { CalendarEvent } from '../api/types'
import { useTranslation } from 'react-i18next'
import { useLocale } from '@/hooks/useLocale'
import { makeDayLabel } from '@/lib/dayLabel'
import CalendarWeekView from './CalendarWeekView'
import CalendarMonthView from './CalendarMonthView'

// ── Types ─────────────────────────────────────────────────────────────────────

type CalendarView = 'agenda' | 'week' | 'month'

// ── Date helpers ──────────────────────────────────────────────────────────────

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return end
}

function endOfMonth(year: number, month: number): Date {
  return new Date(year, month + 1, 0, 23, 59, 59, 999)
}

/** Day key: "YYYY-MM-DD" extracted from an ISO or date-only string. */
function dayKey(start: string): string {
  return start.slice(0, 10)
}

/** Returns today as "YYYY-MM-DD". */
function todayKey(): string {
  return dayKey(new Date().toISOString().slice(0, 10))
}

/** "10:00 AM – 11:30 AM" or "All day". */
function makeTimeRange(locale: string, allDayLabel: string) {
  return (event: CalendarEvent): string => {
    if (event.allDay) return allDayLabel
    const fmt = (iso: string) =>
      new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit' })
    return `${fmt(event.start)} – ${fmt(event.end)}`
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

const DEFAULT_EVENT_COLOR = '#1976d2'

function EventCard({ event }: { event: CalendarEvent }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const timeRange = useMemo(() => makeTimeRange(locale, t('calendar.allDay')), [locale, t])
  const color = event.color ?? DEFAULT_EVENT_COLOR
  const time  = timeRange(event)

  return (
    <div
      className={`flex items-stretch bg-card rounded-lg border border-border overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2 ${event.source === 'free-busy' ? 'opacity-70' : ''}`}
    >
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />
      <div className="px-3 py-2.5 flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{event.title}</p>
        <p className="text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}

function DaySection({ dateKey, events }: { dateKey: string; events: CalendarEvent[] }) {
  const { t } = useTranslation()
  const locale = useLocale()
  const dayLabel = useMemo(() => makeDayLabel(locale, t('home.today'), t('home.tomorrow')), [locale, t])
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
  const locale = useLocale()
  const { t } = useTranslation()
  const today = new Date()

  const [view, setView] = useState<CalendarView>(() => {
    const stored = localStorage.getItem('calendar-view')
    return (stored === 'week' || stored === 'month') ? stored : 'agenda'
  })

  const [anchorDate, setAnchorDate] = useState(() => new Date())

  // Persist view preference
  useEffect(() => {
    localStorage.setItem('calendar-view', view)
  }, [view])

  // Time window based on view
  const timeMin = useMemo(() => {
    if (view === 'week') return getWeekStart(anchorDate).toISOString()
    const y = anchorDate.getFullYear()
    const m = anchorDate.getMonth()
    if (view === 'month') return new Date(y, m, 1, 0, 0, 0, 0).toISOString()
    // agenda: from now if current month, else start of month
    const isCurrentMonth = y === today.getFullYear() && m === today.getMonth()
    return isCurrentMonth ? today.toISOString() : new Date(y, m, 1).toISOString()
  }, [view, anchorDate])

  const timeMax = useMemo(() => {
    if (view === 'week') return getWeekEnd(anchorDate).toISOString()
    return endOfMonth(anchorDate.getFullYear(), anchorDate.getMonth()).toISOString()
  }, [view, anchorDate])

  const { data: googleStatus, isLoading: statusLoading } = useGoogleStatus()
  const accounts = googleStatus?.accounts ?? []
  const isConnected = accounts.length > 0

  const { data: userCalendars, isLoading: calendarsLoading } = useUserCalendars()
  const { data: events, isLoading: eventsLoading } = useCalendarEvents(timeMin, timeMax)
  const isLoading = statusLoading || eventsLoading || calendarsLoading

  const noneEnabled = isConnected &&
    userCalendars?.calendars !== undefined &&
    !userCalendars.calendars.some(c => c.enabled)

  // Group events by day for agenda view
  const dayGroups = useMemo((): Array<{ dateKey: string; events: CalendarEvent[] }> => {
    if (!events?.length) return []
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const key = dayKey(e.start)
      const bucket = map.get(key) ?? []
      bucket.push(e)
      map.set(key, bucket)
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([dk, evs]) => ({
        dateKey: dk,
        events: evs.slice().sort((a, b) => a.start.localeCompare(b.start)),
      }))
  }, [events])

  // Navigation
  const isPrevDisabled = useMemo(() => {
    if (view !== 'agenda') return false
    return anchorDate.getFullYear() === today.getFullYear() && anchorDate.getMonth() === today.getMonth()
  }, [view, anchorDate])

  const navigate = useCallback((dir: -1 | 1) => {
    setAnchorDate(d => {
      if (view === 'week') {
        return new Date(d.getTime() + dir * 7 * 24 * 60 * 60 * 1000)
      }
      return new Date(d.getFullYear(), d.getMonth() + dir, 1)
    })
  }, [view])

  // Period label
  const periodLabel = useMemo(() => {
    if (view === 'week') {
      const ws = getWeekStart(anchorDate)
      const we = getWeekEnd(anchorDate)
      const startStr = ws.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      const endStr = we.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
      return `${startStr} – ${endStr}`
    }
    return new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1)
      .toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }, [view, anchorDate, locale])

  const prevCallback = useCallback(() => navigate(-1), [navigate])
  const nextCallback = useCallback(() => navigate(1), [navigate])

  useEffect(() => {
    setHeader(
      <>
        <Button
          variant="ghost"
          size="icon"
          onClick={prevCallback}
          disabled={isPrevDisabled}
          className="-ml-2 text-muted-foreground"
        >
          <ChevronLeft className="size-5" />
        </Button>
        <p className="flex-1 text-center text-base font-bold">{periodLabel}</p>
        <Button
          variant="ghost"
          size="icon"
          onClick={nextCallback}
          className="-mr-2 text-muted-foreground"
        >
          <ChevronRight className="size-5" />
        </Button>
      </>
    )
    return () => setHeader(null)
  }, [periodLabel, isPrevDisabled, prevCallback, nextCallback, setHeader])

  return (
    <div>

      {/* View switcher */}
      <div className="mb-3">
        <ToggleGroup
          type="single"
          value={view}
          onValueChange={v => v && setView(v as CalendarView)}
          variant="outline"
          size="sm"
          className="w-full"
        >
          <ToggleGroupItem value="agenda" className="flex-1 text-xs">
            {t('calendar.viewAgenda')}
          </ToggleGroupItem>
          <ToggleGroupItem value="week" className="flex-1 text-xs">
            {t('calendar.viewWeek')}
          </ToggleGroupItem>
          <ToggleGroupItem value="month" className="flex-1 text-xs">
            {t('calendar.viewMonth')}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Week view */}
      {view === 'week' && (
        isLoading ? <AgendaSkeleton /> : <CalendarWeekView events={events ?? []} anchorDate={anchorDate} />
      )}

      {/* Month view */}
      {view === 'month' && (
        isLoading ? <AgendaSkeleton /> :
        <CalendarMonthView
          events={events ?? []}
          year={anchorDate.getFullYear()}
          month={anchorDate.getMonth()}
        />
      )}

      {/* Agenda view */}
      {view === 'agenda' && (
        isLoading ? (
          <AgendaSkeleton />
        ) : dayGroups.length === 0 ? (
          <div className="pt-10 text-center px-8">
            <img src="/casita.webp" alt="" className="w-20 mb-4 mx-auto opacity-70" />
            <p className="text-sm font-medium text-muted-foreground mb-1">Nothing coming up</p>
            <p className="text-sm text-muted-foreground/60">
              {!isConnected
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
            {!isConnected && (
              <div className="pt-4 text-center px-8 pb-4">
                <p className="text-sm text-muted-foreground/60">
                  Connect Google Calendar in{' '}<Link to="/settings/calendar" className="underline underline-offset-2 hover:text-muted-foreground transition-colors">Settings</Link>{' '}to add your own events
                </p>
              </div>
            )}
          </>
        )
      )}
    </div>
  )
}
