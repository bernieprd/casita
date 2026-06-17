import type { Env, RequestContext, ConceptItem } from '../types'

type ConceptType = 'recipe-types' | 'categories' | 'supermarkets' | 'todo-categories'

const TABLE: Record<ConceptType, string> = {
  'recipe-types':    'household_recipe_types',
  'categories':      'household_categories',
  'supermarkets':    'household_supermarkets',
  'todo-categories': 'household_todo_categories',
}

function rowToConcept(row: Record<string, unknown>): ConceptItem {
  return {
    id:          row.id as string,
    name:        row.name as string,
    sort_order:  row.sort_order as number,
    usage_count: (row.usage_count as number) ?? 0,
  }
}

function isValidType(type: string): type is ConceptType {
  return type in TABLE
}


// JOIN-based queries compute usage_count in a single pass, replacing correlated subqueries.
const JOIN_QUERY: Record<ConceptType, string> = {
  'recipe-types':
    `SELECT c.*, COUNT(r.id) AS usage_count
     FROM household_recipe_types c
     LEFT JOIN recipes r ON r.household_id = c.household_id AND r.type = c.name
     WHERE c.household_id = ?
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.name ASC`,
  'categories':
    `SELECT c.*, COUNT(i.id) AS usage_count
     FROM household_categories c
     LEFT JOIN items i ON i.household_id = c.household_id AND i.category = c.name
     WHERE c.household_id = ?
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.name ASC`,
  'supermarkets':
    `SELECT c.*, COUNT(sm.item_id) AS usage_count
     FROM household_supermarkets c
     LEFT JOIN items i ON i.household_id = c.household_id
     LEFT JOIN item_supermarkets sm ON sm.item_id = i.id AND sm.supermarket = c.name
     WHERE c.household_id = ?
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.name ASC`,
  'todo-categories':
    `SELECT c.*, COUNT(t.id) AS usage_count
     FROM household_todo_categories c
     LEFT JOIN todos t ON t.category_id = c.id AND t.household_id = c.household_id
     WHERE c.household_id = ?
     GROUP BY c.id
     ORDER BY c.sort_order ASC, c.name ASC`,
}

export async function listConcepts(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'ERR_UNKNOWN_CONCEPT_TYPE' }, { status: 400 })

  const { results } = await env.DB
    .prepare(JOIN_QUERY[type])
    .bind(ctx.householdId)
    .all<Record<string, unknown>>()

  return Response.json(results.map(rowToConcept), { headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' } })
}

export async function createConcept(
  req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'ERR_UNKNOWN_CONCEPT_TYPE' }, { status: 400 })

  const body = await req.json<{ name?: string; sort_order?: number }>()
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'ERR_NAME_REQUIRED' }, { status: 400 })
  }

  const table = TABLE[type]
  const id = crypto.randomUUID()
  const name = body.name.trim()
  const sort_order = body.sort_order ?? 0

  try {
    await env.DB
      .prepare(`INSERT INTO ${table} (id, household_id, name, sort_order) VALUES (?, ?, ?, ?)`)
      .bind(id, ctx.householdId, name, sort_order)
      .run()
  } catch {
    return Response.json({ error: 'ERR_DUPLICATE_NAME' }, { status: 409 })
  }

  return Response.json({ id, name, sort_order }, { status: 201 })
}

export async function updateConcept(
  req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'ERR_UNKNOWN_CONCEPT_TYPE' }, { status: 400 })

  const table = TABLE[type]
  const body = await req.json<{ name?: string; sort_order?: number }>()

  const fields: string[] = []
  const values: unknown[] = []

  if ('name' in body && body.name !== undefined) {
    fields.push('name = ?')
    values.push(body.name.trim())
  }
  if ('sort_order' in body && body.sort_order !== undefined) {
    fields.push('sort_order = ?')
    values.push(body.sort_order)
  }

  if (fields.length === 0) return Response.json({ error: 'ERR_INVALID_REQUEST' }, { status: 400 })

  try {
    await env.DB
      .prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`)
      .bind(...values, id, ctx.householdId)
      .run()
  } catch {
    return Response.json({ error: 'ERR_DUPLICATE_NAME' }, { status: 409 })
  }

  const row = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
    .bind(id, ctx.householdId)
    .first<Record<string, unknown>>()

  if (!row) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })
  return Response.json(rowToConcept(row))
}

export async function deleteConcept(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'ERR_UNKNOWN_CONCEPT_TYPE' }, { status: 400 })

  const table = TABLE[type]

  const row = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
    .bind(id, ctx.householdId)
    .first<Record<string, unknown>>()

  if (!row) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })

  const name = row.name as string
  const clearStmt = type === 'recipe-types'
    ? env.DB.prepare('UPDATE recipes SET type = NULL WHERE household_id = ? AND type = ?').bind(ctx.householdId, name)
    : type === 'categories'
    ? env.DB.prepare('UPDATE items SET category = NULL WHERE household_id = ? AND category = ?').bind(ctx.householdId, name)
    : type === 'todo-categories'
    ? env.DB.prepare('UPDATE todos SET category_id = NULL WHERE category_id = ? AND household_id = ?').bind(id, ctx.householdId)
    : env.DB.prepare('DELETE FROM item_supermarkets WHERE item_id IN (SELECT id FROM items WHERE household_id = ?) AND supermarket = ?').bind(ctx.householdId, name)

  await env.DB.batch([
    clearStmt,
    env.DB.prepare(`DELETE FROM ${table} WHERE id = ? AND household_id = ?`).bind(id, ctx.householdId),
  ])

  return new Response(null, { status: 204 })
}

export async function seedHouseholdConcepts(env: Env, householdId: string): Promise<void> {
  const recipeTypes = ['Favourite', 'Try again', 'New']
  for (let i = 0; i < recipeTypes.length; i++) {
    await env.DB
      .prepare('INSERT OR IGNORE INTO household_recipe_types (id, household_id, name, sort_order) VALUES (?, ?, ?, ?)')
      .bind(crypto.randomUUID(), householdId, recipeTypes[i], i + 1)
      .run()
  }
}

export async function backfillConcepts(
  env: Env,
  householdId: string,
): Promise<{ categories: number; supermarkets: number; recipeTypes: number }> {
  const { results: catRows } = await env.DB
    .prepare('SELECT DISTINCT category FROM items WHERE household_id = ? AND category IS NOT NULL')
    .bind(householdId)
    .all<{ category: string }>()

  let categories = 0
  for (const { category } of catRows) {
    const result = await env.DB
      .prepare('INSERT OR IGNORE INTO household_categories (id, household_id, name, sort_order) VALUES (?, ?, ?, 0)')
      .bind(crypto.randomUUID(), householdId, category)
      .run()
    categories += result.meta.changes
  }

  const { results: supRows } = await env.DB
    .prepare(
      `SELECT DISTINCT supermarket FROM item_supermarkets
       WHERE item_id IN (SELECT id FROM items WHERE household_id = ?)`,
    )
    .bind(householdId)
    .all<{ supermarket: string }>()

  let supermarkets = 0
  for (const { supermarket } of supRows) {
    const result = await env.DB
      .prepare('INSERT OR IGNORE INTO household_supermarkets (id, household_id, name, sort_order) VALUES (?, ?, ?, 0)')
      .bind(crypto.randomUUID(), householdId, supermarket)
      .run()
    supermarkets += result.meta.changes
  }

  const { results: typeRows } = await env.DB
    .prepare('SELECT DISTINCT type FROM recipes WHERE household_id = ? AND type IS NOT NULL')
    .bind(householdId)
    .all<{ type: string }>()

  let recipeTypes = 0
  for (const { type } of typeRows) {
    const result = await env.DB
      .prepare('INSERT OR IGNORE INTO household_recipe_types (id, household_id, name, sort_order) VALUES (?, ?, ?, 0)')
      .bind(crypto.randomUUID(), householdId, type)
      .run()
    recipeTypes += result.meta.changes
  }

  return { categories, supermarkets, recipeTypes }
}

export async function backfillConceptsRoute(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })
  const result = await backfillConcepts(env, ctx.householdId)
  return Response.json(result)
}
