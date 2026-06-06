import { queryDatabase, createPage, updatePage, archivePage } from '../notion'
import { normalizeTodo, todoToProps } from '../normalize'
import type { Env, RequestContext, HouseholdNotionConfig } from '../types'

export async function getTodos(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?'
  ).bind(ctx.householdId).first<HouseholdNotionConfig>()
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const pages = await queryDatabase(
    env.NOTION_TOKEN,
    config.todos_db,
    undefined,
    [{ property: 'Due', direction: 'ascending' }],
  )
  return Response.json(pages.map(normalizeTodo))
}

export async function createTodo(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?'
  ).bind(ctx.householdId).first<HouseholdNotionConfig>()
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const body = await req.json<{ name: string; status?: string | null; priority?: string | null; due?: string | null }>()
  const props = todoToProps({ status: 'Todo', ...body })
  const page = await createPage(env.NOTION_TOKEN, config.todos_db, props)
  return Response.json(normalizeTodo(page), { status: 201 })
}

export async function updateTodo(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{ name?: string; status?: string | null; priority?: string | null; due?: string | null }>()
  const props = todoToProps(body)
  const page = await updatePage(env.NOTION_TOKEN, id, props)
  return Response.json(normalizeTodo(page))
}

export async function deleteTodo(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  await archivePage(env.NOTION_TOKEN, id)
  return new Response(null, { status: 204 })
}
