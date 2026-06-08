import type { Env, RequestContext, ConceptItem } from '../types'

type ConceptType = 'recipe-types' | 'categories' | 'supermarkets'

const TABLE: Record<ConceptType, string> = {
  'recipe-types': 'household_recipe_types',
  'categories':   'household_categories',
  'supermarkets': 'household_supermarkets',
}

function rowToConcept(row: Record<string, unknown>): ConceptItem {
  return {
    id:         row.id as string,
    name:       row.name as string,
    sort_order: row.sort_order as number,
  }
}

function isValidType(type: string): type is ConceptType {
  return type in TABLE
}

async function checkInUse(env: Env, householdId: string, type: ConceptType, name: string): Promise<number> {
  if (type === 'recipe-types') {
    const row = await env.DB
      .prepare('SELECT COUNT(*) as n FROM recipes WHERE household_id = ? AND type = ?')
      .bind(householdId, name).first<{ n: number }>()
    return row?.n ?? 0
  }
  if (type === 'categories') {
    const row = await env.DB
      .prepare('SELECT COUNT(*) as n FROM items WHERE household_id = ? AND category = ?')
      .bind(householdId, name).first<{ n: number }>()
    return row?.n ?? 0
  }
  if (type === 'supermarkets') {
    const row = await env.DB
      .prepare(
        `SELECT COUNT(*) as n FROM item_supermarkets
         WHERE item_id IN (SELECT id FROM items WHERE household_id = ?)
         AND supermarket = ?`,
      )
      .bind(householdId, name).first<{ n: number }>()
    return row?.n ?? 0
  }
  return 0
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
  const { results } = await env.DB
    .prepare(`SELECT * FROM ${table} WHERE household_id = ? ORDER BY sort_order ASC, name ASC`)
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

  const inUse = await checkInUse(env, ctx.householdId, type, row.name as string)
  if (inUse > 0) {
    return Response.json(
      { error: `In use by ${inUse} ${inUse === 1 ? 'item' : 'items'}` },
      { status: 409 },
    )
  }

  await env.DB
    .prepare(`DELETE FROM ${table} WHERE id = ? AND household_id = ?`)
    .bind(id, ctx.householdId)
    .run()

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
