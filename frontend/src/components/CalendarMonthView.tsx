import { useState, useMemo } from 'react'
import type { CalendarEvent } from '../api/types'
import { useLocale } from '@/hooks/useLocale'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { dayKey } from '@/lib/calendar-utils'

const DEFAULT_EVENT_COLOR = '#1976d2'
const MAX_VISIBLE_EVENTS = 3

// ── Grid helpers ───────────────────────────────────────────────────────────────

interface GridCell {
  date: Date
  dateKey: string
  isCurrentMonth: boolean
}

function buildMonthGrid(year: number, month: number): GridCell[] {
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)

  // Monday-first: Sunday (0) → 6, Monday (1) → 0, …
  const firstDayOfWeek = firstDay.getDay()
  const leadingDays = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1

  const cells: GridCell[] = []

  for (let i = leadingDays - 1; i >= 0; i--) {
    const d = new Date(year, month, -i)
    cells.push({ date: d, dateKey: dayKey(d), isCurrentMonth: false })
  }

  for (let d = 1; d <= lastDay.getDate(); d++) {
    const date = new Date(year, month, d)
    cells.push({ date, dateKey: dayKey(date), isCurrentMonth: true })
  }

  const remaining = 42 - cells.length
  for (let d = 1; d <= remaining; d++) {
    const date = new Date(year, month + 1, d)
    cells.push({ date, dateKey: dayKey(date), isCurrentMonth: false })
  }

  return cells
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function EventPill({ event }: { event: CalendarEvent }) {
  const color = event.color ?? DEFAULT_EVENT_COLOR
  return (
    <div className="flex items-center gap-0.5 mb-px">
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      <span className="text-[10px] leading-[13px] truncate text-foreground/80">{event.title}</span>
    </div>
  )
}

function EventRow({ event }: { event: CalendarEvent }) {
  const color = event.color ?? DEFAULT_EVENT_COLOR
  return (
    <div className={`flex items-stretch rounded overflow-hidden mb-1.5 ${event.source === 'free-busy' ? 'opacity-70' : ''}`}>
      <div className="w-1 flex-shrink-0" style={{ backgroundColor: color }} />
      <div className="px-2 py-1.5 flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{event.title}</p>
        {!event.allDay && (
          <p className="text-xs text-muted-foreground">
            {new Date(event.start).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
            {' – '}
            {new Date(event.end).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}
      </div>
    </div>
  )
}

interface DayCellProps {
  cell: GridCell
  events: CalendarEvent[]
  isToday: boolean
}

function DayCell({ cell, events, isToday }: DayCellProps) {
  const { t } = useTranslation()
  const [sheetOpen, setSheetOpen] = useState(false)
  const visible = events.slice(0, MAX_VISIBLE_EVENTS)
  const hiddenCount = events.length - visible.length

  return (
    <div
      className={`h-full min-h-[40px] border-t border-l border-border/30 p-0.5 ${!cell.isCurrentMonth ? 'bg-muted/20' : ''}`}
    >
      {/* Date number */}
      <div className="flex justify-center mb-0.5">
        <span
          className={`text-[11px] font-medium w-5 h-5 flex items-center justify-center rounded-full leading-none ${
            isToday
              ? 'bg-primary text-primary-foreground font-bold'
              : cell.isCurrentMonth
                ? 'text-foreground'
                : 'text-muted-foreground/50'
          }`}
        >
          {cell.date.getDate()}
        </span>
      </div>

      {/* Event pills */}
      {visible.map(e => <EventPill key={e.id} event={e} />)}

      {hiddenCount > 0 && (
        <button
          onClick={() => setSheetOpen(true)}
          className="text-[10px] text-muted-foreground leading-[13px] hover:text-foreground transition-colors"
        >
          {t('calendar.moreEvents', { count: hiddenCount })}
        </button>
      )}

      {/* Day events sheet */}
      {sheetOpen && (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetContent side="bottom" className="max-h-[70vh]">
            <SheetHeader>
              <SheetTitle className="text-base">
                {cell.date.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4 overflow-y-auto">
              {events.map(e => <EventRow key={e.id} event={e} />)}
            </div>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

interface CalendarMonthViewProps {
  events: CalendarEvent[]
  year: number
  month: number
}

export default function CalendarMonthView({ events, year, month }: CalendarMonthViewProps) {
  const locale = useLocale()

  const cells = useMemo(() => buildMonthGrid(year, month), [year, month])

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const cell of cells) map.set(cell.dateKey, [])
    for (const event of events) {
      const key = dayKey(new Date(event.start))
      if (map.has(key)) map.get(key)!.push(event)
    }
    return map
  }, [events, cells])

  const todayKey = dayKey(new Date())

  const weekDayLabels = useMemo(() => {
    const monday = new Date(2024, 0, 1) // Known Monday
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(d.getDate() + i)
      return d.toLocaleDateString(locale, { weekday: 'short' })
    })
  }, [locale])

  return (
    <div className="flex flex-col select-none" style={{ height: 'calc(100dvh - 180px)' }}>
      {/* Day-of-week header */}
      <div className="flex-shrink-0 grid grid-cols-7 border-b border-border/30">
        {weekDayLabels.map(label => (
          <div key={label} className="text-center text-[10px] text-muted-foreground py-1 font-medium">
            {label}
          </div>
        ))}
      </div>

      {/* Month grid */}
      <div className="flex-1 overflow-hidden grid grid-cols-7 grid-rows-6 border-r border-border/30">
        {cells.map(cell => (
          <DayCell
            key={cell.dateKey}
            cell={cell}
            events={eventsByDay.get(cell.dateKey) ?? []}
            isToday={cell.dateKey === todayKey}
          />
        ))}
      </div>
    </div>
  )
}
