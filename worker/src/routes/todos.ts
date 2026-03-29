import { queryDatabase, createPage, updatePage, archivePage } from '../notion'
import { normalizeTodo, todoToProps } from '../normalize'
import type { Env } from '../types'

export async function getTodos(
  _req: Request,
  env: Env,
): Promise<Response> {
  const pages = await queryDatabase(
    env.NOTION_TOKEN,
    env.NOTION_TODOS_DB,
    undefined,
    [{ property: 'Due', direction: 'ascending' }],
  )
  return Response.json(pages.map(normalizeTodo))
}

export async function createTodo(req: Request, env: Env): Promise<Response> {
  const body = await req.json<{ name: string; status?: string | null; priority?: string | null; due?: string | null }>()
  const props = todoToProps({ status: 'Todo', ...body })
  const page = await createPage(env.NOTION_TOKEN, env.NOTION_TODOS_DB, props)
  return Response.json(normalizeTodo(page), { status: 201 })
}

export async function updateTodo(req: Request, env: Env, id: string): Promise<Response> {
  const body = await req.json<{ name?: string; status?: string | null; priority?: string | null; due?: string | null }>()
  const props = todoToProps(body)
  const page = await updatePage(env.NOTION_TOKEN, id, props)
  return Response.json(normalizeTodo(page))
}

export async function deleteTodo(
  _req: Request,
  env: Env,
  id: string,
): Promise<Response> {
  await archivePage(env.NOTION_TOKEN, id)
  return new Response(null, { status: 204 })
}
