import type { Env, RequestContext, Todo } from '../types'

const VALID_FREQUENCIES = new Set(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'])

const VALID_DAYS = new Set(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])

function rowToTodo(row: Record<string, unknown>): Todo {
  return {
    id: row.id as string,
    name: row.name as string,
    status: (row.status as string | null) ?? null,
    priority: (row.priority as string | null) ?? null,
    due: (row.due as string | null) ?? null,
    categoryId: (row.category_id as string | null) ?? null,
    assignedTo: row.assigned_to
      ? (() => {
          try {
            return JSON.parse(row.assigned_to as string) as string[]
          } catch {
            return [row.assigned_to as string]
          }
        })()
      : null,
    url:         (row.url          as string | null) ?? null,
    notes:       (row.notes        as string | null) ?? null,
    frequency:   (row.frequency    as string | null) ?? null,
    frequencyInterval: (row.frequency_interval as number | null) ?? null,
    frequencyDays: row.frequency_days
      ? (() => {
          try {
            return JSON.parse(row.frequency_days as string) as string[]
          } catch {
            return null
          }
        })()
      : null,
    sortOrder:   (row.sort_order   as number) ?? 0,
  }
}

export async function getTodos(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const { results } = await env.DB.prepare(
    'SELECT * FROM todos WHERE household_id = ? ORDER BY sort_order ASC, created_at DESC',
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
    categoryId?: string | null
    assignedTo?: string[] | null
    url?: string | null
    notes?: string | null
    frequency?: string | null
    frequencyInterval?: number | null
    frequencyDays?: string[] | null
  }>()

  if (body.frequency != null && !VALID_FREQUENCIES.has(body.frequency)) {
    return Response.json({ error: `Invalid frequency. Must be one of: ${[...VALID_FREQUENCIES].join(', ')}` }, { status: 400 })
  }

  if (body.frequencyInterval != null) {
    const interval = body.frequencyInterval
    if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
      return Response.json({ error: 'frequencyInterval must be an integer between 1 and 12' }, { status: 400 })
    }
  }

  if (body.frequencyDays != null) {
    if (!Array.isArray(body.frequencyDays) || body.frequencyDays.some(d => !VALID_DAYS.has(d))) {
      return Response.json({ error: `frequencyDays must be an array of valid day names: ${[...VALID_DAYS].join(', ')}` }, { status: 400 })
    }
  }

  const id = crypto.randomUUID()
  const now = Date.now()

  const assignedToStr = body.assignedTo != null ? JSON.stringify(body.assignedTo) : null
  const frequencyDaysStr = body.frequencyDays != null ? JSON.stringify(body.frequencyDays) : null

  await env.DB.prepare(
    `INSERT INTO todos (id, household_id, name, status, priority, due, category_id, assigned_to, url, notes, frequency, frequency_interval, frequency_days, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    id, ctx.householdId, body.name,
    body.status ?? 'Todo',
    body.priority ?? null,
    body.due ?? null,
    body.categoryId ?? null,
    assignedToStr,
    body.url ?? null,
    body.notes ?? null,
    body.frequency ?? null,
    body.frequencyInterval ?? 1,
    frequencyDaysStr,
    0, now, now,
  ).run()

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
    categoryId?: string | null
    assignedTo?: string[] | null
    url?: string | null
    notes?: string | null
    frequency?: string | null
    frequencyInterval?: number | null
    frequencyDays?: string[] | null
    sortOrder?: number
  }>()

  if (body.frequency != null && !VALID_FREQUENCIES.has(body.frequency)) {
    return Response.json({ error: `Invalid frequency. Must be one of: ${[...VALID_FREQUENCIES].join(', ')}` }, { status: 400 })
  }

  if (body.frequencyInterval != null) {
    const interval = body.frequencyInterval
    if (!Number.isInteger(interval) || interval < 1 || interval > 12) {
      return Response.json({ error: 'frequencyInterval must be an integer between 1 and 12' }, { status: 400 })
    }
  }

  if (body.frequencyDays != null) {
    if (!Array.isArray(body.frequencyDays) || body.frequencyDays.some(d => !VALID_DAYS.has(d))) {
      return Response.json({ error: `frequencyDays must be an array of valid day names: ${[...VALID_DAYS].join(', ')}` }, { status: 400 })
    }
  }

  const fields: string[] = ['updated_at = ?']
  const values: unknown[] = [Date.now()]

  if ('name' in body)              { fields.push('name = ?');               values.push(body.name) }
  if ('status' in body)            { fields.push('status = ?');             values.push(body.status ?? null) }
  if ('priority' in body)          { fields.push('priority = ?');           values.push(body.priority ?? null) }
  if ('due' in body)               { fields.push('due = ?');                values.push(body.due ?? null) }
  if ('categoryId' in body)        { fields.push('category_id = ?');        values.push(body.categoryId ?? null) }
  if ('assignedTo' in body)        { fields.push('assigned_to = ?');        values.push(body.assignedTo != null ? JSON.stringify(body.assignedTo) : null) }
  if ('url' in body)               { fields.push('url = ?');                values.push(body.url ?? null) }
  if ('notes' in body)             { fields.push('notes = ?');              values.push(body.notes ?? null) }
  if ('frequency' in body)         { fields.push('frequency = ?');          values.push(body.frequency ?? null) }
  if ('frequencyInterval' in body) { fields.push('frequency_interval = ?'); values.push(body.frequencyInterval ?? null) }
  if ('frequencyDays' in body)     { fields.push('frequency_days = ?');     values.push(body.frequencyDays != null ? JSON.stringify(body.frequencyDays) : null) }
  if ('sortOrder' in body)         { fields.push('sort_order = ?');         values.push(body.sortOrder ?? 0) }

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

export async function reorderTodos(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const { ids } = await req.json<{ ids: string[] }>()
  if (!Array.isArray(ids) || ids.length === 0) {
    return Response.json({ error: 'Invalid ids' }, { status: 400 })
  }
  const now = Date.now()
  const stmts = ids.map((id, i) =>
    env.DB
      .prepare('UPDATE todos SET sort_order = ?, updated_at = ? WHERE id = ? AND household_id = ?')
      .bind(i, now, id, ctx.householdId)
  )
  await env.DB.batch(stmts)
  return Response.json({ ok: true })
}
