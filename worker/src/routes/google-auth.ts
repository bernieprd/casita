import type { Env, GoogleTokens, RequestContext } from '../types'
import { rebuildSharedIndex } from './shared-calendar-index'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_SCOPES = 'openid email https://www.googleapis.com/auth/calendar.readonly'

export async function initiateGoogleOAuth(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const clerkUserId = ctx.clerkUserId

  const state = crypto.randomUUID()
  await env.AUTH_KV.put(`oauth_state:${state}`, JSON.stringify({ clerkUserId }), { expirationTtl: 600 })

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
    return Response.json({ error: 'Missing code or state' }, { status: 400 })
  }

  const stateRaw = await env.AUTH_KV.get(`oauth_state:${state}`)
  if (!stateRaw) {
    return Response.json({ error: 'Invalid or expired state' }, { status: 400 })
  }

  await env.AUTH_KV.delete(`oauth_state:${state}`)

  const { clerkUserId } = JSON.parse(stateRaw) as { clerkUserId: string }

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
    return Response.json({ error: 'Failed to exchange code for tokens' }, { status: 502 })
  }

  const tokens = await tokenRes.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
  }

  await env.AUTH_KV.put(
    `google_tokens:${clerkUserId}`,
    JSON.stringify({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: Date.now() + tokens.expires_in * 1000,
    }),
  )

  const baseUrl = env.APP_BASE_URL ?? 'https://casita.bernardoprd.com/#'
  return Response.redirect(`${baseUrl}/settings?google=connected`, 302)
}

export async function getGoogleAuthStatus(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const tokensRaw = await env.AUTH_KV.get(`google_tokens:${ctx.clerkUserId}`)
  return Response.json({ connected: tokensRaw !== null })
}

export async function disconnectGoogle(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const clerkUserId = ctx.clerkUserId

  await Promise.all([
    env.AUTH_KV.delete(`google_tokens:${clerkUserId}`),
    env.AUTH_KV.delete(`user_calendars:${clerkUserId}`),
  ])
  await rebuildSharedIndex(clerkUserId, [], ctx.householdId, env)

  return Response.json({ ok: true })
}

export async function getValidAccessToken(clerkUserId: string, env: Env): Promise<string | null> {
  const raw = await env.AUTH_KV.get(`google_tokens:${clerkUserId}`)
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
    await Promise.all([
      env.AUTH_KV.delete(`google_tokens:${clerkUserId}`),
      env.AUTH_KV.delete(`user_calendars:${clerkUserId}`),
    ])
    return null
  }

  if (!refreshRes.ok || !refreshData.access_token) {
    return null
  }

  await env.AUTH_KV.put(
    `google_tokens:${clerkUserId}`,
    JSON.stringify({
      accessToken: refreshData.access_token,
      refreshToken: tokens.refreshToken,
      expiresAt: Date.now() + (refreshData.expires_in ?? 3600) * 1000,
    }),
  )

  return refreshData.access_token
}
