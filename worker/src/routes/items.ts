import { queryDatabase, updatePage, createPage, archivePage, getPage } from '../notion'
import { normalizeItem, itemToProps } from '../normalize'
import type { Env } from '../types'

export async function getItems(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url)
  const shopping = url.searchParams.get('shopping')

  // Shopping list: always small, return flat array.
  if (shopping === 'true') {
    const filter = { property: 'Shopping List', checkbox: { equals: true } }
    const pages = await queryDatabase(env.NOTION_TOKEN, env.NOTION_SHOPPING_LIST_DB, filter)
    return Response.json(pages.map(normalizeItem))
  }

  // Inventory: fetch all pages.
  const pages = await queryDatabase(env.NOTION_TOKEN, env.NOTION_SHOPPING_LIST_DB)
  return Response.json(pages.map(normalizeItem))
}

export async function createItem(req: Request, env: Env): Promise<Response> {
  const body = await req.json<Record<string, unknown>>()
  const props = itemToProps(body as Parameters<typeof itemToProps>[0])
  const page = await createPage(env.NOTION_TOKEN, env.NOTION_SHOPPING_LIST_DB, props)
  return Response.json(normalizeItem(page), { status: 201 })
}

export async function updateItem(req: Request, env: Env, id: string): Promise<Response> {
  const body = await req.json<Record<string, unknown>>()
  const props = itemToProps(body as Parameters<typeof itemToProps>[0])
  const page = await updatePage(env.NOTION_TOKEN, id, props)
  return Response.json(normalizeItem(page))
}

export async function deleteItem(_req: Request, env: Env, id: string): Promise<Response> {
  await archivePage(env.NOTION_TOKEN, id)
  return new Response(null, { status: 204 })
}

export async function mergeItem(req: Request, env: Env, id: string): Promise<Response> {
  const { keepId } = await req.json<{ keepId: string }>()

  // Find all recipe-ingredients that reference the item being discarded
  const filter = { property: 'Ingredient', relation: { contains: id } }
  const ingredients = await queryDatabase(env.NOTION_TOKEN, env.NOTION_RECIPE_INGREDIENT_DB, filter)

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
