import type { Env, UserCalendar, SharedCalendar } from '../types'

export async function rebuildSharedIndex(
  updatedEmail: string,
  updatedCalendars: UserCalendar[],
  householdId: string | null,
  env: Env,
): Promise<void> {
  if (!householdId) return

  const key = `household_shared_calendars:${householdId}`
  const existing = await env.AUTH_KV.get(key)
  const current: SharedCalendar[] = existing ? JSON.parse(existing) : []
  const others = current.filter(e => e.ownerEmail !== updatedEmail)

  const newEntries: SharedCalendar[] = updatedCalendars
    .filter(cal => cal.enabled && cal.visibility !== 'private')
    .map(cal => ({
      calendarId: cal.id,
      ownerEmail: updatedEmail,
      accountEmail: cal.accountEmail,
      name: cal.name,
      colorHex: cal.colorHex,
      visibility: cal.visibility as 'household' | 'free-busy',
      provider: cal.provider,
    }))

  await env.AUTH_KV.put(key, JSON.stringify([...others, ...newEntries]))
}
