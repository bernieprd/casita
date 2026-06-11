import type { Env, RequestContext, ConceptItem } from '../types'

type ConceptType = 'recipe-types' | 'categories' | 'supermarkets'

const TABLE: Record<ConceptType, string> = {
  'recipe-types': 'household_recipe_types',
  'categories':   'household_categories',
  'supermarkets': 'household_supermarkets',
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


const USAGE_SUBQUERY: Record<ConceptType, string> = {
  'recipe-types': `(SELECT COUNT(*) FROM recipes WHERE household_id = c.household_id AND type = c.name)`,
  'categories':   `(SELECT COUNT(*) FROM items WHERE household_id = c.household_id AND category = c.name)`,
  'supermarkets': `(SELECT COUNT(*) FROM item_supermarkets WHERE item_id IN (SELECT id FROM items WHERE household_id = c.household_id) AND supermarket = c.name)`,
}

export async function listConcepts(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'Unknown concept type' }, { status: 400 })

  const table = TABLE[type]
  const usageSub = USAGE_SUBQUERY[type]
  const { results } = await env.DB
    .prepare(`SELECT c.*, ${usageSub} AS usage_count FROM ${table} c WHERE c.household_id = ? ORDER BY c.sort_order ASC, c.name ASC`)
    .bind(ctx.householdId)
    .all<Record<string, unknown>>()

  return Response.json(results.map(rowToConcept))
}

export async function createConcept(
  req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'Unknown concept type' }, { status: 400 })

  const body = await req.json<{ name?: string; sort_order?: number }>()
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    return Response.json({ error: 'name is required' }, { status: 400 })
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
    return Response.json({ error: 'A concept with that name already exists' }, { status: 409 })
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
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'Unknown concept type' }, { status: 400 })

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

  if (fields.length === 0) return Response.json({ error: 'Nothing to update' }, { status: 400 })

  try {
    await env.DB
      .prepare(`UPDATE ${table} SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`)
      .bind(...values, id, ctx.householdId)
      .run()
  } catch {
    return Response.json({ error: 'A concept with that name already exists' }, { status: 409 })
  }

  const row = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
    .bind(id, ctx.householdId)
    .first<Record<string, unknown>>()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(rowToConcept(row))
}

export async function deleteConcept(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  type: string,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })
  if (!isValidType(type)) return Response.json({ error: 'Unknown concept type' }, { status: 400 })

  const table = TABLE[type]

  const row = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE id = ? AND household_id = ?`)
    .bind(id, ctx.householdId)
    .first<Record<string, unknown>>()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })

  const name = row.name as string
  const clearStmt = type === 'recipe-types'
    ? env.DB.prepare('UPDATE recipes SET type = NULL WHERE household_id = ? AND type = ?').bind(ctx.householdId, name)
    : type === 'categories'
    ? env.DB.prepare('UPDATE items SET category = NULL WHERE household_id = ? AND category = ?').bind(ctx.householdId, name)
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
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })
  const result = await backfillConcepts(env, ctx.householdId)
  return Response.json(result)
}
