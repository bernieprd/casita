import type { Env } from '../types'

async function hashPassword(password: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function generateToken(): string {
  return crypto.randomUUID()
}

export async function checkAuth(req: Request, env: Env): Promise<Response> {
  const { email } = await req.json() as { email: string }
  if (!env.ALLOWED_EMAILS.split(',').includes(email)) {
    return Response.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }
  const existing = await env.AUTH_KV.get(`user:${email}`)
  return Response.json({ ok: true, hasAccount: existing !== null })
}

export async function setupAuth(req: Request, env: Env): Promise<Response> {
  const { email, password } = await req.json() as { email: string; password: string }
  if (!env.ALLOWED_EMAILS.split(',').includes(email)) {
    return Response.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }
  const existing = await env.AUTH_KV.get(`user:${email}`)
  if (existing !== null) {
    return Response.json({ ok: false, error: 'Account already exists' }, { status: 409 })
  }
  const passwordHash = await hashPassword(password)
  await env.AUTH_KV.put(`user:${email}`, JSON.stringify({ passwordHash }))
  const token = generateToken()
  await env.AUTH_KV.put(
    `session:${token}`,
    JSON.stringify({ email, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
    { expirationTtl: 604800 },
  )
  return Response.json({ ok: true, token, email })
}

export async function loginAuth(req: Request, env: Env): Promise<Response> {
  const { email, password } = await req.json() as { email: string; password: string }
  if (!env.ALLOWED_EMAILS.split(',').includes(email)) {
    return Response.json({ ok: false, error: 'Not authorized' }, { status: 403 })
  }
  const raw = await env.AUTH_KV.get(`user:${email}`)
  if (!raw) {
    return Response.json({ ok: false, error: 'No account found' }, { status: 401 })
  }
  const { passwordHash } = JSON.parse(raw) as { passwordHash: string }
  if (await hashPassword(password) !== passwordHash) {
    return Response.json({ ok: false, error: 'Invalid password' }, { status: 401 })
  }
  const token = generateToken()
  await env.AUTH_KV.put(
    `session:${token}`,
    JSON.stringify({ email, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 }),
    { expirationTtl: 604800 },
  )
  return Response.json({ ok: true, token, email })
}

export async function logoutAuth(req: Request, env: Env): Promise<Response> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (token) await env.AUTH_KV.delete(`session:${token}`)
  return Response.json({ ok: true })
}
