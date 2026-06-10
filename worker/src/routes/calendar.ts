import type { Env, CalendarEvent, UserCalendar, SharedCalendar, RequestContext } from '../types'
import { getValidAccessToken } from './google-auth'

// ── Google Calendar color map ─────────────────────────────────────────────────

const GCAL_COLORS: Record<string, string> = {
  '1':  '#7986cb', // Lavender
  '2':  '#33b679', // Sage
  '3':  '#8e24aa', // Grape
  '4':  '#e67c73', // Flamingo
  '5':  '#f6c026', // Banana
  '6':  '#f5511d', // Tangerine
  '7':  '#039be5', // Peacock
  '8':  '#3f51b5', // Blueberry
  '9':  '#0b8043', // Basil
  '10': '#d50000', // Tomato
  '11': '#f09300', // Pumpkin
}

// ── Route handler ─────────────────────────────────────────────────────────────

interface GCalEventDateTime {
  dateTime?: string
  date?: string
}

interface GCalEvent {
  id: string
  summary?: string
  start: GCalEventDateTime
  end: GCalEventDateTime
  colorId?: string
  status?: string
}

interface GCalListResponse {
  items?: GCalEvent[]
  error?: { code: number; message: string }
}

interface FreeBusyResponse {
  calendars: Record<string, { busy: Array<{ start: string; end: string }> }>
}

async function fetchUserOAuthEvents(
  email: string,
  env: Env,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const accessToken = await getValidAccessToken(email, env)
  if (!accessToken) return []

  const calendarsRaw = await env.AUTH_KV.get(`user_calendars:${email}`)
  if (!calendarsRaw) return []

  const allCalendars = JSON.parse(calendarsRaw) as UserCalendar[]
  const enabledCalendars = allCalendars.filter(cal => cal.enabled)
  if (enabledCalendars.length === 0) return []

  const results = await Promise.allSettled(
    enabledCalendars.map(cal =>
      fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal.id)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
        { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
      ).then(async res => ({ cal, res, body: await res.json() as GCalListResponse })),
    ),
  )

  // Check for 401 from any calendar — revoke tokens and bail out
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.res.status === 401) {
      await env.AUTH_KV.delete(`google_tokens:${email}`)
      return []
    }
  }

  const events: CalendarEvent[] = []
  for (const result of results) {
    if (result.status !== 'fulfilled') continue
    const { cal, res, body } = result.value
    if (!res.ok) continue
    for (const e of body.items ?? []) {
      if (e.status === 'cancelled') continue
      events.push({
        id:     'user:' + e.id,
        title:  e.summary ?? '(no title)',
        start:  e.start?.dateTime ?? e.start?.date ?? '',
        end:    e.end?.dateTime   ?? e.end?.date   ?? '',
        allDay: !e.start?.dateTime,
        color:  e.colorId ? (GCAL_COLORS[e.colorId] ?? cal.colorHex) : cal.colorHex,
        source: 'user' as const,
      })
    }
  }

  return events
}

async function fetchFullSharedCalendar(
  entry: SharedCalendar,
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin, timeMax, singleEvents: 'true', orderBy: 'startTime', maxResults: '50',
  })
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(entry.calendarId)}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) },
  )
  if (!res.ok) return []
  const body = await res.json() as GCalListResponse
  return (body.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      id:     `shared:${entry.calendarId}:${e.id}`,
      title:  e.summary ?? '(No title)',
      start:  e.start.dateTime ?? e.start.date ?? '',
      end:    e.end.dateTime   ?? e.end.date   ?? '',
      allDay: Boolean(e.start.date && !e.start.dateTime),
      color:  e.colorId ? (GCAL_COLORS[e.colorId] ?? entry.colorHex) : entry.colorHex,
      source: 'household-shared' as const,
    }))
}

async function fetchFreeBusyCalendar(
  entry: SharedCalendar,
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      timeMin,
      timeMax,
      items: [{ id: entry.calendarId }],
    }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return []
  const body = await res.json() as FreeBusyResponse
  const busySlots = body.calendars?.[entry.calendarId]?.busy ?? []
  return busySlots.map((slot, i) => ({
    id:     `freebusy:${entry.calendarId}:${i}:${slot.start}`,
    title:  'Busy',
    start:  slot.start,
    end:    slot.end,
    allDay: false,
    color:  entry.colorHex,
    source: 'free-busy' as const,
  }))
}

async function fetchSharedCalendarEvents(
  email: string,
  householdId: string | null,
  env: Env,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  if (!householdId) return []

  const raw = await env.AUTH_KV.get(`household_shared_calendars:${householdId}`)
  if (!raw) return []

  const index = JSON.parse(raw) as SharedCalendar[]

  // Skip entries owned by the requesting user — already fetched via fetchUserOAuthEvents
  const othersEntries = index.filter(e => e.ownerEmail !== email)

  if (othersEntries.length === 0) return []

  const results = await Promise.allSettled(
    othersEntries.map(async entry => {
      const accessToken = await getValidAccessToken(entry.ownerEmail, env)
      if (!accessToken) return [] as CalendarEvent[]
      if (entry.visibility === 'household') {
        return fetchFullSharedCalendar(entry, accessToken, timeMin, timeMax)
      } else {
        return fetchFreeBusyCalendar(entry, accessToken, timeMin, timeMax)
      }
    }),
  )

  const events: CalendarEvent[] = []
  for (const result of results) {
    if (result.status === 'fulfilled') events.push(...result.value)
  }
  return events
}

export async function getCalendarEvents(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const reqUrl = new URL(req.url)
  const now = new Date()
  const defaultMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const timeMin = reqUrl.searchParams.get('timeMin') ?? now.toISOString()
  const timeMax = reqUrl.searchParams.get('timeMax') ?? defaultMax.toISOString()

  const email = ctx.email

  try {
    const [userEvents, sharedEvents] = await Promise.all([
      fetchUserOAuthEvents(email, env, timeMin, timeMax),
      fetchSharedCalendarEvents(email, ctx.householdId, env, timeMin, timeMax),
    ])

    const events = [...userEvents, ...sharedEvents]
      .sort((a, b) => a.start.localeCompare(b.start))

    return Response.json(events)
  } catch (err) {
    console.error('Calendar fetch failed:', err)
    return Response.json([])
  }
}
