import { getItems, createItem, updateItem, deleteItem, mergeItem } from './routes/items-d1'
import { createRecipe, getRecipes, getRecipe, updateRecipe, deleteRecipe, getRecipeIngredients, shareRecipe, getPublicRecipe } from './routes/recipes-d1'
import { updateRecipeIngredient, createRecipeIngredient, deleteRecipeIngredient } from './routes/recipe-ingredients-d1'
import { uploadRecipePhoto, serveRecipePhoto } from './routes/uploads'
import { getTodos, createTodo, updateTodo, deleteTodo } from './routes/todos-d1'
import { getCalendarEvents } from './routes/calendar'
import { initiateGoogleOAuth, handleGoogleOAuthCallback, getGoogleAuthStatus, disconnectGoogle } from './routes/google-auth'
import { listUserCalendars, updateUserCalendars } from './routes/user-calendars'
import { getHousehold, createHousehold, joinHousehold, generateInvite, revokeInvite, renameHousehold, getHouseholdSettings, updateHouseholdSettings, leaveHousehold } from './routes/household'
import { listConcepts, createConcept, updateConcept, deleteConcept, backfillConceptsRoute } from './routes/concepts-d1'
import { verifyClerkToken, getClerkClient } from './auth/clerk'
import { runMigrationItems, runMigrationRecipes, runMigrationIngredients, runMigrationTodos, runMigrationTokens } from './db/migrate-from-notion'
import { NotionError } from './notion'
import type { Env, RequestContext } from './types'

const DEFAULT_ORIGIN = 'https://casita.bernardoprd.com'
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function resolveOrigin(req: Request, allowedOrigin: string): string {
  const reqOrigin = req.headers.get('Origin') ?? ''
  return DEV_ORIGINS.includes(reqOrigin) ? reqOrigin : allowedOrigin
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function withCors(res: Response, origin: string): Response {
  const next = new Response(res.body, res)
  for (const [k, v] of Object.entries(corsHeaders(origin))) next.headers.set(k, v)
  return next
}

function err(status: number, message: string, origin: string): Response {
  return withCors(Response.json({ error: message }, { status }), origin)
}

// ── Route tables ──────────────────────────────────────────────────────────────
//
// Each entry: [method, URLPattern, handler]
//
// URLPattern groups capture named path segments. The handler receives them
// positionally in the order they appear in the pattern's pathname groups.

type PublicHandler = (req: Request, env: Env, ...ids: string[]) => Promise<Response>
type AuthHandler = (req: Request, env: Env, ctx: RequestContext, ...ids: string[]) => Promise<Response>

const publicRoutes: Array<[string, URLPattern, PublicHandler]> = [
  ['GET',    new URLPattern({ pathname: '/auth/google/callback',    search: '*' }), handleGoogleOAuthCallback],
  ['GET',    new URLPattern({ pathname: '/public/recipes/:token',   search: '*' }), getPublicRecipe],
  ['POST',   new URLPattern({ pathname: '/admin/migrate',           search: '*' }), handleAdminMigrate],
  ['POST',   new URLPattern({ pathname: '/admin/backfill-emails',  search: '*' }), handleBackfillEmails],
  ['POST',   new URLPattern({ pathname: '/admin/migrate-kv-to-email', search: '*' }), handleMigrateKvToEmail],
  ['GET',    new URLPattern({ pathname: '/recipe-photos/:key',      search: '*' }), serveRecipePhoto],
]

async function handleAdminMigrate(req: Request, env: Env): Promise<Response> {
  const secret = req.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_MIGRATE_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const householdId = url.searchParams.get('household_id')

  let log: string[]
  if (type === 'tokens') {
    log = await runMigrationTokens(env)
  } else if (!householdId) {
    return Response.json({ error: 'household_id required for type=' + type }, { status: 400 })
  } else if (type === 'items') {
    log = await runMigrationItems(env, householdId)
  } else if (type === 'recipes') {
    log = await runMigrationRecipes(env, householdId)
  } else if (type === 'ingredients') {
    log = await runMigrationIngredients(env, householdId)
  } else if (type === 'todos') {
    log = await runMigrationTodos(env, householdId)
  } else {
    return Response.json({ error: 'type must be one of: items, recipes, ingredients, todos, tokens' }, { status: 400 })
  }

  return Response.json({ ok: true, log })
}

async function handleBackfillEmails(req: Request, env: Env): Promise<Response> {
  const secret = req.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_MIGRATE_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { results } = await env.DB.prepare(
    'SELECT clerk_user_id FROM household_members WHERE email IS NULL'
  ).all<{ clerk_user_id: string }>()

  const clerk = getClerkClient(env)
  const log: string[] = []

  for (const row of results) {
    const clerkUserId = row.clerk_user_id
    const user = await clerk.users.getUser(clerkUserId)
    const email = user.emailAddresses[0]?.emailAddress
    if (email) {
      await env.DB.prepare(
        'UPDATE household_members SET email = ? WHERE clerk_user_id = ?'
      ).bind(email, clerkUserId).run()
      log.push(`backfilled ${clerkUserId} → ${email}`)
    } else {
      log.push(`skipped ${clerkUserId} — no email found`)
    }
  }

  return Response.json({ ok: true, log })
}

async function handleMigrateKvToEmail(req: Request, env: Env): Promise<Response> {
  const secret = req.headers.get('X-Admin-Secret')
  if (!secret || secret !== env.ADMIN_MIGRATE_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { results } = await env.DB
    .prepare('SELECT clerk_user_id, email FROM household_members WHERE email IS NOT NULL')
    .all<{ clerk_user_id: string; email: string }>()

  const log: string[] = []

  for (const row of results) {
    const { clerk_user_id, email } = row

    // Migrate google_tokens
    const tokensRaw = await env.AUTH_KV.get(`google_tokens:${clerk_user_id}`)
    if (tokensRaw) {
      await env.AUTH_KV.put(`google_tokens:${email}`, tokensRaw)
      await env.AUTH_KV.delete(`google_tokens:${clerk_user_id}`)
      log.push(`google_tokens: ${clerk_user_id} → ${email}`)
    }

    // Migrate user_calendars
    const calsRaw = await env.AUTH_KV.get(`user_calendars:${clerk_user_id}`)
    if (calsRaw) {
      await env.AUTH_KV.put(`user_calendars:${email}`, calsRaw)
      await env.AUTH_KV.delete(`user_calendars:${clerk_user_id}`)
      log.push(`user_calendars: ${clerk_user_id} → ${email}`)
    }
  }

  return Response.json({ ok: true, migrated: results.length, log })
}

const routes: Array<[string, URLPattern, AuthHandler]> = [
  ['DELETE', new URLPattern({ pathname: '/household/leave',             search: '*' }), leaveHousehold],
  ['GET',    new URLPattern({ pathname: '/household/me',                search: '*' }), getHousehold],
  ['POST',   new URLPattern({ pathname: '/household',                   search: '*' }), createHousehold],
  ['PATCH',  new URLPattern({ pathname: '/household',                   search: '*' }), renameHousehold],
  ['POST',   new URLPattern({ pathname: '/household/join',              search: '*' }), joinHousehold],
  ['POST',   new URLPattern({ pathname: '/household/invite',            search: '*' }), generateInvite],
  ['DELETE', new URLPattern({ pathname: '/household/invite',            search: '*' }), revokeInvite],
  ['GET',    new URLPattern({ pathname: '/household/settings',          search: '*' }), getHouseholdSettings],
  ['PATCH',  new URLPattern({ pathname: '/household/settings',          search: '*' }), updateHouseholdSettings],
  ['GET',    new URLPattern({ pathname: '/items',                       search: '*' }), getItems],
  ['POST',   new URLPattern({ pathname: '/items',                       search: '*' }), createItem],
  ['PATCH',  new URLPattern({ pathname: '/items/:id',                   search: '*' }), updateItem],
  ['DELETE', new URLPattern({ pathname: '/items/:id',                   search: '*' }), deleteItem],
  ['POST',   new URLPattern({ pathname: '/items/:id/merge',             search: '*' }), mergeItem],
  ['POST',   new URLPattern({ pathname: '/recipes',                     search: '*' }), createRecipe],
  ['GET',    new URLPattern({ pathname: '/recipes',                     search: '*' }), getRecipes],
  ['GET',    new URLPattern({ pathname: '/recipes/:id',                 search: '*' }), getRecipe],
  ['PATCH',  new URLPattern({ pathname: '/recipes/:id',                 search: '*' }), updateRecipe],
  ['DELETE', new URLPattern({ pathname: '/recipes/:id',                 search: '*' }), deleteRecipe],
  ['GET',    new URLPattern({ pathname: '/recipes/:id/ingredients',     search: '*' }), getRecipeIngredients],
  ['POST',   new URLPattern({ pathname: '/recipes/:id/share',           search: '*' }), shareRecipe],
  ['POST',   new URLPattern({ pathname: '/recipe-ingredients',          search: '*' }), createRecipeIngredient],
  ['PATCH',  new URLPattern({ pathname: '/recipe-ingredients/:id',      search: '*' }), updateRecipeIngredient],
  ['DELETE', new URLPattern({ pathname: '/recipe-ingredients/:id',      search: '*' }), deleteRecipeIngredient],
  ['POST',   new URLPattern({ pathname: '/recipe-photos',               search: '*' }), uploadRecipePhoto],
  ['GET',    new URLPattern({ pathname: '/todos',                       search: '*' }), getTodos],
  ['POST',   new URLPattern({ pathname: '/todos',                       search: '*' }), createTodo],
  ['PATCH',  new URLPattern({ pathname: '/todos/:id',                   search: '*' }), updateTodo],
  ['DELETE', new URLPattern({ pathname: '/todos/:id',                   search: '*' }), deleteTodo],
  ['GET',    new URLPattern({ pathname: '/calendar',                    search: '*' }), getCalendarEvents],
  ['GET',    new URLPattern({ pathname: '/user-calendars',              search: '*' }), listUserCalendars],
  ['PUT',    new URLPattern({ pathname: '/user-calendars',              search: '*' }), updateUserCalendars],
  ['GET',    new URLPattern({ pathname: '/auth/google/status',          search: '*' }), getGoogleAuthStatus],
  ['GET',    new URLPattern({ pathname: '/auth/google',                 search: '*' }), initiateGoogleOAuth],
  ['DELETE', new URLPattern({ pathname: '/auth/google',                 search: '*' }), disconnectGoogle],
  ['POST',   new URLPattern({ pathname: '/concepts/backfill',           search: '*' }), backfillConceptsRoute],
  ['GET',    new URLPattern({ pathname: '/concepts/:type',              search: '*' }), listConcepts],
  ['POST',   new URLPattern({ pathname: '/concepts/:type',              search: '*' }), createConcept],
  ['PATCH',  new URLPattern({ pathname: '/concepts/:type/:id',          search: '*' }), updateConcept],
  ['DELETE', new URLPattern({ pathname: '/concepts/:type/:id',          search: '*' }), deleteConcept],
]

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const origin = resolveOrigin(req, env.ALLOWED_ORIGIN ?? DEFAULT_ORIGIN)

    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    // Clerk's OAuth callback sometimes redirects to the worker URL instead of the
    // frontend. Forward it so the frontend JS SDK can process the handshake.
    const reqUrl = new URL(req.url)
    if (reqUrl.searchParams.has('__clerk_handshake')) {
      const base = env.APP_BASE_URL ?? 'http://localhost:5173'
      return Response.redirect(base + reqUrl.pathname + reqUrl.search, 302)
    }

    try {
      // 1. Dispatch public (unauthenticated) routes
      for (const [method, pattern, handler] of publicRoutes) {
        if (req.method !== method) continue
        const match = pattern.exec(req.url)
        if (!match) continue
        const groups = Object.values(match.pathname.groups).map(v => v ?? '')
        const res = await handler(req, env, ...groups)
        console.log(`[ROUTE HIT] ${req.method} ${req.url}`)
        return withCors(res, origin)
      }

      // 2. Auth check — required for all remaining routes
      const token = req.headers.get('Authorization')?.replace('Bearer ', '')
      if (!token) return err(401, 'Unauthorized', origin)

      // Verify Clerk JWT
      const verified = await verifyClerkToken(token, env)
      if (!verified) return err(401, 'Unauthorized', origin)
      const { userId: clerkUserId, email } = verified

      // Resolve household membership from D1
      let membership = await env.DB.prepare(
        'SELECT household_id, role, email FROM household_members WHERE clerk_user_id = ?'
      ).bind(clerkUserId).first<{ household_id: string; role: string; email: string | null }>()

      // Phase 4: if no membership found by clerk_user_id, try email (handles Clerk instance switch)
      if (!membership && email) {
        const byEmail = await env.DB.prepare(
          'SELECT household_id, role FROM household_members WHERE email = ?'
        ).bind(email).first<{ household_id: string; role: string }>()
        if (byEmail) {
          await env.DB.prepare(
            'UPDATE household_members SET clerk_user_id = ? WHERE email = ?'
          ).bind(clerkUserId, email).run()
          membership = { ...byEmail, email }
        }
      }

      // Keep stored email in sync if it changed in Clerk
      if (membership && email && membership.email !== email) {
        await env.DB.prepare(
          'UPDATE household_members SET email = ? WHERE clerk_user_id = ?'
        ).bind(email, clerkUserId).run()
      }

      const ctx: RequestContext = {
        clerkUserId,
        email,
        householdId: membership?.household_id ?? null,
        role: (membership?.role as 'owner' | 'member') ?? null,
      }

      // 3. Dispatch authenticated routes
      for (const [method, pattern, handler] of routes) {
        if (req.method !== method) continue
        const match = pattern.exec(req.url)
        if (!match) continue
        const groups = Object.values(match.pathname.groups).map(v => v ?? '')
        const res = await handler(req, env, ctx, ...groups)
        console.log(`[ROUTE HIT] ${req.method} ${req.url}`)
        return withCors(res, origin)
      }

      console.log(`[ROUTE MISS] ${req.method} ${req.url}`)
      return err(404, 'Not found', origin)
    } catch (e) {
      if (e instanceof NotionError) {
        const clientStatus = (e.status === 401 || e.status === 403)
          ? 502
          : (e.status >= 400 && e.status < 500 ? e.status : 502)
        return err(clientStatus, e.message, origin)
      }
      console.error(e)
      return err(500, 'Internal server error', origin)
    }
  },
} satisfies ExportedHandler<Env>
