import type { Env, CalendarEvent, UserCalendar, SharedCalendar } from '../types'
import { getValidAccessToken } from './google-auth'

// ── JWT / OAuth2 helpers ──────────────────────────────────────────────────────

function b64url(data: ArrayBuffer | string): string {
  const bytes =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : new Uint8Array(data)
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function pemToBytes(pem: string): ArrayBuffer {
  // Handle both literal \n (from .dev.vars) and real newlines (from wrangler secrets)
  const normalized = pem.replace(/\\n/g, '\n')
  const body = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function getAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000)

  const header  = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const payload = b64url(JSON.stringify({
    iss:   env.GCAL_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/calendar.readonly',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }))

  const signingInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToBytes(env.GCAL_PRIVATE_KEY!),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(signingInput),
  )

  const jwt = `${signingInput}.${b64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }),
  })

  const data = await res.json() as { access_token?: string; error?: string; error_description?: string }
  if (!data.access_token) {
    throw new Error(`OAuth token error: ${data.error} – ${data.error_description}`)
  }
  return data.access_token
}

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

async function fetchServiceAccountEvents(
  env: Env,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  if (!env.GCAL_PRIVATE_KEY || !env.GCAL_CLIENT_EMAIL || !env.GCAL_CALENDAR_ID) {
    return []
  }

  const accessToken = await getAccessToken(env)

  const calendarId = encodeURIComponent(env.GCAL_CALENDAR_ID)
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: 'true',
    orderBy:      'startTime',
    maxResults:   '50',
  })

  const gcalRes = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  )

  const body = await gcalRes.json() as GCalListResponse

  if (!gcalRes.ok) {
    console.error('Google Calendar API error:', body.error)
    return []
  }

  return (body.items ?? [])
    .filter(e => e.status !== 'cancelled')
    .map(e => ({
      id:     e.id,
      title:  e.summary ?? '(No title)',
      start:  e.start.dateTime ?? e.start.date ?? '',
      end:    e.end.dateTime   ?? e.end.date   ?? '',
      allDay: Boolean(e.start.date && !e.start.dateTime),
      color:  e.colorId ? (GCAL_COLORS[e.colorId] ?? null) : null,
      source: 'household' as const,
    }))
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
        { headers: { Authorization: `Bearer ${accessToken}` } },
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
    { headers: { Authorization: `Bearer ${accessToken}` } },
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
  requestingEmail: string,
  env: Env,
  timeMin: string,
  timeMax: string,
): Promise<CalendarEvent[]> {
  const raw = await env.AUTH_KV.get('household_shared_calendars')
  if (!raw) return []

  const index = (JSON.parse(raw) as SharedCalendar[])
    .filter(entry => entry.ownerEmail !== requestingEmail)

  if (index.length === 0) return []

  const results = await Promise.allSettled(
    index.map(async entry => {
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
): Promise<Response> {
  const reqUrl = new URL(req.url)
  const now = new Date()
  const defaultMax = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000)
  const timeMin = reqUrl.searchParams.get('timeMin') ?? now.toISOString()
  const timeMax = reqUrl.searchParams.get('timeMax') ?? defaultMax.toISOString()

  // Resolve the session email from the Authorization header
  let email: string | null = null
  const sessionToken = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (sessionToken) {
    const sessionRaw = await env.AUTH_KV.get(`session:${sessionToken}`)
    if (sessionRaw) {
      const session = JSON.parse(sessionRaw) as { email: string; expiresAt: number }
      if (session.expiresAt >= Date.now()) {
        email = session.email
      }
    }
  }

  try {
    const [householdEvents, userEvents, sharedEvents] = await Promise.all([
      fetchServiceAccountEvents(env, timeMin, timeMax),
      email ? fetchUserOAuthEvents(email, env, timeMin, timeMax) : Promise.resolve([] as CalendarEvent[]),
      email ? fetchSharedCalendarEvents(email, env, timeMin, timeMax) : Promise.resolve([] as CalendarEvent[]),
    ])

    const events = [...householdEvents, ...userEvents, ...sharedEvents]
      .sort((a, b) => a.start.localeCompare(b.start))

    return Response.json(events)
  } catch (err) {
    console.error('Calendar fetch failed:', err)
    return Response.json([])
  }
}
