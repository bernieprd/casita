import { queryDatabase, updatePage, createPage, archivePage } from '../notion'
import { normalizeItem, itemToProps } from '../normalize'
import type { Env } from '../types'

export async function getItems(req: Request, env: Env): Promise<Response> {
  const shopping = new URL(req.url).searchParams.get('shopping')
  const filter =
    shopping === 'true'
      ? { property: 'Shopping List', checkbox: { equals: true } }
      : undefined

  const pages = await queryDatabase(env.NOTION_TOKEN, env.NOTION_SHOPPING_LIST_DB, filter)
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
