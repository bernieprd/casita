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

  const query = shopping === 'true'
    ? 'SELECT * FROM items WHERE household_id = ? AND on_shopping_list = 1'
    : 'SELECT * FROM items WHERE household_id = ?'

  const { results } = await env.DB.prepare(query).bind(ctx.householdId).all<ItemRow>()

  if (results.length === 0) {
    return Response.json([], { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
  }

  // Batch-fetch all supermarkets in a single query to avoid N+1
  const ids = results.map(r => r.id)
  const placeholders = ids.map(() => '?').join(', ')
  const { results: smRows } = await env.DB
    .prepare(`SELECT item_id, supermarket FROM item_supermarkets WHERE item_id IN (${placeholders})`)
    .bind(...ids)
    .all<{ item_id: string; supermarket: string }>()

  const smByItem = new Map<string, string[]>()
  for (const row of smRows) {
    const arr = smByItem.get(row.item_id) ?? []
    arr.push(row.supermarket)
    smByItem.set(row.item_id, arr)
  }

  const items = results.map(row => rowToItem(row, smByItem.get(row.id) ?? []))
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
