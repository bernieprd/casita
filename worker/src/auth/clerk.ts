import { createClerkClient, verifyToken } from '@clerk/backend'
import type { Env } from '../types'

export function getClerkClient(env: Env) {
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

// Cache derived PEM keyed by (secretKey, kid) so we only pay the JWKS round-trip once
// per isolate lifetime. Re-fetch after 24 h to handle key rotation.
const _pemCache = new Map<string, { pem: string; expiry: number }>()

async function getPemForKid(secretKey: string, kid: string): Promise<string> {
  const cacheKey = `${secretKey}:${kid}`
  const cached = _pemCache.get(cacheKey)
  if (cached && cached.expiry > Date.now()) return cached.pem

  const res = await fetch('https://api.clerk.com/v1/jwks', {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)

  const { keys } = await res.json() as { keys: (JsonWebKey & { kid?: string })[] }
  const jwk = keys.find(k => k.kid === kid)
  if (!jwk) throw new Error(`No JWKS key with kid=${kid}`)

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify'],
  )
  const spki = await crypto.subtle.exportKey('spki', cryptoKey) as ArrayBuffer
  const bytes = new Uint8Array(spki)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`

  _pemCache.set(cacheKey, { pem, expiry: Date.now() + 24 * 60 * 60 * 1000 })
  return pem
}

export async function verifyClerkToken(
  token: string,
  env: Env,
): Promise<{ userId: string; email: string } | null> {
  try {
    // Decode header without verification to get kid for key lookup
    const [headerB64] = token.split('.')
    const header = JSON.parse(atob(headerB64.replace(/-/g, '+').replace(/_/g, '/'))) as { kid?: string }
    if (!header.kid) throw new Error('JWT missing kid in header')

    // Always fetch the key by kid from JWKS so we get the correct key for the exact
    // Clerk instance (dev vs. prod). Result is cached 24h per isolate — fast enough
    // for production. A static CLERK_JWT_KEY secret would only work if it happens to
    // match the kid in the JWT, which breaks when dev/prod instances differ.
    const jwtKey = await getPemForKid(env.CLERK_SECRET_KEY, header.kid)
    const payload = await verifyToken(token, { jwtKey })

    const userId = payload.sub

    let email = (payload as Record<string, unknown>).email as string ?? ''

    if (!email) {
      // JWT template doesn't include the email claim (e.g. dev Clerk instance without a
      // custom template). Fall back to the Clerk Users API so Phase 4 email-based
      // household re-link still works.
      const clerk = getClerkClient(env)
      const user = await clerk.users.getUser(userId)
      email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId)?.emailAddress
           ?? user.emailAddresses[0]?.emailAddress
           ?? ''
    }

    return { userId, email }
  } catch (e) {
    console.error('[verifyClerkToken] error:', e)
    return null
  }
}
