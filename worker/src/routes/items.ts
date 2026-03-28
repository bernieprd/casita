import { queryDatabase, queryDatabasePage, updatePage, createPage, archivePage } from '../notion'
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

  // Inventory: paginated — one Notion round-trip per request.
  const cursor = url.searchParams.get('cursor') ?? undefined
  const { results, nextCursor } = await queryDatabasePage(
    env.NOTION_TOKEN,
    env.NOTION_SHOPPING_LIST_DB,
    { cursor, pageSize: 100 },
  )

  return Response.json({ items: results.map(normalizeItem), nextCursor })
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
