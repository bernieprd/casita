import type { Env, RequestContext } from '../types'
import { getAppBaseUrl } from '../types'
import { getClerkClient } from '../auth/clerk'
import { rebuildSharedIndex } from './shared-calendar-index'

function err(status: number, code: string): Response {
  return Response.json({ error: code }, { status })
}

export async function deleteAccount(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (ctx.householdId && ctx.role === 'owner') {
    const others = await env.DB
      .prepare('SELECT clerk_user_id FROM household_members WHERE household_id = ? AND clerk_user_id != ?')
      .bind(ctx.householdId, ctx.clerkUserId)
      .all<{ clerk_user_id: string }>()

    if (others.results.length > 0) {
      return err(400, 'ERR_TRANSFER_OWNERSHIP_BEFORE_DELETE')
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
    env.DB.prepare('DELETE FROM user_comms_prefs WHERE clerk_user_id = ?').bind(ctx.clerkUserId).run(),
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

export async function unsubscribe(req: Request, env: Env): Promise<Response> {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) {
    return htmlResponse(400, 'Invalid unsubscribe link.', env)
  }

  const row = await env.DB
    .prepare('SELECT clerk_user_id FROM user_comms_prefs WHERE unsubscribe_token = ?')
    .bind(token)
    .first<{ clerk_user_id: string }>()

  if (!row) {
    return htmlResponse(404, 'This unsubscribe link has already been used or has expired.', env)
  }

  await env.DB
    .prepare('UPDATE user_comms_prefs SET unsubscribe_token = NULL, email_notifications_enabled = 0, email_frequency = ? WHERE clerk_user_id = ?')
    .bind('off', row.clerk_user_id)
    .run()

  return htmlResponse(200, 'You\'ve been unsubscribed from Casita emails.', env)
}

export async function getCommsPreferences(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const row = await env.DB
    .prepare('SELECT email_notifications_enabled, email_frequency FROM user_comms_prefs WHERE clerk_user_id = ?')
    .bind(ctx.clerkUserId)
    .first<{ email_notifications_enabled: number; email_frequency: string }>()
  if (!row) {
    return Response.json({ email_notifications_enabled: false, email_frequency: 'off' })
  }
  return Response.json({
    email_notifications_enabled: row.email_notifications_enabled === 1,
    email_frequency: row.email_frequency,
  })
}

export async function updateCommsPreferences(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  const body = await req.json<{ email_notifications_enabled?: unknown; email_frequency?: unknown }>()
  if (typeof body.email_notifications_enabled !== 'boolean') {
    return Response.json({ error: 'ERR_INVALID_INPUT' }, { status: 400 })
  }
  if (!['instant', 'off'].includes(body.email_frequency as string)) {
    return Response.json({ error: 'ERR_INVALID_FREQUENCY' }, { status: 400 })
  }
  await env.DB
    .prepare(`INSERT INTO user_comms_prefs (clerk_user_id, email_notifications_enabled, email_frequency)
      VALUES (?, ?, ?)
      ON CONFLICT(clerk_user_id) DO UPDATE SET
        email_notifications_enabled = excluded.email_notifications_enabled,
        email_frequency = excluded.email_frequency`)
    .bind(ctx.clerkUserId, body.email_notifications_enabled ? 1 : 0, body.email_frequency)
    .run()
  return Response.json({ ok: true })
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

function htmlResponse(status: number, message: string, env: Env): Response {
  const appUrl = getAppBaseUrl(env)
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Unsubscribe — Casita</title>
  <style>
    body { margin: 0; padding: 40px 16px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; }
    .card { max-width: 480px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,.08); text-align: center; }
    h1 { font-size: 20px; color: #18181b; margin: 0 0 12px; }
    p { font-size: 15px; color: #52525b; margin: 0 0 24px; line-height: 1.6; }
    a { display: inline-block; padding: 12px 24px; background: #18181b; color: #fff; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🏡 Casita</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${appUrl}">Back to Casita</a>
  </div>
</body>
</html>`
  return new Response(html, { status, headers: { 'Content-Type': 'text/html;charset=UTF-8' } })
}
