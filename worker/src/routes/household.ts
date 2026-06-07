import type { Env, RequestContext, HouseholdNotionConfig } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function err(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

export async function getNotionConfig(
  env: Env,
  householdId: string,
): Promise<HouseholdNotionConfig | null> {
  return env.DB
    .prepare('SELECT * FROM household_notion_config WHERE household_id = ?')
    .bind(householdId)
    .first<HouseholdNotionConfig>()
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

  const household = await env.DB
    .prepare('SELECT id, name FROM households WHERE id = ?')
    .bind(ctx.householdId)
    .first<{ id: string; name: string }>()

  if (!household) {
    return Response.json({ householdId: null })
  }

  const members = await env.DB
    .prepare('SELECT clerk_user_id, role FROM household_members WHERE household_id = ?')
    .bind(ctx.householdId)
    .all<{ clerk_user_id: string; role: string }>()

  return Response.json({
    householdId: household.id,
    householdName: household.name,
    role: ctx.role,
    members: members.results.map(m => ({
      clerkUserId: m.clerk_user_id,
      role: m.role,
    })),
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
    return err(409, 'You already belong to a household')
  }

  const body = await req.json<{
    name: string
    shoppingListDb: string
    recipesDb: string
    recipeIngredientDb: string
    todosDb: string
  }>()

  const { name, shoppingListDb, recipesDb, recipeIngredientDb, todosDb } = body

  if (!name || typeof name !== 'string' || !name.trim()) {
    return err(400, 'name is required')
  }
  if (!shoppingListDb || typeof shoppingListDb !== 'string' || !shoppingListDb.trim()) {
    return err(400, 'shoppingListDb is required')
  }
  if (!recipesDb || typeof recipesDb !== 'string' || !recipesDb.trim()) {
    return err(400, 'recipesDb is required')
  }
  if (!recipeIngredientDb || typeof recipeIngredientDb !== 'string' || !recipeIngredientDb.trim()) {
    return err(400, 'recipeIngredientDb is required')
  }
  if (!todosDb || typeof todosDb !== 'string' || !todosDb.trim()) {
    return err(400, 'todosDb is required')
  }

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB
    .prepare('INSERT INTO households (id, name, invite_code, created_at) VALUES (?, ?, NULL, ?)')
    .bind(id, name.trim(), now)
    .run()

  await env.DB
    .prepare('INSERT INTO household_members (household_id, clerk_user_id, role, joined_at) VALUES (?, ?, ?, ?)')
    .bind(id, ctx.clerkUserId, 'owner', now)
    .run()

  await env.DB
    .prepare('INSERT INTO household_notion_config (household_id, shopping_list_db, recipes_db, recipe_ingredient_db, todos_db) VALUES (?, ?, ?, ?, ?)')
    .bind(id, shoppingListDb.trim(), recipesDb.trim(), recipeIngredientDb.trim(), todosDb.trim())
    .run()

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
    return err(409, 'You already belong to a household')
  }

  const { inviteCode } = await req.json<{ inviteCode: string }>()
  if (!inviteCode || typeof inviteCode !== 'string') {
    return err(400, 'inviteCode is required')
  }

  const normalized = inviteCode.trim().toUpperCase()

  const household = await env.DB
    .prepare('SELECT id, name FROM households WHERE UPPER(invite_code) = ?')
    .bind(normalized)
    .first<{ id: string; name: string }>()

  if (!household) {
    return err(404, 'Invite code not found')
  }

  const now = Date.now()

  await env.DB
    .prepare('INSERT INTO household_members (household_id, clerk_user_id, role, joined_at) VALUES (?, ?, ?, ?)')
    .bind(household.id, ctx.clerkUserId, 'member', now)
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
    return err(403, 'Forbidden')
  }
  if (ctx.role !== 'owner') {
    return err(403, 'Forbidden')
  }

  const inviteCode = crypto.randomUUID().slice(0, 8).toUpperCase()

  await env.DB
    .prepare('UPDATE households SET invite_code = ? WHERE id = ?')
    .bind(inviteCode, ctx.householdId)
    .run()

  return Response.json({ inviteCode })
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
    return err(403, 'Forbidden')
  }
  if (ctx.role !== 'owner') {
    return err(403, 'Forbidden')
  }

  await env.DB
    .prepare('UPDATE households SET invite_code = NULL WHERE id = ?')
    .bind(ctx.householdId)
    .run()

  return new Response(null, { status: 204 })
}
