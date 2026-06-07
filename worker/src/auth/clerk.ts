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
    const payload = await verifyToken(token, { secretKey: env.CLERK_SECRET_KEY })
    return { userId: payload.sub }
  } catch {
    return null
  }
}
