import type { Block, Env, Recipe, RecipeIngredient, RecipeWithBlocks, RequestContext } from '../types'
import { getAppBaseUrl } from '../types'

type RecipeRow = {
  id: string
  household_id: string
  name: string
  type: string | null
  day: string | null
  url: string | null
  cover_photo_url: string | null
  share_token: string | null
  created_at: number
  updated_at: number
}

type BlockRow = {
  id: string
  recipe_id: string
  type: string
  text: string
  sort_order: number
}

type IngredientJoinRow = {
  id: string
  household_id: string
  recipe_id: string
  item_id: string
  item_name: string
  quantity: string | null
  section: string | null
  needs_shopping: number
  sort_order: number
}

function rowToRecipe(row: RecipeRow): Recipe {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    day: row.day,
    url: row.url,
    coverPhotoUrl: row.cover_photo_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function rowToBlock(row: BlockRow): Block {
  return { id: row.id, type: row.type, text: row.text }
}

function rowToIngredient(row: IngredientJoinRow): RecipeIngredient {
  return {
    id: row.id,
    recipeId: row.recipe_id,
    itemId: row.item_id,
    itemName: row.item_name ?? '',
    quantity: row.quantity,
    section: row.section,
    needsShopping: Boolean(row.needs_shopping),
  }
}

function textToBlock(line: string): { type: string; text: string } {
  if (line === '---')                                     return { type: 'divider',            text: '' }
  if (line.startsWith('# ') && !line.startsWith('## '))  return { type: 'heading_1',          text: line.slice(2) }
  if (line.startsWith('## ') && !line.startsWith('### ')) return { type: 'heading_2',         text: line.slice(3) }
  if (line.startsWith('### '))                            return { type: 'heading_3',          text: line.slice(4) }
  if (line.startsWith('- ') || line.startsWith('* '))    return { type: 'bulleted_list_item', text: line.slice(2) }
  return { type: 'paragraph', text: line }
}

export async function createRecipe(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const body = await req.json<{
    name: string
    type?: string | null
    day?: string | null
    url?: string | null
    coverUrl?: string | null
    instructions?: string
  }>()

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(
    `INSERT INTO recipes (id, household_id, name, type, day, url, cover_photo_url, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, ctx.householdId, body.name, body.type ?? null, body.day ?? null, body.url ?? null, body.coverUrl ?? null, now, now).run()

  if (body.instructions) {
    const lines = body.instructions.split('\n')
    if (lines.some(l => l.trim())) {
      await Promise.all(lines.map((line, i) => {
        const { type, text } = textToBlock(line)
        return env.DB.prepare(
          'INSERT INTO recipe_blocks (id, recipe_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?)',
        ).bind(crypto.randomUUID(), id, type, text, i).run()
      }))
    }
  }

  const row = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(id).first<RecipeRow>()
  return Response.json(rowToRecipe(row!), { status: 201 })
}

export async function getRecipes(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const { results } = await env.DB.prepare(
    'SELECT * FROM recipes WHERE household_id = ?',
  ).bind(ctx.householdId).all<RecipeRow>()

  return Response.json(results.map(rowToRecipe))
}

export async function getRecipe(_req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const [row, blocks] = await Promise.all([
    env.DB.prepare('SELECT * FROM recipes WHERE id = ? AND household_id = ?').bind(id, ctx.householdId).first<RecipeRow>(),
    env.DB.prepare('SELECT * FROM recipe_blocks WHERE recipe_id = ? ORDER BY sort_order').bind(id).all<BlockRow>(),
  ])

  if (!row) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })

  const recipe: RecipeWithBlocks = {
    ...rowToRecipe(row),
    blocks: blocks.results.map(rowToBlock),
  }
  return Response.json(recipe)
}

export async function updateRecipe(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const body = await req.json<{
    name?: string
    type?: string | null
    day?: string | null
    url?: string | null
    coverUrl?: string | null
    instructions?: string
  }>()

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [Date.now()]

  if ('name' in body)     { fields.push('name = ?');            values.push(body.name) }
  if ('type' in body)     { fields.push('type = ?');            values.push(body.type ?? null) }
  if ('day' in body)      { fields.push('day = ?');             values.push(body.day ?? null) }
  if ('url' in body)      { fields.push('url = ?');             values.push(body.url ?? null) }
  if ('coverUrl' in body) { fields.push('cover_photo_url = ?'); values.push(body.coverUrl ?? null) }

  await env.DB.prepare(
    `UPDATE recipes SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`,
  ).bind(...values, id, ctx.householdId).run()

  if ('instructions' in body) {
    await env.DB.prepare('DELETE FROM recipe_blocks WHERE recipe_id = ?').bind(id).run()
    const lines = (body.instructions ?? '').split('\n')
    if (lines.some(l => l.trim())) {
      await Promise.all(lines.map((line, i) => {
        const { type, text } = textToBlock(line)
        return env.DB.prepare(
          'INSERT INTO recipe_blocks (id, recipe_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?)',
        ).bind(crypto.randomUUID(), id, type, text, i).run()
      }))
    }
  }

  const row = await env.DB.prepare('SELECT * FROM recipes WHERE id = ?').bind(id).first<RecipeRow>()
  if (!row) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })
  return Response.json(rowToRecipe(row))
}

export async function getRecipeIngredients(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  recipeId: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const { results } = await env.DB.prepare(`
    SELECT ri.*, i.name AS item_name
    FROM recipe_ingredients ri
    JOIN items i ON i.id = ri.item_id
    WHERE ri.recipe_id = ? AND ri.household_id = ?
    ORDER BY ri.sort_order
  `).bind(recipeId, ctx.householdId).all<IngredientJoinRow>()

  return Response.json(results.map(rowToIngredient))
}

export async function shareRecipe(_req: Request, env: Env, ctx: RequestContext, recipeId: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  // Check for existing share token in D1
  const existing = await env.DB.prepare(
    'SELECT share_token FROM recipes WHERE id = ? AND household_id = ?',
  ).bind(recipeId, ctx.householdId).first<{ share_token: string | null }>()

  if (!existing) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })

  const appUrl = getAppBaseUrl(env)

  if (existing.share_token) {
    return Response.json({ token: existing.share_token, url: `${appUrl}/share/${existing.share_token}` })
  }

  const token = crypto.randomUUID()

  await env.DB.prepare(
    'UPDATE recipes SET share_token = ? WHERE id = ? AND household_id = ?',
  ).bind(token, recipeId, ctx.householdId).run()

  // Clean up legacy KV keys if they exist
  await Promise.all([
    env.AUTH_KV.delete(`share:${token}`),
    env.AUTH_KV.delete(`share-recipe:${recipeId}`),
  ])

  return Response.json({ token, url: `${appUrl}/share/${token}` }, { status: 201 })
}

export async function deleteRecipe(_req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  const existing = await env.DB.prepare(
    'SELECT id FROM recipes WHERE id = ? AND household_id = ?',
  ).bind(id, ctx.householdId).first<{ id: string }>()

  if (!existing) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })

  await Promise.all([
    env.DB.prepare('DELETE FROM recipe_ingredients WHERE recipe_id = ?').bind(id).run(),
    env.DB.prepare('DELETE FROM recipe_blocks WHERE recipe_id = ?').bind(id).run(),
  ])
  await env.DB.prepare('DELETE FROM recipes WHERE id = ? AND household_id = ?').bind(id, ctx.householdId).run()

  return new Response(null, { status: 204 })
}

export async function getPublicRecipe(_req: Request, env: Env, token: string): Promise<Response> {
  const row = await env.DB.prepare(
    'SELECT * FROM recipes WHERE share_token = ?',
  ).bind(token).first<RecipeRow>()

  if (!row) return Response.json({ error: 'ERR_NOT_FOUND' }, { status: 404 })

  const [blocks, ingredients] = await Promise.all([
    env.DB.prepare(
      'SELECT * FROM recipe_blocks WHERE recipe_id = ? ORDER BY sort_order',
    ).bind(row.id).all<BlockRow>(),
    env.DB.prepare(`
      SELECT ri.*, i.name AS item_name
      FROM recipe_ingredients ri
      JOIN items i ON i.id = ri.item_id
      WHERE ri.recipe_id = ?
      ORDER BY ri.sort_order
    `).bind(row.id).all<IngredientJoinRow>(),
  ])

  const recipe: RecipeWithBlocks = {
    ...rowToRecipe(row),
    blocks: blocks.results.map(rowToBlock),
  }

  return Response.json({ recipe, ingredients: ingredients.results.map(rowToIngredient) })
}
