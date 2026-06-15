import type { Env, UserCalendar, ConnectedAccount, RequestContext } from '../types'
import { getValidAccessToken, ensureMigrated } from './google-auth'
import { rebuildSharedIndex } from './shared-calendar-index'

export async function listUserCalendars(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  await ensureMigrated(ctx.email, env)

  const accountsRaw = await env.AUTH_KV.get(`connected_accounts:${ctx.email}`)
  if (!accountsRaw) {
    return Response.json({ calendars: [], connected: false })
  }

  const accounts: ConnectedAccount[] = JSON.parse(accountsRaw)
  if (accounts.length === 0) {
    return Response.json({ calendars: [], connected: false })
  }

  const allCalendars: UserCalendar[] = []

  for (const account of accounts) {
    const accessToken = await getValidAccessToken(ctx.email, account.accountEmail, env)
    if (!accessToken) continue

    const googleRes = await fetch('https://www.googleapis.com/calendar/v3/users/me/calendarList', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!googleRes.ok) continue

    const googleData = await googleRes.json() as {
      items: Array<{ id: string; summary: string; backgroundColor?: string }>
    }

    const storedRaw = await env.AUTH_KV.get(`user_calendars:${ctx.email}:google:${account.accountEmail}`)
    const stored: UserCalendar[] = storedRaw ? JSON.parse(storedRaw) : []

    const calendars: UserCalendar[] = (googleData.items ?? []).map(item => {
      const match = stored.find(c => c.id === item.id)
      return {
        id: item.id,
        name: item.summary,
        colorHex: item.backgroundColor ?? '#4285F4',
        enabled: match ? match.enabled : false,
        visibility: match?.visibility ?? 'private',
        provider: 'google' as const,
        accountEmail: account.accountEmail,
      }
    })

    allCalendars.push(...calendars)
  }

  return Response.json({ calendars: allCalendars, connected: true })
}

export async function updateUserCalendars(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const calendars = await req.json() as UserCalendar[]

  // Group by (provider, accountEmail) and write each group to its own KV key
  const groups = new Map<string, UserCalendar[]>()
  for (const cal of calendars) {
    const key = `${cal.provider}:${cal.accountEmail}`
    const group = groups.get(key) ?? []
    group.push(cal)
    groups.set(key, group)
  }

  for (const [, group] of groups) {
    const { provider, accountEmail } = group[0]
    await env.AUTH_KV.put(
      `user_calendars:${ctx.email}:${provider}:${accountEmail}`,
      JSON.stringify(group),
      { expirationTtl: 7_776_000 },
    )
  }

  await rebuildSharedIndex(ctx.email, calendars, ctx.householdId, env)
  return Response.json({ ok: true })
}
