import type { Env, UserCalendar } from '../types'
import { getValidAccessToken } from './google-auth'

async function getEmailFromRequest(req: Request, env: Env): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const raw = await env.AUTH_KV.get(`session:${token}`)
  if (!raw) return null
  const { email, expiresAt } = JSON.parse(raw) as { email: string; expiresAt: number }
  if (Date.now() > expiresAt) return null
  return email
}

export async function listUserCalendars(req: Request, env: Env): Promise<Response> {
  const email = await getEmailFromRequest(req, env)
  if (!email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accessToken = await getValidAccessToken(email, env)
  if (!accessToken) {
    return Response.json({ calendars: [], connected: false })
  }

  const googleRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  const googleData = await googleRes.json() as { items: Array<{ id: string; summary: string; backgroundColor?: string }> }

  const storedRaw = await env.AUTH_KV.get(`user_calendars:${email}`)
  const stored: UserCalendar[] = storedRaw ? JSON.parse(storedRaw) : []

  const calendars: UserCalendar[] = (googleData.items ?? []).map(item => {
    const match = stored.find(c => c.id === item.id)
    return {
      id: item.id,
      name: item.summary,
      colorHex: item.backgroundColor ?? '#4285F4',
      enabled: match ? match.enabled : false,
    }
  })

  return Response.json({ calendars, connected: true })
}

export async function updateUserCalendars(req: Request, env: Env): Promise<Response> {
  const email = await getEmailFromRequest(req, env)
  if (!email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const calendars = await req.json() as UserCalendar[]
  await env.AUTH_KV.put(`user_calendars:${email}`, JSON.stringify(calendars))

  return Response.json({ ok: true })
}
