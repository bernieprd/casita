import { useRef, useEffect, useMemo, useState } from 'react'
import type { CalendarEvent } from '../api/types'
import { useLocale } from '@/hooks/useLocale'
import { useTranslation } from 'react-i18next'
import { dayKey, getWeekStart } from '@/lib/calendar-utils'

const HOUR_PX = 48
const GRID_HEIGHT = 24 * HOUR_PX
const DEFAULT_SCROLL_HOUR = 8

const DEFAULT_EVENT_COLOR = '#1976d2'

// ── Layout helpers ─────────────────────────────────────────────────────────────

function isoToMinutes(iso: string): number {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

type LayoutEvent = CalendarEvent & { left: number; width: number }

function layoutDayEvents(events: CalendarEvent[]): LayoutEvent[] {
  if (events.length === 0) return []
  const sorted = [...events].sort((a, b) => a.start.localeCompare(b.start))
  const colEnds: string[] = []
  const assignments: number[] = []

  for (const event of sorted) {
    let placed = false
    for (let col = 0; col < colEnds.length; col++) {
      if (colEnds[col] <= event.start) {
        colEnds[col] = event.end
        assignments.push(col)
        placed = true
        break
      }
    }
    if (!placed) {
      colEnds.push(event.end)
      assignments.push(colEnds.length - 1)
    }
  }

  const numCols = Math.max(1, colEnds.length)
  return sorted.map((event, i) => ({
    ...event,
    left: assignments[i] / numCols,
    width: 1 / numCols,
  }))
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function formatHour(h: number, locale: string): string {
  if (h === 0) return ''
  return new Date(2024, 0, 1, h).toLocaleTimeString(locale, { hour: 'numeric' })
}

interface TimedEventBlockProps {
  event: LayoutEvent
}

function TimedEventBlock({ event }: TimedEventBlockProps) {
  const startMin = isoToMinutes(event.start)
  const endMin = Math.min(24 * 60, isoToMinutes(event.end) || 24 * 60)
  const duration = Math.max(15, endMin - startMin)
  const color = event.color ?? DEFAULT_EVENT_COLOR

  return (
    <div
      className="absolute rounded overflow-hidden px-1 py-0.5 text-white"
      style={{
        top: `${startMin * HOUR_PX / 60}px`,
        height: `${duration * HOUR_PX / 60}px`,
        left: `${event.left * 100}%`,
        width: `calc(${event.width * 100}% - 1px)`,
        backgroundColor: color,
        fontSize: '10px',
        lineHeight: '1.2',
        opacity: event.source === 'free-busy' ? 0.7 : 1,
      }}
    >
      <p className="font-semibold truncate">{event.title}</p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CalendarWeekViewProps {
  events: CalendarEvent[]
  anchorDate: Date
}

export default function CalendarWeekView({ events, anchorDate }: CalendarWeekViewProps) {
  const locale = useLocale()
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)

  const weekStart = useMemo(() => getWeekStart(anchorDate), [anchorDate])

  const weekDays = useMemo(() =>
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(d.getDate() + i)
      return d
    }),
  [weekStart])

  // Scroll to DEFAULT_SCROLL_HOUR on mount and when week changes
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = DEFAULT_SCROLL_HOUR * HOUR_PX
    }
  }, [weekStart])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of weekDays) map.set(dayKey(day), [])
    for (const event of events) {
      if (event.allDay) continue
      const key = dayKey(new Date(event.start))
      if (map.has(key)) map.get(key)!.push(event)
    }
    return map
  }, [events, weekDays])

  const allDayByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const day of weekDays) map.set(dayKey(day), [])
    for (const event of events) {
      if (!event.allDay) continue
      const key = dayKey(new Date(event.start))
      if (map.has(key)) map.get(key)!.push(event)
    }
    return map
  }, [events, weekDays])

  const hasAllDay = useMemo(() =>
    Array.from(allDayByDay.values()).some(evs => evs.length > 0),
  [allDayByDay])

  const today = new Date()
  const todayKey = dayKey(today)
  const isCurrentWeek = weekDays.some(d => dayKey(d) === todayKey)

  const [currentMinutes, setCurrentMinutes] = useState(() => {
    const now = new Date()
    return now.getHours() * 60 + now.getMinutes()
  })

  useEffect(() => {
    const id = setInterval(() => {
      const now = new Date()
      setCurrentMinutes(now.getHours() * 60 + now.getMinutes())
    }, 60_000)
    return () => clearInterval(id)
  }, [])

  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <div className="flex flex-col" style={{ height: 'calc(100dvh - 180px)' }}>

      {/* Day headers */}
      <div className="flex-shrink-0 flex border-b border-border bg-background">
        <div className="w-10 flex-shrink-0" />
        {weekDays.map(day => {
          const key = dayKey(day)
          const isToday = key === todayKey
          return (
            <div key={key} className="flex-1 text-center py-1.5">
              <p className="text-xs text-muted-foreground leading-none mb-0.5">
                {day.toLocaleDateString(locale, { weekday: 'short' })}
              </p>
              <p className={`text-xs font-semibold leading-none w-5 h-5 mx-auto flex items-center justify-center rounded-full ${
                isToday ? 'bg-primary text-primary-foreground' : ''
              }`}>
                {day.getDate()}
              </p>
            </div>
          )
        })}
      </div>

      {/* All-day events row */}
      {hasAllDay && (
        <div className="flex-shrink-0 flex border-b border-border min-h-[28px]">
          <div className="w-10 flex-shrink-0 flex items-start justify-end pr-1 pt-0.5">
            <span className="text-[9px] text-muted-foreground leading-none">{t('calendar.allDay')}</span>
          </div>
          {weekDays.map(day => {
            const key = dayKey(day)
            const dayEvents = allDayByDay.get(key) ?? []
            return (
              <div key={key} className="flex-1 border-l border-border/40 first:border-l-0 p-0.5 flex flex-col gap-0.5">
                {dayEvents.map(e => (
                  <div
                    key={e.id}
                    className="rounded text-white truncate px-1 leading-[14px]"
                    style={{ backgroundColor: e.color ?? DEFAULT_EVENT_COLOR, fontSize: '9px' }}
                  >
                    {e.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="flex relative" style={{ height: `${GRID_HEIGHT}px` }}>

          {/* Time labels */}
          <div className="w-10 flex-shrink-0 relative select-none">
            {hours.map(h => (
              <div
                key={h}
                className="absolute right-1 text-[10px] text-muted-foreground -translate-y-[6px] leading-none"
                style={{ top: `${h * HOUR_PX}px` }}
              >
                {formatHour(h, locale)}
              </div>
            ))}
          </div>

          {/* Day columns */}
          <div className="flex-1 grid relative" style={{ gridTemplateColumns: 'repeat(7, 1fr)' }}>

            {/* Horizontal hour lines */}
            {hours.map(h => (
              <div
                key={h}
                className="absolute left-0 right-0 border-t border-border/30"
                style={{ top: `${h * HOUR_PX}px` }}
              />
            ))}

            {/* Half-hour lines */}
            {hours.map(h => (
              <div
                key={`half-${h}`}
                className="absolute left-0 right-0 border-t border-border/15"
                style={{ top: `${h * HOUR_PX + HOUR_PX / 2}px` }}
              />
            ))}

            {/* Current time indicator */}
            {isCurrentWeek && (
              <div
                className="absolute left-0 right-0 z-10 pointer-events-none"
                style={{ top: `${currentMinutes * HOUR_PX / 60}px` }}
              >
                <div className="h-px bg-red-500 relative">
                  <div className="absolute -left-1 -top-[3px] w-2 h-2 rounded-full bg-red-500" />
                </div>
              </div>
            )}

            {weekDays.map(day => {
              const key = dayKey(day)
              const dayEvents = eventsByDay.get(key) ?? []
              const laid = layoutDayEvents(dayEvents)
              return (
                <div key={key} className="relative border-l border-border/40 first:border-l-0">
                  {laid.map(e => (
                    <TimedEventBlock key={e.id} event={e} />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
