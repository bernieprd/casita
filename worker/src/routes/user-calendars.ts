import type { Env, UserCalendar, RequestContext } from '../types'
import { getValidAccessToken } from './google-auth'
import { rebuildSharedIndex } from './shared-calendar-index'

export async function listUserCalendars(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const clerkUserId = ctx.clerkUserId

  const accessToken = await getValidAccessToken(clerkUserId, env)
  if (!accessToken) {
    return Response.json({ calendars: [], connected: false })
  }

  const googleRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const googleData = await googleRes.json() as { items: Array<{ id: string; summary: string; backgroundColor?: string }> }

  const storedRaw = await env.AUTH_KV.get(`user_calendars:${clerkUserId}`)
  const stored: UserCalendar[] = storedRaw ? JSON.parse(storedRaw) : []

  const calendars: UserCalendar[] = (googleData.items ?? []).map(item => {
    const match = stored.find(c => c.id === item.id)
    return {
      id: item.id,
      name: item.summary,
      colorHex: item.backgroundColor ?? '#4285F4',
      enabled: match ? match.enabled : false,
      visibility: match?.visibility ?? 'private',
    }
  })

  return Response.json({ calendars, connected: true })
}

export async function updateUserCalendars(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const clerkUserId = ctx.clerkUserId

  const calendars = await req.json() as UserCalendar[]
  await env.AUTH_KV.put(`user_calendars:${clerkUserId}`, JSON.stringify(calendars))
  await rebuildSharedIndex(clerkUserId, calendars, env)

  return Response.json({ ok: true })
}
