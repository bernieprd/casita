import type { Env, RequestContext } from '../types'

const SUPPORTED_LOCALES = ['en', 'es', 'pt-PT', 'it'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

function isSupportedLocale(v: unknown): v is SupportedLocale {
  return SUPPORTED_LOCALES.includes(v as SupportedLocale)
}

export async function getMe(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const row = await env.DB
    .prepare('SELECT locale FROM household_members WHERE clerk_user_id = ?')
    .bind(ctx.clerkUserId)
    .first<{ locale: string }>()

  return Response.json({
    clerkUserId: ctx.clerkUserId,
    email: ctx.email,
    locale: row?.locale ?? 'en',
  })
}

export async function updateMe(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const locale = body?.locale

  if (!isSupportedLocale(locale)) {
    return Response.json({ error: 'ERR_INVALID_LOCALE' }, { status: 400 })
  }

  await env.DB
    .prepare('UPDATE household_members SET locale = ? WHERE clerk_user_id = ?')
    .bind(locale, ctx.clerkUserId)
    .run()

  return Response.json({ ok: true, locale })
}
