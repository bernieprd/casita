import type { Env, RequestContext } from '../types'
import { getClerkClient } from '../auth/clerk'
import { rebuildSharedIndex } from './shared-calendar-index'

function err(status: number, message: string): Response {
  return Response.json({ error: message }, { status })
}

export async function deleteAccount(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (ctx.householdId && ctx.role === 'owner') {
    const others = await env.DB
      .prepare('SELECT clerk_user_id FROM household_members WHERE household_id = ? AND clerk_user_id != ?')
      .bind(ctx.householdId, ctx.clerkUserId)
      .all<{ clerk_user_id: string }>()

    if (others.results.length > 0) {
      return err(400, 'Transfer ownership to another member before deleting your account')
    }
  }

  await getClerkClient(env).users.deleteUser(ctx.clerkUserId)

  if (ctx.householdId) {
    if (ctx.role === 'owner') {
      await env.DB.batch([
        env.DB.prepare('DELETE FROM household_members WHERE household_id = ?').bind(ctx.householdId),
        env.DB.prepare('DELETE FROM households WHERE id = ?').bind(ctx.householdId),
      ])
    } else {
      await env.DB
        .prepare('DELETE FROM household_members WHERE clerk_user_id = ? AND household_id = ?')
        .bind(ctx.clerkUserId, ctx.householdId)
        .run()
    }
  }

  await Promise.all([
    env.AUTH_KV.delete(`google_tokens:${ctx.email}`),
    env.AUTH_KV.delete(`user_calendars:${ctx.email}`),
  ])

  if (ctx.householdId) {
    await rebuildSharedIndex(ctx.email, [], ctx.householdId, env)
  }

  return Response.json({ ok: true })
}

export async function exportAccountData(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  let household: {
    name: string | null
    members: unknown[]
    items: unknown[]
    recipes: unknown[]
    todos: unknown[]
  } | null = null

  if (ctx.householdId) {
    const [householdRow, members, items, recipes, todos] = await Promise.all([
      env.DB
        .prepare('SELECT name FROM households WHERE id = ?')
        .bind(ctx.householdId)
        .first<{ name: string }>(),
      env.DB
        .prepare('SELECT clerk_user_id, role FROM household_members WHERE household_id = ?')
        .bind(ctx.householdId)
        .all<{ clerk_user_id: string; role: string }>(),
      env.DB
        .prepare('SELECT id, name, category, on_shopping_list FROM items WHERE household_id = ?')
        .bind(ctx.householdId)
        .all<{ id: string; name: string; category: string | null; on_shopping_list: number }>(),
      env.DB
        .prepare('SELECT id, name, type, day, url FROM recipes WHERE household_id = ?')
        .bind(ctx.householdId)
        .all<{ id: string; name: string; type: string | null; day: string | null; url: string | null }>(),
      env.DB
        .prepare('SELECT id, name, status, priority, due FROM todos WHERE household_id = ?')
        .bind(ctx.householdId)
        .all<{ id: string; name: string; status: string | null; priority: string | null; due: string | null }>(),
    ])

    household = {
      name: householdRow?.name ?? null,
      members: members.results,
      items: items.results,
      recipes: recipes.results,
      todos: todos.results,
    }
  }

  const [calendarsRaw, tokensRaw] = await Promise.all([
    env.AUTH_KV.get(`user_calendars:${ctx.email}`),
    env.AUTH_KV.get(`google_tokens:${ctx.email}`),
  ])

  const data = {
    exportedAt: new Date().toISOString(),
    profile: {
      clerkUserId: ctx.clerkUserId,
      email: ctx.email,
      householdId: ctx.householdId,
      role: ctx.role,
    },
    household,
    googleCalendar: {
      connected: tokensRaw !== null,
      calendars: calendarsRaw ? JSON.parse(calendarsRaw) : null,
    },
  }

  return new Response(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="casita-export.json"',
    },
  })
}
