import type { Env, RequestContext } from '../types'
import { seedHouseholdConcepts } from './concepts-d1'
import { getClerkClient } from '../auth/clerk'
import { rebuildSharedIndex } from './shared-calendar-index'

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(status: number, code: string): Response {
  return Response.json({ error: code }, { status })
}

// ── Handlers ──────────────────────────────────────────────────────────────────

/**
 * GET /household/me
 * Returns the current user's household info, or { householdId: null } if none.
 */
export async function getHousehold(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) {
    return Response.json({ householdId: null })
  }

  const [household, members] = await Promise.all([
    env.DB
      .prepare('SELECT id, name, invite_code, areas_config FROM households WHERE id = ?')
      .bind(ctx.householdId)
      .first<{ id: string; name: string; invite_code: string | null; areas_config: string | null }>(),
    env.DB
      .prepare('SELECT clerk_user_id, role FROM household_members WHERE household_id = ?')
      .bind(ctx.householdId)
      .all<{ clerk_user_id: string; role: string }>(),
  ])

  if (!household) {
    return Response.json({ householdId: null })
  }

  const memberIds = members.results.map(m => m.clerk_user_id)
  type ClerkProfile = { displayName: string | null; email: string | null; imageUrl: string | null }
  const profileMap = new Map<string, ClerkProfile>()
  try {
    const clerk = getClerkClient(env)
    const { data: clerkUsers } = await clerk.users.getUserList({ userId: memberIds, limit: 100 })
    for (const u of clerkUsers) {
      profileMap.set(u.id, {
        displayName: u.fullName ?? u.firstName ?? null,
        email: u.emailAddresses[0]?.emailAddress ?? null,
        imageUrl: u.imageUrl ?? null,
      })
    }
  } catch {
    // degrade gracefully — profiles stay null
  }

  return Response.json({
    householdId: household.id,
    householdName: household.name,
    role: ctx.role,
    inviteCode: household.invite_code ?? null,
    areasConfig: household.areas_config ? JSON.parse(household.areas_config) : null,
    members: members.results.map(m => {
      const profile = profileMap.get(m.clerk_user_id)
      return {
        clerkUserId: m.clerk_user_id,
        role: m.role,
        displayName: profile?.displayName ?? null,
        imageUrl: profile?.imageUrl ?? null,
      }
    }),
  })
}

/**
 * POST /household
 * Body: { name: string }
 * Creates a new household and adds the caller as owner.
 * Returns 409 if the user already belongs to a household.
 */
export async function createHousehold(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (ctx.householdId) {
    return err(409, 'ERR_ALREADY_IN_HOUSEHOLD')
  }

  const body = await req.json<{ name: string }>()
  const { name } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return err(400, 'ERR_NAME_REQUIRED')
  }

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB
    .prepare('INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, NULL, ?)')
    .bind(id, name.trim(), now)
    .run()

  await env.DB
    .prepare('INSERT INTO household_members (household_id, clerk_user_id, role, joined_at, email) VALUES (?, ?, ?, ?, ?)')
    .bind(id, ctx.clerkUserId, 'owner', now, ctx.email)
    .run()

  await seedHouseholdConcepts(env, id)

  return Response.json({ id, name: name.trim(), role: 'owner' }, { status: 201 })
}

/**
 * POST /household/join
 * Body: { inviteCode: string }
 * Joins an existing household via invite code (case-insensitive).
 * Returns 404 if code not found, 409 if user already in a household.
 */
export async function joinHousehold(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (ctx.householdId) {
    return err(409, 'ERR_ALREADY_IN_HOUSEHOLD')
  }

  const { inviteCode } = await req.json<{ inviteCode: string }>()
  if (!inviteCode || typeof inviteCode !== 'string') {
    return err(400, 'ERR_INVITE_CODE_REQUIRED')
  }

  const normalized = inviteCode.trim().toUpperCase()

  const household = await env.DB
    .prepare('SELECT id, name FROM households WHERE UPPER(invite_code) = ?')
    .bind(normalized)
    .first<{ id: string; name: string }>()

  if (!household) {
    return err(404, 'ERR_INVITE_NOT_FOUND')
  }

  const now = Date.now()

  await env.DB
    .prepare('INSERT INTO household_members (household_id, clerk_user_id, role, joined_at, email) VALUES (?, ?, ?, ?, ?)')
    .bind(household.id, ctx.clerkUserId, 'member', now, ctx.email)
    .run()

  return Response.json({ id: household.id, name: household.name, role: 'member' }, { status: 200 })
}

/**
 * POST /household/invite
 * Generates a new invite code for the household.
 * Requires caller to be an owner.
 */
export async function generateInvite(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) {
    return err(403, 'ERR_FORBIDDEN')
  }
  if (ctx.role !== 'owner') {
    return err(403, 'ERR_FORBIDDEN')
  }

  const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase()

  await env.DB
    .prepare('UPDATE households SET invite_code = ? WHERE id = ?')
    .bind(inviteCode, ctx.householdId)
    .run()

  return Response.json({ inviteCode })
}

/**
 * PATCH /household
 * Body: { name: string }
 * Renames the household. Requires caller to be an owner.
 */
export async function renameHousehold(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  if (ctx.role !== 'owner') return err(403, 'ERR_FORBIDDEN')

  const body = await req.json<{ name?: unknown }>()
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return err(400, 'ERR_NAME_REQUIRED')
  }
  const newName = body.name.trim()

  await env.DB
    .prepare('UPDATE households SET name = ? WHERE id = ?')
    .bind(newName, ctx.householdId)
    .run()

  return Response.json({ householdName: newName })
}

/**
 * DELETE /household/invite
 * Revokes the current invite code by setting it to NULL.
 * Requires caller to be an owner.
 */
export async function revokeInvite(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) {
    return err(403, 'ERR_FORBIDDEN')
  }
  if (ctx.role !== 'owner') {
    return err(403, 'ERR_FORBIDDEN')
  }

  await env.DB
    .prepare('UPDATE households SET invite_code = NULL WHERE id = ?')
    .bind(ctx.householdId)
    .run()

  return new Response(null, { status: 204 })
}

export async function getHouseholdSettings(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')

  const row = await env.DB
    .prepare('SELECT settings FROM households WHERE id = ?')
    .bind(ctx.householdId)
    .first<{ settings: string | null }>()

  let parsed: Record<string, unknown> = {}
  if (row?.settings) {
    try { parsed = JSON.parse(row.settings) } catch { parsed = {} }
  }
  return Response.json(parsed, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
}

export async function updateHouseholdSettings(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  // No role check — theme settings are intentionally editable by all members.
  // If non-cosmetic settings are added here, gate them behind an owner check.

  const body = await req.json<Record<string, unknown>>()
  const { colorScheme: _dropped, ...rest } = body

  const ALLOWED_FONTS = [
    '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    '"Inter", sans-serif',
    '"Lato", sans-serif',
    '"Merriweather", serif',
    '"Playfair Display", serif',
  ]

  for (const [key, val] of Object.entries(rest)) {
    if (val === undefined) continue
    if (typeof val !== 'string') {
      return err(400, 'ERR_INVALID_SETTING')
    }
    if (key === 'primaryHsl') {
      if (!/^\d{1,3}\s+\d{1,3}%\s+\d{1,3}%$/.test(val)) {
        return err(400, 'ERR_INVALID_SETTING')
      }
      const [h, s, l] = val.split(/\s+/).map(v => parseFloat(v))
      if (h < 0 || h > 360 || s < 0 || s > 100 || l < 0 || l > 100) {
        return err(400, 'ERR_INVALID_SETTING')
      }
    } else if (key === 'headingFont' || key === 'bodyFont') {
      if (!ALLOWED_FONTS.includes(val)) {
        return err(400, 'ERR_INVALID_SETTING')
      }
    } else if (key === 'radius') {
      if (!/^\d+(\.\d+)?rem$/.test(val)) {
        return err(400, 'ERR_INVALID_SETTING')
      }
      if (parseFloat(val) > 4) {
        return err(400, 'ERR_INVALID_SETTING')
      }
    } else {
      return err(400, 'ERR_INVALID_SETTING')
    }
  }

  const serialized = JSON.stringify(rest)
  await env.DB
    .prepare('UPDATE households SET settings = ? WHERE id = ?')
    .bind(serialized, ctx.householdId)
    .run()

  return Response.json(rest)
}

export async function transferOwnership(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  if (ctx.role !== 'owner') return err(403, 'ERR_FORBIDDEN')

  const body = await req.json<{ newOwnerId?: unknown }>()
  if (!body.newOwnerId || typeof body.newOwnerId !== 'string') {
    return err(400, 'ERR_INVALID_REQUEST')
  }
  const newOwnerId = body.newOwnerId

  if (newOwnerId === ctx.clerkUserId) {
    return err(400, 'ERR_ALREADY_OWNER')
  }

  const member = await env.DB
    .prepare('SELECT clerk_user_id FROM household_members WHERE clerk_user_id = ? AND household_id = ?')
    .bind(newOwnerId, ctx.householdId)
    .first<{ clerk_user_id: string }>()

  if (!member) return err(404, 'ERR_MEMBER_NOT_FOUND')

  await env.DB.batch([
    env.DB
      .prepare('UPDATE household_members SET role = ? WHERE clerk_user_id = ? AND household_id = ?')
      .bind('owner', newOwnerId, ctx.householdId),
    env.DB
      .prepare('UPDATE household_members SET role = ? WHERE clerk_user_id = ? AND household_id = ?')
      .bind('member', ctx.clerkUserId, ctx.householdId),
  ])

  return Response.json({ ok: true })
}

/**
 * DELETE /household/leave
 * Removes the current (non-owner) user from their household.
 */
export async function leaveHousehold(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(400, 'ERR_NO_HOUSEHOLD')
  if (ctx.role === 'owner') return err(400, 'ERR_OWNER_CANNOT_LEAVE')
  await env.DB
    .prepare('DELETE FROM household_members WHERE clerk_user_id = ? AND household_id = ?')
    .bind(ctx.clerkUserId, ctx.householdId)
    .run()
  return Response.json({ ok: true })
}

export async function deleteHousehold(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  if (ctx.role !== 'owner') return err(403, 'ERR_FORBIDDEN')

  const others = await env.DB
    .prepare('SELECT clerk_user_id FROM household_members WHERE household_id = ? AND clerk_user_id != ?')
    .bind(ctx.householdId, ctx.clerkUserId)
    .all<{ clerk_user_id: string }>()

  if (others.results.length > 0) {
    return err(400, 'ERR_TRANSFER_BEFORE_DELETE_HOUSEHOLD')
  }

  const allMembers = await env.DB
    .prepare('SELECT email FROM household_members WHERE household_id = ?')
    .bind(ctx.householdId)
    .all<{ email: string }>()

  await env.DB.batch([
    env.DB.prepare('DELETE FROM household_members WHERE household_id = ?').bind(ctx.householdId),
    env.DB.prepare('DELETE FROM households WHERE id = ?').bind(ctx.householdId),
  ])

  await Promise.all(
    allMembers.results.flatMap(({ email }) => [
      env.AUTH_KV.delete(`google_tokens:${email}`),
      env.AUTH_KV.delete(`user_calendars:${email}`),
    ])
  )

  await Promise.all(
    allMembers.results.map(({ email }) =>
      rebuildSharedIndex(email, [], ctx.householdId!, env)
    )
  )

  return Response.json({ ok: true })
}

export async function getTodoSettings(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  const row = await env.DB
    .prepare('SELECT todo_workflow FROM households WHERE id = ?')
    .bind(ctx.householdId)
    .first<{ todo_workflow: string }>()
  return Response.json({ workflow: row?.todo_workflow ?? 'simple' }, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
}

export async function updateTodoSettings(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  if (ctx.role !== 'owner') return err(403, 'ERR_FORBIDDEN')
  const body = await req.json<{ workflow?: string }>()
  const allowed = ['simple', 'board']
  if (!body.workflow || !allowed.includes(body.workflow))
    return Response.json({ error: 'ERR_INVALID_REQUEST' }, { status: 400 })
  const householdStmt = env.DB
    .prepare('UPDATE households SET todo_workflow = ? WHERE id = ?')
    .bind(body.workflow, ctx.householdId)

  if (body.workflow === 'simple') {
    const todoStmt = env.DB
      .prepare("UPDATE todos SET status = 'Todo', updated_at = ? WHERE household_id = ? AND status IN ('In progress', 'Blocked')")
      .bind(Date.now(), ctx.householdId)
    await env.DB.batch([householdStmt, todoStmt])
  } else {
    await householdStmt.run()
  }
  return Response.json({ workflow: body.workflow })
}

/**
 * PATCH /household/areas
 * Body: { areasConfig: Record<string, { enabled: boolean }> }
 * Updates which areas are enabled for the household.
 * Requires caller to be an owner.
 */
export async function updateAreasConfig(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_FORBIDDEN')
  if (ctx.role !== 'owner') return err(403, 'ERR_FORBIDDEN')

  const body = await req.json<{ areasConfig?: unknown }>()
  const VALID_AREAS = ['calendar', 'todos', 'shopping', 'recipes', 'finance'] as const

  if (!body.areasConfig || typeof body.areasConfig !== 'object' || Array.isArray(body.areasConfig))
    return err(400, 'ERR_INVALID_REQUEST')

  for (const [key, val] of Object.entries(body.areasConfig as Record<string, unknown>)) {
    if (!VALID_AREAS.includes(key as (typeof VALID_AREAS)[number])) return err(400, 'ERR_INVALID_AREA')
    if (typeof val !== 'object' || val === null || typeof (val as { enabled?: unknown }).enabled !== 'boolean')
      return err(400, 'ERR_INVALID_AREA_CONFIG')
  }

  await env.DB
    .prepare('UPDATE households SET areas_config = ? WHERE id = ?')
    .bind(JSON.stringify(body.areasConfig), ctx.householdId)
    .run()

  return Response.json({ areasConfig: body.areasConfig })
}
