import type { Env, GoogleTokens, ConnectedAccount, UserCalendar, RequestContext } from '../types'
import { getAppBaseUrl } from '../types'
import { rebuildSharedIndex } from './shared-calendar-index'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly'

export async function initiateGoogleOAuth(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const state = crypto.randomUUID()
  await env.AUTH_KV.put(`oauth_state:${state}`, JSON.stringify({ email: ctx.email }), { expirationTtl: 600 })

  const googleUrl = new URL(GOOGLE_AUTH_URL)
  googleUrl.searchParams.set('client_id', env.GOOGLE_CLIENT_ID ?? '')
  googleUrl.searchParams.set('redirect_uri', env.GOOGLE_REDIRECT_URI ?? '')
  googleUrl.searchParams.set('response_type', 'code')
  googleUrl.searchParams.set('scope', GOOGLE_SCOPES)
  googleUrl.searchParams.set('access_type', 'offline')
  googleUrl.searchParams.set('prompt', 'consent')
  googleUrl.searchParams.set('state', state)

  return Response.json({ url: googleUrl.toString() })
}

export async function handleGoogleOAuthCallback(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (!code || !state) {
    return Response.json({ error: 'ERR_OAUTH_MISSING_PARAMS' }, { status: 400 })
  }

  const stateRaw = await env.AUTH_KV.get(`oauth_state:${state}`)
  if (!stateRaw) {
    return Response.json({ error: 'ERR_OAUTH_INVALID_STATE' }, { status: 400 })
  }

  await env.AUTH_KV.delete(`oauth_state:${state}`)

  const { email: userEmail } = JSON.parse(stateRaw) as { email: string }

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      redirect_uri: env.GOOGLE_REDIRECT_URI ?? '',
      grant_type: 'authorization_code',
    }),
  })

  if (!tokenRes.ok) {
    return Response.json({ error: 'ERR_OAUTH_TOKEN_EXCHANGE' }, { status: 502 })
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  // Get the Google account's email via userinfo
  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  })
  if (!userinfoRes.ok) {
    return Response.json({ error: 'ERR_OAUTH_TOKEN_EXCHANGE' }, { status: 502 })
  }
  const { email: accountEmail } = await userinfoRes.json() as { email: string }

  const tokenPayload: GoogleTokens = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: Date.now() + tokens.expires_in * 1000,
  }

  await env.AUTH_KV.put(
    `oauth_tokens:${userEmail}:google:${accountEmail}`,
    JSON.stringify(tokenPayload),
    { expirationTtl: 7_776_000 },
  )

  // Update connected_accounts index (add if not already present, update connectedAt if reconnecting)
  const accountsRaw = await env.AUTH_KV.get(`connected_accounts:${userEmail}`)
  const existing: ConnectedAccount[] = accountsRaw ? JSON.parse(accountsRaw) : []
  const others = existing.filter(a => a.accountEmail !== accountEmail)
  const updated: ConnectedAccount[] = [
    ...others,
    { provider: 'google', accountEmail, connectedAt: Date.now() },
  ]
  await env.AUTH_KV.put(`connected_accounts:${userEmail}`, JSON.stringify(updated))

  const baseUrl = getAppBaseUrl(env)
  return Response.redirect(`${baseUrl}/settings/calendar?google=connected`, 302)
}

export async function getGoogleAuthStatus(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  await ensureMigrated(ctx.email, env)
  const accountsRaw = await env.AUTH_KV.get(`connected_accounts:${ctx.email}`)
  const accounts: ConnectedAccount[] = accountsRaw ? JSON.parse(accountsRaw) : []
  return Response.json({ accounts })
}

export async function disconnectGoogle(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const url = new URL(req.url)
  const accountEmail = url.searchParams.get('account')

  if (!accountEmail) {
    // Disconnect all accounts
    const accountsRaw = await env.AUTH_KV.get(`connected_accounts:${ctx.email}`)
    const accounts: ConnectedAccount[] = accountsRaw ? JSON.parse(accountsRaw) : []
    await Promise.all([
      ...accounts.map(a => env.AUTH_KV.delete(`oauth_tokens:${ctx.email}:google:${a.accountEmail}`)),
      ...accounts.map(a => env.AUTH_KV.delete(`user_calendars:${ctx.email}:google:${a.accountEmail}`)),
      env.AUTH_KV.delete(`connected_accounts:${ctx.email}`),
      env.AUTH_KV.delete(`google_tokens:${ctx.email}`),
      env.AUTH_KV.delete(`user_calendars:${ctx.email}`),
    ])
    await rebuildSharedIndex(ctx.email, [], ctx.householdId, env)
    return Response.json({ ok: true })
  }

  // Disconnect specific account
  await Promise.all([
    env.AUTH_KV.delete(`oauth_tokens:${ctx.email}:google:${accountEmail}`),
    env.AUTH_KV.delete(`user_calendars:${ctx.email}:google:${accountEmail}`),
  ])

  const accountsRaw = await env.AUTH_KV.get(`connected_accounts:${ctx.email}`)
  const accounts: ConnectedAccount[] = accountsRaw ? JSON.parse(accountsRaw) : []
  const remaining = accounts.filter(a => a.accountEmail !== accountEmail)
  await env.AUTH_KV.put(`connected_accounts:${ctx.email}`, JSON.stringify(remaining))

  // Rebuild shared index with remaining accounts' calendars
  const remainingCalendars: UserCalendar[] = []
  for (const account of remaining) {
    const calsRaw = await env.AUTH_KV.get(`user_calendars:${ctx.email}:google:${account.accountEmail}`)
    if (calsRaw) remainingCalendars.push(...JSON.parse(calsRaw) as UserCalendar[])
  }
  await rebuildSharedIndex(ctx.email, remainingCalendars, ctx.householdId, env)

  return Response.json({ ok: true })
}

export async function getValidAccessToken(userEmail: string, accountEmail: string, env: Env): Promise<string | null> {
  const raw = await env.AUTH_KV.get(`oauth_tokens:${userEmail}:google:${accountEmail}`)
  if (!raw) return null

  const tokens = JSON.parse(raw) as GoogleTokens

  if (tokens.expiresAt > Date.now() + 60_000) {
    return tokens.accessToken
  }

  const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: env.GOOGLE_CLIENT_ID ?? '',
      client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
      refresh_token: tokens.refreshToken,
    }),
  })

  const refreshData = await refreshRes.json() as {
    access_token?: string
    expires_in?: number
    error?: string
  }

  if (refreshData.error === 'invalid_grant') {
    await env.AUTH_KV.delete(`oauth_tokens:${userEmail}:google:${accountEmail}`)
    return null
  }

  if (!refreshRes.ok || !refreshData.access_token) {
    return null
  }

  await env.AUTH_KV.put(
    `oauth_tokens:${userEmail}:google:${accountEmail}`,
    JSON.stringify({
      accessToken: refreshData.access_token,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + (refreshData.expires_in ?? 3600) * 1000,
    }),
    { expirationTtl: 7_776_000 },
  )

  return refreshData.access_token
}

/** Migrates users from the old single-account KV key format to the new multi-account format. */
export async function ensureMigrated(userEmail: string, env: Env): Promise<void> {
  const accountsRaw = await env.AUTH_KV.get(`connected_accounts:${userEmail}`)
  if (accountsRaw !== null) return

  const oldTokensRaw = await env.AUTH_KV.get(`google_tokens:${userEmail}`)
  if (!oldTokensRaw) return

  const oldTokens = JSON.parse(oldTokensRaw) as GoogleTokens

  let accessToken = oldTokens.accessToken
  if (oldTokens.expiresAt <= Date.now() + 60_000) {
    const refreshRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: env.GOOGLE_CLIENT_ID ?? '',
        client_secret: env.GOOGLE_CLIENT_SECRET ?? '',
        refresh_token: oldTokens.refreshToken,
      }),
    })
    const refreshData = await refreshRes.json() as { access_token?: string; expires_in?: number; error?: string }
    if (!refreshRes.ok || !refreshData.access_token || refreshData.error) return
    accessToken = refreshData.access_token
  }

  const userinfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!userinfoRes.ok) return
  const { email: accountEmail } = await userinfoRes.json() as { email: string }

  await env.AUTH_KV.put(
    `oauth_tokens:${userEmail}:google:${accountEmail}`,
    JSON.stringify({ accessToken, refreshToken: oldTokens.refreshToken, expiresAt: oldTokens.expiresAt }),
    { expirationTtl: 7_776_000 },
  )

  const oldCalendarsRaw = await env.AUTH_KV.get(`user_calendars:${userEmail}`)
  if (oldCalendarsRaw) {
    const oldCals = JSON.parse(oldCalendarsRaw) as Array<Omit<UserCalendar, 'provider' | 'accountEmail'>>
    const migrated: UserCalendar[] = oldCals.map(c => ({ ...c, provider: 'google' as const, accountEmail }))
    await env.AUTH_KV.put(
      `user_calendars:${userEmail}:google:${accountEmail}`,
      JSON.stringify(migrated),
      { expirationTtl: 7_776_000 },
    )
    await env.AUTH_KV.delete(`user_calendars:${userEmail}`)
  }

  const account: ConnectedAccount = { provider: 'google', accountEmail, connectedAt: Date.now() }
  await env.AUTH_KV.put(`connected_accounts:${userEmail}`, JSON.stringify([account]))
  await env.AUTH_KV.delete(`google_tokens:${userEmail}`)
}
