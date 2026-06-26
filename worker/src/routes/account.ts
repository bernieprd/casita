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

export async function exportHouseholdImportData(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) {
    return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })
  }

  const url = new URL(req.url)
  const includeParam = url.searchParams.get('include')
  const validSections = ['items', 'recipes', 'todos'] as const
  type Section = typeof validSections[number]

  let include: Section[]
  if (!includeParam || includeParam.trim() === '') {
    include = [...validSections]
  } else {
    const parsed = includeParam.split(',').filter((s): s is Section =>
      (validSections as ReadonlyArray<string>).includes(s)
    )
    include = parsed.length > 0 ? parsed : [...validSections]
  }

  const householdId = ctx.householdId

  const [rawItems, rawRecipes, rawTodos, rawSupermarkets] = await Promise.all([
    include.includes('items')
      ? env.DB
          .prepare('SELECT id, name, category, on_shopping_list FROM items WHERE household_id = ?')
          .bind(householdId)
          .all<{ id: string; name: string; category: string | null; on_shopping_list: number }>()
      : null,
    include.includes('recipes')
      ? env.DB
          .prepare('SELECT id, name, type, url FROM recipes WHERE household_id = ?')
          .bind(householdId)
          .all<{ id: string; name: string; type: string | null; url: string | null }>()
      : null,
    include.includes('todos')
      ? env.DB
          .prepare(`SELECT t.name, t.status, t.priority, t.due,
                           t.notes, t.url, t.frequency, t.frequency_interval, t.frequency_days,
                           c.name AS category_name
                    FROM todos t
                    LEFT JOIN household_todo_categories c
                      ON t.category_id = c.id AND c.household_id = t.household_id
                    WHERE t.household_id = ?`)
          .bind(householdId)
          .all<{
            name: string; status: string; priority: string | null; due: string | null
            notes: string | null; url: string | null
            frequency: string | null; frequency_interval: number | null; frequency_days: string | null
            category_name: string | null
          }>()
      : null,
    include.includes('items')
      ? env.DB
          .prepare(`SELECT s.item_id, s.supermarket
                    FROM item_supermarkets s
                    JOIN items i ON s.item_id = i.id
                    WHERE i.household_id = ?`)
          .bind(householdId)
          .all<{ item_id: string; supermarket: string }>()
      : null,
  ])

  const supermarketsByItemId = new Map<string, string[]>()
  if (rawSupermarkets) {
    for (const row of rawSupermarkets.results) {
      const list = supermarketsByItemId.get(row.item_id) ?? []
      list.push(row.supermarket)
      supermarketsByItemId.set(row.item_id, list)
    }
  }

  const payload: {
    version: number
    items?: Array<{ name: string; category: string | null; onShoppingList: boolean; supermarkets: string[] }>
    recipes?: Array<{
      name: string
      type: string | null
      url: string | null
      instructions: string
      ingredients: Array<{ name: string; quantity: string | null }>
    }>
    todos?: Array<{
      name: string; status: string; priority: string | null; due: string | null
      notes: string | null; url: string | null
      frequency: string | null; frequency_interval: number | null; frequency_days: string | null
      category: string | null
    }>
  } = { version: 1 }

  if (rawItems) {
    payload.items = rawItems.results.map(r => ({
      name: r.name,
      category: r.category,
      onShoppingList: r.on_shopping_list === 1,
      supermarkets: supermarketsByItemId.get(r.id) ?? [],
    }))
  }

  if (rawTodos) {
    payload.todos = rawTodos.results.map(r => ({
      name: r.name,
      status: r.status,
      priority: r.priority,
      due: r.due,
      notes: r.notes,
      url: r.url,
      frequency: r.frequency,
      frequency_interval: r.frequency != null ? (r.frequency_interval ?? 1) : null,
      frequency_days: r.frequency_days,
      category: r.category_name,
    }))
  }

  if (rawRecipes) {
    const recipeRows = rawRecipes.results

    const recipeIds = recipeRows.map(r => r.id)
    const ph = recipeIds.map(() => '?').join(', ')

    const [blocksResult, ingredientsResult] = recipeIds.length > 0
      ? await Promise.all([
          env.DB
            .prepare(`SELECT recipe_id, type, text FROM recipe_blocks WHERE recipe_id IN (${ph}) ORDER BY recipe_id, sort_order`)
            .bind(...recipeIds)
            .all<{ recipe_id: string; type: string; text: string }>(),
          env.DB
            .prepare(`SELECT ri.recipe_id, i.name, ri.quantity FROM recipe_ingredients ri JOIN items i ON ri.item_id = i.id WHERE ri.recipe_id IN (${ph}) ORDER BY ri.recipe_id, ri.sort_order`)
            .bind(...recipeIds)
            .all<{ recipe_id: string; name: string; quantity: string | null }>(),
        ])
      : [{ results: [] }, { results: [] }]

    const blocksByRecipeId = new Map<string, { type: string; text: string }[]>()
    for (const b of blocksResult.results) {
      const arr = blocksByRecipeId.get(b.recipe_id) ?? []
      arr.push(b)
      blocksByRecipeId.set(b.recipe_id, arr)
    }
    const ingredientsByRecipeId = new Map<string, { name: string; quantity: string | null }[]>()
    for (const i of ingredientsResult.results) {
      const arr = ingredientsByRecipeId.get(i.recipe_id) ?? []
      arr.push(i)
      ingredientsByRecipeId.set(i.recipe_id, arr)
    }

    payload.recipes = recipeRows.map(r => {
      const blocks = blocksByRecipeId.get(r.id) ?? []
      const ingredients = ingredientsByRecipeId.get(r.id) ?? []

      const instructions = blocks
        .map(b => {
          switch (b.type) {
            case 'divider': return '---'
            case 'heading_1': return `# ${b.text}`
            case 'heading_2': return `## ${b.text}`
            case 'heading_3': return `### ${b.text}`
            case 'bulleted_list_item': return `- ${b.text}`
            default: return b.text
          }
        })
        .join('\n')

      return {
        name: r.name,
        type: r.type,
        url: r.url,
        instructions,
        ingredients: ingredients.map(i => ({ name: i.name, quantity: i.quantity })),
      }
    })
  }

  return new Response(JSON.stringify(payload, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': 'attachment; filename="casita-household.json"',
    },
  })
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
