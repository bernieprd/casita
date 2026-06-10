import { createClerkClient, verifyToken } from '@clerk/backend'
import type { Env } from '../types'

export function getClerkClient(env: Env) {
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

// ── JWKS → PEM cache ──────────────────────────────────────────────────────────
// Cloudflare Worker isolates reuse module-level state across requests, so we
// only pay the JWKS network round-trip once per isolate lifetime.
// If CLERK_JWT_KEY is set as a wrangler secret, that PEM is used directly
// (fastest path, no network call ever).

let _pemCache: string | null = null
let _pemCacheSecretKey = ''
let _pemCacheExpiry = 0

async function getPem(secretKey: string): Promise<string> {
  const now = Date.now()
  if (_pemCache && _pemCacheSecretKey === secretKey && _pemCacheExpiry > now) {
    return _pemCache
  }

  const res = await fetch('https://api.clerk.com/v1/jwks', {
    headers: { Authorization: `Bearer ${secretKey}` },
  })
  if (!res.ok) throw new Error(`JWKS fetch failed: ${res.status}`)

  const { keys } = await res.json() as { keys: JsonWebKey[] }
  const jwk = keys.find(k => k.kty === 'RSA' && k.use === 'sig')
  if (!jwk) throw new Error('No RSA signing key in Clerk JWKS')

  // Convert JWK → PEM using Web Crypto (available in all CF Workers runtimes)
  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    true, ['verify'],
  )
  const spki = await crypto.subtle.exportKey('spki', cryptoKey) as ArrayBuffer
  const bytes = new Uint8Array(spki)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`

  _pemCache = pem
  _pemCacheSecretKey = secretKey
  _pemCacheExpiry = now + 24 * 60 * 60 * 1000 // re-fetch after 24 h (handles key rotation)
  return pem
}

export async function verifyClerkToken(
  token: string,
  env: Env,
): Promise<{ userId: string; email: string } | null> {
  try {
    // CLERK_JWT_KEY secret → instant local verification, zero network.
    // Otherwise auto-fetch JWKS once and cache the derived PEM.
    const jwtKey = env.CLERK_JWT_KEY ?? await getPem(env.CLERK_SECRET_KEY)
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY, jwtKey })
    return { userId: payload.sub, email: (payload as Record<string, unknown>).email as string ?? '' }
  } catch {
    return null
  }
}
