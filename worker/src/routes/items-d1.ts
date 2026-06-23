import type { Env, Item, RequestContext } from '../types'

type ItemRow = {
  id: string
  household_id: string
  name: string
  category: string | null
  on_shopping_list: number
  created_at: number
  updated_at: number
}

async function fetchItemWithJunctions(env: Env, id: string): Promise<Item | null> {
  const row = await env.DB.prepare(
    'SELECT * FROM items WHERE id = ?',
  ).bind(id).first<ItemRow>()
  if (!row) return null

  const supermarkets = await env.DB.prepare('SELECT supermarket FROM item_supermarkets WHERE item_id = ?').bind(id).all<{ supermarket: string }>()

  return rowToItem(row, supermarkets.results.map(r => r.supermarket))
}

function rowToItem(row: ItemRow, supermarkets: string[]): Item {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    supermarkets,
    onShoppingList: Boolean(row.on_shopping_list),
  }
}

export async function getItems(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const url = new URL(req.url)
  const shopping = url.searchParams.get('shopping')

  const baseFilter = shopping === 'true'
    ? 'i.household_id = ? AND i.on_shopping_list = 1'
    : 'i.household_id = ?'

  // Single LEFT JOIN avoids a second round-trip and has no bound-parameter limit
  // (the old IN (?, ?, ...) approach broke when households exceeded 100 items)
  type JoinRow = ItemRow & { supermarket: string | null }
  const { results } = await env.DB
    .prepare(`SELECT i.*, sm.supermarket FROM items i LEFT JOIN item_supermarkets sm ON sm.item_id = i.id WHERE ${baseFilter}`)
    .bind(ctx.householdId)
    .all<JoinRow>()

  const itemMap = new Map<string, { row: ItemRow; supermarkets: string[] }>()
  for (const row of results) {
    if (!itemMap.has(row.id)) {
      itemMap.set(row.id, { row, supermarkets: [] })
    }
    if (row.supermarket) {
      itemMap.get(row.id)!.supermarkets.push(row.supermarket)
    }
  }

  const items = [...itemMap.values()].map(({ row, supermarkets }) => rowToItem(row, supermarkets))
  return Response.json(items, { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
}

export async function createItem(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const body = await req.json<{
    name: string
    category?: string | null
    supermarkets?: string[]
    onShoppingList?: boolean
  }>()

  if (!body.name || body.name.trim().length === 0 || body.name.length > 500) return Response.json({ error: 'ERR_INVALID_NAME' }, { status: 400 })

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(
    `INSERT INTO items (id, household_id, name, category, on_shopping_list, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, ctx.householdId, body.name, body.category ?? null, body.onShoppingList ? 1 : 0, now, now).run()

  const supermarkets = body.supermarkets ?? []

  await Promise.all(
    supermarkets.map(s =>
      env.DB.prepare('INSERT OR IGNORE INTO item_supermarkets (item_id, supermarket) VALUES (?, ?)').bind(id, s).run(),
    ),
  )

  const item = await fetchItemWithJunctions(env, id)
  return Response.json(item!, { status: 201 })
}

export async function updateItem(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const body = await req.json<{
    name?: string
    category?: string | null
    supermarkets?: string[]
    onShoppingList?: boolean
  }>()

  if ('name' in body && (!body.name || body.name.trim().length === 0 || body.name.length > 500)) return Response.json({ error: 'ERR_INVALID_NAME' }, { status: 400 })

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [Date.now()]

  if ('name' in body)           { fields.push('name = ?');             values.push(body.name) }
  if ('category' in body)       { fields.push('category = ?');         values.push(body.category ?? null) }
  if ('onShoppingList' in body) { fields.push('on_shopping_list = ?'); values.push(body.onShoppingList ? 1 : 0) }

  await env.DB.prepare(
    `UPDATE items SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`,
  ).bind(...values, id, ctx.householdId).run()

  // Replace junction tables when provided
  if (body.supermarkets !== undefined) {
    await env.DB.prepare('DELETE FROM item_supermarkets WHERE item_id = ?').bind(id).run()
    await Promise.all(
      body.supermarkets.map(s =>
        env.DB.prepare('INSERT OR IGNORE INTO item_supermarkets (item_id, supermarket) VALUES (?, ?)').bind(id, s).run(),
      ),
    )
  }

  const item = await fetchItemWithJunctions(env, id)
  if (!item) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })
  return Response.json(item)
}

export async function deleteItem(_req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  await env.DB.prepare(
    'DELETE FROM items WHERE id = ? AND household_id = ?',
  ).bind(id, ctx.householdId).run()

  return new Response(null, { status: 204 })
}

export async function mergeItem(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const { keepId } = await req.json<{ keepId: string }>()

  // Atomically re-point all recipe_ingredients from the discarded item to the keeper, then delete
  await env.DB.batch([
    env.DB.prepare(
      'UPDATE recipe_ingredients SET item_id = ? WHERE item_id = ? AND household_id = ?',
    ).bind(keepId, id, ctx.householdId),
    env.DB.prepare(
      'DELETE FROM items WHERE id = ? AND household_id = ?',
    ).bind(id, ctx.householdId),
  ])

  const item = await fetchItemWithJunctions(env, keepId)
  if (!item) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })
  return Response.json(item)
}
