import type { Env, RequestContext } from '../types'

const SUPPORTED_LOCALES = ['en', 'es', 'pt-PT', 'it'] as const
type SupportedLocale = (typeof SUPPORTED_LOCALES)[number]

const VALID_AREA_IDS = ['calendar', 'todos', 'shopping', 'recipes'] as const

function safeParseJson(s: string | null | undefined): unknown {
  if (!s) return null
  try { return JSON.parse(s) } catch { return null }
}

function isSupportedLocale(v: unknown): v is SupportedLocale {
  return SUPPORTED_LOCALES.includes(v as SupportedLocale)
}

function isValidTabConfig(v: unknown): boolean {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false
  const obj = v as Record<string, unknown>
  if (!Array.isArray(obj.pinned)) return false
  if (obj.pinned.length > 3) return false
  if (new Set(obj.pinned).size !== obj.pinned.length) return false
  return (obj.pinned as unknown[]).every(
    (id) => VALID_AREA_IDS.includes(id as (typeof VALID_AREA_IDS)[number]),
  )
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
    tabConfig: safeParseJson(row?.tab_config),
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

  const updates: string[] = []
  const binds: unknown[] = []

  if (locale !== undefined) {
    if (!isSupportedLocale(locale)) {
      return Response.json({ error: 'ERR_INVALID_LOCALE' }, { status: 400 })
    }
    updates.push('locale = ?')
    binds.push(locale)
  }

  if (tabConfig !== undefined) {
    if (tabConfig !== null && !isValidTabConfig(tabConfig)) {
      return Response.json({ error: 'ERR_INVALID_TAB_CONFIG' }, { status: 400 })
    }
    updates.push('tab_config = ?')
    binds.push(tabConfig === null ? null : JSON.stringify(tabConfig))
  }

  if (updates.length === 0) {
    return Response.json({ error: 'ERR_NO_FIELDS' }, { status: 400 })
  }

  binds.push(ctx.clerkUserId)
  await env.DB
    .prepare(`UPDATE household_members SET ${updates.join(', ')} WHERE clerk_user_id = ?`)
    .bind(...binds)
    .run()

  return Response.json({
    ok: true,
    ...(locale !== undefined ? { locale } : {}),
    ...(tabConfig !== undefined ? { tabConfig } : {}),
  })
}
