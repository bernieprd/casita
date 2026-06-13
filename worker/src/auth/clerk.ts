import { createClerkClient, verifyToken } from '@clerk/backend'
import type { Env } from '../types'

export function getClerkClient(env: Env) {
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

// Cache PEM keyed by kid; re-fetch after 24 h to handle key rotation.
const _pemCache = new Map<string, { pem: string; expiry: number }>()

function decodeB64(s: string): unknown {
  return JSON.parse(atob(s.replace(/-/g, '+').replace(/_/g, '/')))
}

// Trusted Clerk issuer domains — prevents a forged `iss` claim from redirecting
// the JWKS fetch to an attacker-controlled server.
function isTrustedClerkIssuer(iss: string): boolean {
  try {
    const { hostname } = new URL(iss)
    return (
      hostname.endsWith('.clerk.accounts.dev') ||
      hostname.endsWith('.clerk.com') ||
      hostname === 'clerk.com'
    )
  } catch {
    return false
  }
}

async function getPemForKid(token: string, kid: string): Promise<string> {
  const cached = _pemCache.get(kid)
  if (cached && cached.expiry > Date.now()) return cached.pem

  // Use the token's own `iss` claim to locate the correct JWKS endpoint.
  // This works regardless of which Clerk instance (dev vs prod) signed the token,
  // unlike fetching from api.clerk.com/v1/jwks with the worker's secretKey (which
  // only returns keys for the instance that secretKey belongs to).
  const { iss } = decodeB64(token.split('.')[1]) as { iss?: string }
  if (!iss) throw new Error('JWT missing iss claim')
  if (!isTrustedClerkIssuer(iss)) throw new Error(`Untrusted JWT issuer: ${iss}`)

  const jwksUrl = `${iss}/.well-known/jwks.json`
  const res = await fetch(jwksUrl)
  if (!res.ok) throw new Error(`JWKS fetch failed from ${jwksUrl}: ${res.status}`)

  const { keys } = await res.json() as { keys: (JsonWebKey & { kid?: string })[] }
  const jwk = keys.find(k => k.kid === kid)
  if (!jwk) throw new Error(`No JWKS key with kid=${kid} at ${jwksUrl}`)

  const cryptoKey = await crypto.subtle.importKey(
    'jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, true, ['verify'],
  )
  const spki = await crypto.subtle.exportKey('spki', cryptoKey) as ArrayBuffer
  const bytes = new Uint8Array(spki)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  const pem = `-----BEGIN PUBLIC KEY-----\n${b64.match(/.{1,64}/g)!.join('\n')}\n-----END PUBLIC KEY-----`

  _pemCache.set(kid, { pem, expiry: Date.now() + 24 * 60 * 60 * 1000 })
  return pem
}

export async function verifyClerkToken(
  token: string,
  env: Env,
): Promise<{ userId: string; email: string } | null> {
  try {
    const [headerB64] = token.split('.')
    const { kid } = decodeB64(headerB64) as { kid?: string }
    if (!kid) throw new Error('JWT missing kid in header')

    const jwtKey = await getPemForKid(token, kid)
    const payload = await verifyToken(token, { jwtKey })

    const userId = payload.sub

    let email = (payload as Record<string, unknown>).email as string ?? ''

    if (!email) {
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
