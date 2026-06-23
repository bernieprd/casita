import type { Env, RequestContext } from '../types'

const SUPPORTED_LOCALES = ['en', 'es', 'pt-PT', 'it'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

function isSupportedLocale(v: unknown): v is SupportedLocale {
  return SUPPORTED_LOCALES.includes(v as SupportedLocale)
}

const VALID_AREA_IDS = ['calendar', 'todos', 'shopping', 'recipes'] as const
type AreaId = (typeof VALID_AREA_IDS)[number]

interface TabConfig {
  pinned: AreaId[]
}

function isValidTabConfig(v: unknown): v is TabConfig {
  if (!v || typeof v !== 'object') return false
  const obj = v as Record<string, unknown>
  if (!Array.isArray(obj.pinned)) return false
  if (obj.pinned.length > 3) return false
  const pinned = obj.pinned as unknown[]
  if (!pinned.every((id) => VALID_AREA_IDS.includes(id as AreaId))) return false
  // no duplicates
  if (new Set(pinned).size !== pinned.length) return false
  return true
}

export async function getMe(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const row = await env.DB
    .prepare('SELECT locale, tab_config FROM household_members WHERE clerk_user_id = ? LIMIT 1')
    .bind(ctx.clerkUserId)
    .first<{ locale: string; tab_config: string | null }>()

  return Response.json({
    clerkUserId: ctx.clerkUserId,
    email: ctx.email,
    locale: row?.locale ?? 'en',
    tabConfig: row?.tab_config ? JSON.parse(row.tab_config) as TabConfig : null,
  })
}

export async function updateMe(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  const body = await req.json().catch(() => null) as Record<string, unknown> | null
  const locale = body?.locale
  const tabConfig = body?.tabConfig

  // Handle tab_config update
  if (tabConfig !== undefined) {
    if (!isValidTabConfig(tabConfig)) {
      return Response.json({ error: 'ERR_INVALID_TAB_CONFIG' }, { status: 400 })
    }

    await env.DB
      .prepare('UPDATE household_members SET tab_config = ? WHERE clerk_user_id = ?')
      .bind(JSON.stringify(tabConfig), ctx.clerkUserId)
      .run()

    return Response.json({ tabConfig })
  }

  // Handle locale update
  if (!isSupportedLocale(locale)) {
    return Response.json({ error: 'ERR_INVALID_LOCALE' }, { status: 400 })
  }

  await env.DB
    .prepare('UPDATE household_members SET locale = ? WHERE clerk_user_id = ?')
    .bind(locale, ctx.clerkUserId)
    .run()

  return Response.json({ ok: true, locale })
}
