import type { Env, UserCalendar, SharedCalendar } from '../types'

export async function rebuildSharedIndex(
  updatedEmail: string,
  updatedCalendars: UserCalendar[],
  env: Env,
): Promise<void> {
  const existing = await env.AUTH_KV.get('household_shared_calendars')
  const current: SharedCalendar[] = existing ? JSON.parse(existing) : []
  const others = current.filter(e => e.ownerEmail !== updatedEmail)

  const newEntries: SharedCalendar[] = updatedCalendars
    .filter(cal => cal.enabled && cal.visibility !== 'private')
    .map(cal => ({
      calendarId: cal.id,
      ownerEmail: updatedEmail,
      name: cal.name,
      colorHex: cal.colorHex,
      visibility: cal.visibility as 'household' | 'free-busy',
    }))

  await env.AUTH_KV.put(
    'household_shared_calendars',
    JSON.stringify([...others, ...newEntries]),
  )
}
