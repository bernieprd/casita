import { queryDatabase, updatePage, createPage, archivePage, getPage } from '../notion'
import { normalizeItem, itemToProps } from '../normalize'
import type { Env, RequestContext, HouseholdNotionConfig } from '../types'

export async function getItems(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?'
  ).bind(ctx.householdId).first<HouseholdNotionConfig>()
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const url = new URL(req.url)
  const shopping = url.searchParams.get('shopping')

  // Shopping list: always small, return flat array.
  if (shopping === 'true') {
    const filter = { property: 'Shopping List', checkbox: { equals: true } }
    const pages = await queryDatabase(env.NOTION_TOKEN, config.shopping_list_db, filter)
    return Response.json(pages.map(normalizeItem))
  }

  // Inventory: fetch all pages.
  const pages = await queryDatabase(env.NOTION_TOKEN, config.shopping_list_db)
  return Response.json(pages.map(normalizeItem))
}

export async function createItem(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?'
  ).bind(ctx.householdId).first<HouseholdNotionConfig>()
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const body = await req.json<Record<string, unknown>>()
  const props = itemToProps(body as Parameters<typeof itemToProps>[0])
  const page = await createPage(env.NOTION_TOKEN, config.shopping_list_db, props)
  return Response.json(normalizeItem(page), { status: 201 })
}

export async function updateItem(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<Record<string, unknown>>()
  const props = itemToProps(body as Parameters<typeof itemToProps>[0])
  const page = await updatePage(env.NOTION_TOKEN, id, props)
  return Response.json(normalizeItem(page))
}

export async function deleteItem(_req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  await archivePage(env.NOTION_TOKEN, id)
  return new Response(null, { status: 204 })
}

export async function mergeItem(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?'
  ).bind(ctx.householdId).first<HouseholdNotionConfig>()
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const { keepId } = await req.json<{ keepId: string }>()

  // Find all recipe-ingredients that reference the item being discarded
  const filter = { property: 'Ingredient', relation: { contains: id } }
  const ingredients = await queryDatabase(env.NOTION_TOKEN, config.recipe_ingredient_db, filter)

  // Re-point each ingredient to the keeper
  await Promise.all(
    ingredients.map(ing =>
      updatePage(env.NOTION_TOKEN, ing.id, { Ingredient: { relation: [{ id: keepId }] } }),
    ),
  )

  // Archive the discarded item
  await archivePage(env.NOTION_TOKEN, id)

  const keptPage = await getPage(env.NOTION_TOKEN, keepId)
  return Response.json(normalizeItem(keptPage))
}
