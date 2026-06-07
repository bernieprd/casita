import type { Env, RequestContext, Todo } from '../types'

function rowToTodo(row: Record<string, unknown>): Todo {
  return {
    id: row.id as string,
    name: row.name as string,
    status: (row.status as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    due: (row.due as string | null) ?? null,
  }
}

export async function getTodos(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const { results } = await env.DB.prepare(
    'SELECT * FROM todos WHERE household_id = ? ORDER BY due ASC NULLS LAST',
  ).bind(ctx.householdId).all<Record<string, unknown>>()

  return Response.json(results.map(rowToTodo))
}

export async function createTodo(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{
    name: string
    status?: string | null
    priority?: string | null
    due?: string | null
  }>()

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(
    `INSERT INTO todos (id, household_id, name, status, priority, due, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(id, ctx.householdId, body.name, body.status ?? 'Todo', body.priority ?? null, body.due ?? null, now, now).run()

  const row = await env.DB.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToTodo(row!), { status: 201 })
}

export async function updateTodo(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{
    name?: string
    status?: string | null
    priority?: string | null
    due?: string | null
  }>()

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [Date.now()]

  if ('name' in body)     { fields.push('name = ?');     values.push(body.name) }
  if ('status' in body)   { fields.push('status = ?');   values.push(body.status ?? null) }
  if ('priority' in body) { fields.push('priority = ?'); values.push(body.priority ?? null) }
  if ('due' in body)      { fields.push('due = ?');      values.push(body.due ?? null) }

  await env.DB.prepare(
    `UPDATE todos SET ${fields.join(', ')} WHERE id = ? AND household_id = ?`,
  ).bind(...values, id, ctx.householdId).run()

  const row = await env.DB.prepare('SELECT * FROM todos WHERE id = ?').bind(id).first<Record<string, unknown>>()
  if (!row) return Response.json({ error: 'Not found' }, { status: 404 })
  return Response.json(rowToTodo(row))
}

export async function deleteTodo(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  await env.DB.prepare(
    'DELETE FROM todos WHERE id = ? AND household_id = ?',
  ).bind(id, ctx.householdId).run()

  return new Response(null, { status: 204 })
}
