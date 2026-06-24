# Plan: Calendar Event Avatars & Filtering

## Goals

1. Show a small avatar on each calendar event card indicating who the event belongs to — matches the pattern used in todo cards.
2. Add a filter bar at the top of the Calendar page letting the user narrow events by person and/or by calendar source (personal vs. household).

Both features only become meaningful when the household has more than one member, so avatar display and the person filter should be hidden in single-person households.

---

## Current state

- `CalendarEvent` (`frontend/src/api/types.ts:46`) has `id`, `title`, `start`, `end`, `allDay`, `color`, and `source` (`'user' | 'household-shared' | 'free-busy'`).
- Events tagged `source: 'user'` come from the requesting user's own Google Calendars; `source: 'household-shared'` come from other household members' shared Google Calendars.
- The backend (`worker/src/routes/calendar.ts`) already knows *which member* owns each event: user events use `ctx.email`, shared events come from a `SharedCalendar` entry that has `ownerEmail`. That `ownerEmail` is not currently forwarded to the frontend.
- Household members are already fetched via `useHouseholdSettings()` and include `clerkUserId`, `email`, `displayName`, and `imageUrl` (Clerk profile picture).
- `TodoCard` in `frontend/src/components/Todos.tsx:168` already renders stacked avatars from assignees — we reuse the same `Avatar` + `AvatarImage` + `AvatarFallback` pattern.

---

## Data model changes

### Add to `CalendarEvent`

```typescript
// worker/src/types.ts  and  frontend/src/api/types.ts
export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  color: string | null
  source?: 'user' | 'household-shared' | 'free-busy'
  ownerEmail?: string    // NEW — email of the household member who owns this event
  calendarName?: string  // NEW — Google Calendar display name (e.g. "Personal", "Work")
}
```

`ownerEmail` is the join key between an event and a household member. `calendarName` enables the calendar-name chip in the filter bar.

---

## Backend changes

**File:** `worker/src/routes/calendar.ts`

### `fetchUserOAuthEvents` (line 85)

```typescript
events.push({
  id:           'user:' + e.id,
  title:        e.summary ?? '(no title)',
  start:        e.start?.dateTime ?? e.start?.date ?? '',
  end:          e.end?.dateTime   ?? e.end?.date   ?? '',
  allDay:       !e.start?.dateTime,
  color:        e.colorId ? (GCAL_COLORS[e.colorId] ?? cal.colorHex) : cal.colorHex,
  source:       'user' as const,
  ownerEmail:   email,        // NEW — the authenticated user's email
  calendarName: cal.name,     // NEW — e.g. "Personal"
})
```

### `fetchFullSharedCalendar` (line 117)

```typescript
.map(e => ({
  id:           `shared:${entry.calendarId}:${e.id}`,
  ...
  source:       'household-shared' as const,
  ownerEmail:   entry.ownerEmail,   // NEW
  calendarName: entry.name,         // NEW
}))
```

### `fetchFreeBusyCalendar` (line 150)

```typescript
id:           `freebusy:${entry.calendarId}:${i}:${slot.start}`,
...
source:       'free-busy' as const,
ownerEmail:   entry.ownerEmail,   // NEW — still useful for person filter
// calendarName omitted — free-busy events have no title, no calendar attribution shown
```

---

## Frontend changes

### `Calendar.tsx` — Avatar on EventCard

1. Call `useHouseholdSettings()` at the top of the `Calendar` component to get `members`.
2. Pass `members` down to `EventCard` as a prop.
3. Inside `EventCard`, look up the owner and render an avatar:

```tsx
function EventCard({ event, members }: { event: CalendarEvent; members: Member[] }) {
  const owner = members.find(m => m.email === event.ownerEmail)
  const showAvatar = members.length > 1 && event.source !== 'free-busy' && owner

  return (
    <div className={`flex items-stretch bg-card rounded-lg border border-border overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2 ${event.source === 'free-busy' ? 'opacity-70' : ''}`}>
      {/* Color strip */}
      <div className="w-1 shrink-0" style={{ backgroundColor: color }} />

      {/* Content */}
      <div className="px-3 py-2.5 flex-1 min-w-0 flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{event.title}</p>
          <p className="text-xs text-muted-foreground">{time}</p>
        </div>

        {showAvatar && (
          <Avatar className="size-5 shrink-0 ring-1 ring-background">
            {owner.imageUrl && <AvatarImage src={owner.imageUrl} alt={owner.displayName ?? ''} />}
            <AvatarFallback className="text-[0.55rem]">{memberInitials(owner)}</AvatarFallback>
          </Avatar>
        )}
      </div>
    </div>
  )
}
```

The avatar sits to the right of the title/time block, consistent with TodoCard's avatar stacking.

---

### `Calendar.tsx` — Filter bar

Add a `FilterBar` sub-component rendered above the day group list. It is only rendered when `members.length > 1`.

#### Person filter (avatar chips)

One tappable avatar per household member. Selected state shown with a coloured ring.

```tsx
function FilterBar({ members, memberFilter, setMemberFilter, sourceFilter, setSourceFilter }) {
  return (
    <div className="mb-4 space-y-2">
      {/* Person chips */}
      {members.length > 1 && (
        <div className="flex gap-2 flex-wrap">
          {members.map(m => {
            const selected = memberFilter.has(m.email ?? '')
            return (
              <button
                key={m.clerkUserId}
                onClick={() => setMemberFilter(prev => {
                  const next = new Set(prev)
                  m.email && (next.has(m.email) ? next.delete(m.email) : next.add(m.email))
                  return next
                })}
                className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs transition-colors
                  ${selected ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}
              >
                <Avatar className="size-5">
                  {m.imageUrl && <AvatarImage src={m.imageUrl} alt={m.displayName ?? ''} />}
                  <AvatarFallback className="text-[0.5rem]">{memberInitials(m)}</AvatarFallback>
                </Avatar>
                <span>{m.displayName ?? m.email}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Calendar source chips */}
      <div className="flex gap-1.5 flex-wrap">
        {(['user', 'household-shared'] as const).map(src => {
          const label = src === 'user' ? 'Mine' : 'Household'
          const selected = sourceFilter.has(src)
          return (
            <Badge
              key={src}
              variant={selected ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSourceFilter(prev => {
                const next = new Set(prev)
                next.has(src) ? next.delete(src) : next.add(src)
                return next
              })}
            >
              {label}
            </Badge>
          )
        })}
      </div>
    </div>
  )
}
```

#### Filter state & derived day groups

```typescript
const [memberFilter, setMemberFilter] = useState<Set<string>>(new Set())
const [sourceFilter, setSourceFilter] = useState<Set<string>>(new Set())

const filteredDayGroups = useMemo(() => {
  if (memberFilter.size === 0 && sourceFilter.size === 0) return dayGroups
  return dayGroups
    .map(({ dateKey, events }) => ({
      dateKey,
      events: events.filter(e => {
        const passesSource = sourceFilter.size === 0 || (e.source && sourceFilter.has(e.source))
        const passesMember = memberFilter.size === 0 || (e.ownerEmail && memberFilter.has(e.ownerEmail))
        return passesSource && passesMember
      }),
    }))
    .filter(g => g.events.length > 0)
}, [dayGroups, memberFilter, sourceFilter])
```

Replace `dayGroups` with `filteredDayGroups` in the render.

---

## Files to change

| File | What changes |
|------|-------------|
| `worker/src/types.ts` | Add `ownerEmail?` and `calendarName?` to `CalendarEvent` |
| `worker/src/routes/calendar.ts` | Populate `ownerEmail` + `calendarName` in all three fetch functions |
| `frontend/src/api/types.ts` | Mirror the two new optional fields on `CalendarEvent` |
| `frontend/src/components/Calendar.tsx` | `useHouseholdSettings()`, avatar on `EventCard`, `FilterBar` sub-component, filter state + `filteredDayGroups` |
| `frontend/src/components/Home.tsx` | Verify mini calendar section still renders (no breaking changes expected — new fields are optional) |

---

## Import additions for `Calendar.tsx`

```typescript
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { useHouseholdSettings } from '../api'
import { memberInitials } from '@/lib/utils'
import type { HouseholdSettings } from '../api/household'

type Member = HouseholdSettings['members'][number]
```

---

## Edge cases

| Case | Handling |
|------|---------|
| Single-person household | Avatars hidden; FilterBar not rendered |
| `free-busy` events | No avatar shown (privacy); `ownerEmail` still set so person filter works |
| Member has no `imageUrl` | `AvatarFallback` with initials |
| Event `ownerEmail` doesn't match any member | No avatar rendered, event still shown unfiltered |
| Both filters active | AND logic — event must satisfy both |
| All events filtered out | Empty state falls through to "Nothing coming up" message |

---

## Out of scope for v1

- Persisting filter state across navigation (URL params or `localStorage`)
- Count badge on filter chips showing matching event count
- Filtering by individual calendar name (e.g. "Work" vs "Personal") — `calendarName` is captured in the data model so this can be added later
- Calendar source chips hidden when there are no household members sharing (since "Household" would always be empty)
