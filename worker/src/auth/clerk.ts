import { createClerkClient, verifyToken } from '@clerk/backend'
import type { Env } from '../types'

export function getClerkClient(env: Env) {
  return createClerkClient({ secretKey: env.CLERK_SECRET_KEY })
}

export async function verifyClerkToken(
  token: string,
  env: Env
): Promise<{ userId: string } | null> {
  try {
    // When CLERK_JWT_KEY (PEM public key) is set, verification is local — no JWKS network call.
    // Set it with: wrangler secret put CLERK_JWT_KEY
    // (Clerk dashboard → API Keys → Advanced → JWT Verification Key)
    const payload = await verifyToken(token, {
      secretKey: env.CLERK_SECRET_KEY,
      ...(env.CLERK_JWT_KEY ? { jwtKey: env.CLERK_JWT_KEY } : {}),
    })
    return { userId: payload.sub }
  } catch {
    return null
  }
}
