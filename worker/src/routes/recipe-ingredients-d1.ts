import type { Env, RequestContext, RecipeIngredient } from '../types'

function rowToIngredient(row: Record<string, unknown>): RecipeIngredient {
  return {
    id: row.id as string,
    recipeId: row.recipe_id as string,
    itemId: row.item_id as string,
    itemName: (row.item_name as string | null) ?? '',
    quantity: (row.quantity as string | null) ?? null,
    section: (row.section as string | null) ?? null,
    needsShopping: Boolean(row.needs_shopping),
  }
}

export async function createRecipeIngredient(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{
    recipeId: string
    itemId: string
    quantity?: string | null
    section?: string | null
    needsShopping?: boolean
  }>()

  const id = crypto.randomUUID()

  // Get current max sort_order for this recipe
  const maxRow = await env.DB.prepare(
    'SELECT MAX(sort_order) AS max_order FROM recipe_ingredients WHERE recipe_id = ?',
  ).bind(body.recipeId).first<{ max_order: number | null }>()
  const sortOrder = (maxRow?.max_order ?? -1) + 1

  await env.DB.prepare(
    `INSERT INTO recipe_ingredients (id, household_id, recipe_id, item_id, quantity, section, needs_shopping, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, ctx.householdId, body.recipeId, body.itemId,
    body.quantity ?? null, body.section ?? null,
    body.needsShopping ? 1 : 0, sortOrder,
  ).run()

  const row = await env.DB.prepare(`
    SELECT ri.*, i.name AS item_name
    FROM recipe_ingredients ri
    JOIN items i ON i.id = ri.item_id
    WHERE ri.id = ?
  `).bind(id).first<Record<string, unknown>>()

  return Response.json(rowToIngredient(row!), { status: 201 })
}

export async function updateRecipeIngredient(
  req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{
    needsShopping?: boolean
    quantity?: string | null
    section?: string | null
    itemId?: string
  }>()

  const fields: string[] = []
  const values: unknown[] = []

  if ('quantity' in body)      { fields.push('quantity = ?');      values.push(body.quantity ?? null) }
  if ('section' in body)       { fields.push('section = ?');       values.push(body.section ?? null) }
  if ('itemId' in body)        { fields.push('item_id = ?');       values.push(body.itemId) }
  if ('needsShopping' in body) { fields.push('needs_shopping = ?'); values.push(body.needsShopping ? 1 : 0) }

  if (fields.length > 0) {
    await env.DB.prepare(
      `UPDATE recipe_ingredients SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`,
    ).bind(...values, id, ctx.householdId).run()
  }

  // Side-effect: keep the linked item's shopping list checkbox in sync
  if (body.needsShopping !== undefined) {
    const ing = await env.DB.prepare(
      'SELECT item_id FROM recipe_ingredients WHERE id = ?',
    ).bind(id).first<{ item_id: string }>()
    if (ing?.item_id) {
      await env.DB.prepare(
        'UPDATE items SET on_shopping_list = ?, updated_at = ? WHERE id = ? AND household_id = ?',
      ).bind(body.needsShopping ? 1 : 0, Date.now(), ing.item_id, ctx.householdId).run()
    }
  }

  const row = await env.DB.prepare(`
    SELECT ri.*, i.name AS item_name
    FROM recipe_ingredients ri
    JOIN items i ON i.id = ri.item_id
    WHERE ri.id = ?
  `).bind(id).first<Record<string, unknown>>()

  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(rowToIngredient(row))
}

export async function deleteRecipeIngredient(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  await env.DB.prepare(
    'DELETE FROM recipe_ingredients WHERE id = ? AND household_id = ?',
  ).bind(id, ctx.householdId).run()

  return new Response(null, { status: 204 })
}
