import type { Env, RequestContext, FinancePeriod, FinanceIncome, FinanceExpense, FinanceAccount } from '../types'

function err(status: number, code: string): Response {
  return Response.json({ error: code }, { status })
}

function rowToPeriod(row: Record<string, unknown>): FinancePeriod {
  return {
    id:          row.id as string,
    householdId: row.household_id as string,
    name:        row.name as string,
    startDate:   row.start_date as string,
    endDate:     row.end_date as string,
    createdAt:   row.created_at as number,
  }
}

function rowToIncome(row: Record<string, unknown>): FinanceIncome {
  return {
    id:          row.id as string,
    householdId: row.household_id as string,
    userId:      row.user_id as string,
    periodId:    row.period_id as string,
    source:      row.source as string,
    tag:         (row.tag as string | null) ?? null,
    amountCents: row.amount_cents as number,
    createdAt:   row.created_at as number,
  }
}

function rowToExpense(row: Record<string, unknown>): FinanceExpense {
  return {
    id:          row.id as string,
    householdId: row.household_id as string,
    userId:      row.user_id as string,
    periodId:    row.period_id as string,
    source:      row.source as string,
    tag:         (row.tag as string | null) ?? null,
    type:        (row.type as 'shared' | 'personal') ?? 'personal',
    amountCents: row.amount_cents as number,
    budgetCents: row.budget_cents as number,
    createdAt:   row.created_at as number,
  }
}

function rowToAccount(row: Record<string, unknown>): FinanceAccount {
  return {
    id:          row.id as string,
    householdId: row.household_id as string,
    userId:      row.user_id as string,
    periodId:    row.period_id as string,
    name:        row.name as string,
    institution: (row.institution as string | null) ?? null,
    amountCents: row.amount_cents as number,
    date:        row.date as string,
    createdAt:   row.created_at as number,
  }
}

// ── Periods ───────────────────────────────────────────────────────────────────

export async function getFinancePeriods(
  _req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const { results: periodRows } = await env.DB.prepare(
    'SELECT * FROM finance_periods WHERE household_id = ? ORDER BY start_date ASC',
  ).bind(ctx.householdId).all<Record<string, unknown>>()

  if (periodRows.length === 0) return Response.json([])

  const periodIds = periodRows.map(r => r.id as string)
  const placeholders = periodIds.map(() => '?').join(', ')

  const [incomeRollup, expensesRollup, accountsRollup] = await Promise.all([
    env.DB.prepare(
      `SELECT period_id, SUM(amount_cents) AS total FROM finance_income
       WHERE household_id = ? AND user_id = ? AND period_id IN (${placeholders})
       GROUP BY period_id`,
    ).bind(ctx.householdId, ctx.clerkUserId, ...periodIds).all<{ period_id: string; total: number }>(),
    env.DB.prepare(
      `SELECT period_id, SUM(amount_cents) AS total FROM finance_expenses
       WHERE household_id = ? AND (type = 'shared' OR user_id = ?) AND period_id IN (${placeholders})
       GROUP BY period_id`,
    ).bind(ctx.householdId, ctx.clerkUserId, ...periodIds).all<{ period_id: string; total: number }>(),
    env.DB.prepare(
      `SELECT period_id, SUM(amount_cents) AS total FROM finance_accounts
       WHERE household_id = ? AND user_id = ? AND period_id IN (${placeholders})
       GROUP BY period_id`,
    ).bind(ctx.householdId, ctx.clerkUserId, ...periodIds).all<{ period_id: string; total: number }>(),
  ])

  const incomeMap   = new Map(incomeRollup.results.map(r => [r.period_id, r.total]))
  const expensesMap = new Map(expensesRollup.results.map(r => [r.period_id, r.total]))
  const accountsMap = new Map(accountsRollup.results.map(r => [r.period_id, r.total]))

  const periods: FinancePeriod[] = periodRows.map(row => ({
    ...rowToPeriod(row),
    incomeCents:   incomeMap.get(row.id as string) ?? 0,
    expensesCents: expensesMap.get(row.id as string) ?? 0,
    accountsCents: accountsMap.get(row.id as string) ?? 0,
  }))

  return Response.json(periods)
}

export async function createFinancePeriod(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const body = await req.json<{ name?: string; startDate?: string; endDate?: string }>()
  if (!body.name?.trim()) return err(400, 'ERR_NAME_REQUIRED')
  if (!body.startDate || !body.endDate) return err(400, 'ERR_INVALID_REQUEST')

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(
    'INSERT INTO finance_periods (id, household_id, name, start_date, end_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  ).bind(id, ctx.householdId, body.name.trim(), body.startDate, body.endDate, now).run()

  const row = await env.DB.prepare('SELECT * FROM finance_periods WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToPeriod(row!), { status: 201 })
}

export async function deleteFinancePeriod(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT id FROM finance_periods WHERE id = ? AND household_id = ?',
  ).bind(id, ctx.householdId).first()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  await env.DB.prepare('DELETE FROM finance_periods WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}

// ── Income ────────────────────────────────────────────────────────────────────

export async function getFinanceIncome(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const url = new URL(req.url)
  const periodId = url.searchParams.get('periodId')
  if (!periodId) return err(400, 'ERR_INVALID_REQUEST')

  const { results } = await env.DB.prepare(
    'SELECT * FROM finance_income WHERE household_id = ? AND period_id = ? AND user_id = ? ORDER BY created_at ASC',
  ).bind(ctx.householdId, periodId, ctx.clerkUserId).all<Record<string, unknown>>()

  return Response.json(results.map(rowToIncome))
}

export async function createFinanceIncome(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const body = await req.json<{
    periodId?: string
    source?: string
    tag?: string | null
    amountCents?: number
  }>()
  if (!body.periodId || !body.source?.trim()) return err(400, 'ERR_INVALID_REQUEST')
  if (typeof body.amountCents !== 'number' || !Number.isInteger(body.amountCents) || body.amountCents < 0)
    return err(400, 'ERR_INVALID_REQUEST')

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(
    'INSERT INTO finance_income (id, household_id, user_id, period_id, source, tag, amount_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, ctx.householdId, ctx.clerkUserId, body.periodId, body.source.trim(), body.tag ?? null, body.amountCents, now).run()

  const row = await env.DB.prepare('SELECT * FROM finance_income WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToIncome(row!), { status: 201 })
}

export async function updateFinanceIncome(
  req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT * FROM finance_income WHERE id = ? AND household_id = ? AND user_id = ?',
  ).bind(id, ctx.householdId, ctx.clerkUserId).first<Record<string, unknown>>()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  const body = await req.json<Partial<{ source: string; tag: string | null; amountCents: number }>>()
  const fields: string[] = []
  const values: unknown[] = []

  if (body.source !== undefined) { fields.push('source = ?'); values.push(body.source.trim()) }
  if ('tag' in body) { fields.push('tag = ?'); values.push(body.tag ?? null) }
  if (body.amountCents !== undefined) { fields.push('amount_cents = ?'); values.push(body.amountCents) }

  if (fields.length === 0) return err(400, 'ERR_INVALID_REQUEST')
  values.push(id)

  await env.DB.prepare(`UPDATE finance_income SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  const row = await env.DB.prepare('SELECT * FROM finance_income WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToIncome(row!))
}

export async function deleteFinanceIncome(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT id FROM finance_income WHERE id = ? AND household_id = ? AND user_id = ?',
  ).bind(id, ctx.householdId, ctx.clerkUserId).first()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  await env.DB.prepare('DELETE FROM finance_income WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function getFinanceExpenses(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const url = new URL(req.url)
  const periodId = url.searchParams.get('periodId')
  if (!periodId) return err(400, 'ERR_INVALID_REQUEST')

  const { results } = await env.DB.prepare(
    `SELECT * FROM finance_expenses
     WHERE household_id = ? AND period_id = ?
       AND (type = 'shared' OR user_id = ?)
     ORDER BY created_at ASC`,
  ).bind(ctx.householdId, periodId, ctx.clerkUserId).all<Record<string, unknown>>()

  return Response.json(results.map(rowToExpense))
}

export async function createFinanceExpense(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const body = await req.json<{
    periodId?: string
    source?: string
    tag?: string | null
    type?: string
    amountCents?: number
    budgetCents?: number
  }>()
  if (!body.periodId || !body.source?.trim()) return err(400, 'ERR_INVALID_REQUEST')
  if (body.type && !['shared', 'personal'].includes(body.type)) return err(400, 'ERR_INVALID_REQUEST')
  if (typeof body.amountCents !== 'number' || !Number.isInteger(body.amountCents) || body.amountCents < 0)
    return err(400, 'ERR_INVALID_REQUEST')

  const id = crypto.randomUUID()
  const now = Date.now()
  const type = (body.type ?? 'personal') as 'shared' | 'personal'

  await env.DB.prepare(
    'INSERT INTO finance_expenses (id, household_id, user_id, period_id, source, tag, type, amount_cents, budget_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id, ctx.householdId, ctx.clerkUserId, body.periodId,
    body.source.trim(), body.tag ?? null, type,
    body.amountCents, body.budgetCents ?? 0, now,
  ).run()

  const row = await env.DB.prepare('SELECT * FROM finance_expenses WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToExpense(row!), { status: 201 })
}

export async function updateFinanceExpense(
  req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT * FROM finance_expenses WHERE id = ? AND household_id = ? AND user_id = ?',
  ).bind(id, ctx.householdId, ctx.clerkUserId).first<Record<string, unknown>>()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  const body = await req.json<Partial<{
    source: string; tag: string | null; type: string; amountCents: number; budgetCents: number
  }>>()
  const fields: string[] = []
  const values: unknown[] = []

  if (body.source !== undefined) { fields.push('source = ?'); values.push(body.source.trim()) }
  if ('tag' in body) { fields.push('tag = ?'); values.push(body.tag ?? null) }
  if (body.type !== undefined) {
    if (!['shared', 'personal'].includes(body.type)) return err(400, 'ERR_INVALID_REQUEST')
    fields.push('type = ?'); values.push(body.type)
  }
  if (body.amountCents !== undefined) { fields.push('amount_cents = ?'); values.push(body.amountCents) }
  if (body.budgetCents !== undefined) { fields.push('budget_cents = ?'); values.push(body.budgetCents) }

  if (fields.length === 0) return err(400, 'ERR_INVALID_REQUEST')
  values.push(id)

  await env.DB.prepare(`UPDATE finance_expenses SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  const row = await env.DB.prepare('SELECT * FROM finance_expenses WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToExpense(row!))
}

export async function deleteFinanceExpense(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT id FROM finance_expenses WHERE id = ? AND household_id = ? AND user_id = ?',
  ).bind(id, ctx.householdId, ctx.clerkUserId).first()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  await env.DB.prepare('DELETE FROM finance_expenses WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}

// ── Accounts ──────────────────────────────────────────────────────────────────

export async function getFinanceAccounts(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const url = new URL(req.url)
  const periodId = url.searchParams.get('periodId')
  if (!periodId) return err(400, 'ERR_INVALID_REQUEST')

  const { results } = await env.DB.prepare(
    'SELECT * FROM finance_accounts WHERE household_id = ? AND period_id = ? AND user_id = ? ORDER BY created_at ASC',
  ).bind(ctx.householdId, periodId, ctx.clerkUserId).all<Record<string, unknown>>()

  return Response.json(results.map(rowToAccount))
}

export async function createFinanceAccount(
  req: Request,
  env: Env,
  ctx: RequestContext,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const body = await req.json<{
    periodId?: string
    name?: string
    institution?: string | null
    amountCents?: number
    date?: string
  }>()
  if (!body.periodId || !body.name?.trim() || !body.date) return err(400, 'ERR_INVALID_REQUEST')
  if (typeof body.amountCents !== 'number' || !Number.isInteger(body.amountCents))
    return err(400, 'ERR_INVALID_REQUEST')

  const id = crypto.randomUUID()
  const now = Date.now()

  await env.DB.prepare(
    'INSERT INTO finance_accounts (id, household_id, user_id, period_id, name, institution, amount_cents, date, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
  ).bind(
    id, ctx.householdId, ctx.clerkUserId, body.periodId,
    body.name.trim(), body.institution ?? null, body.amountCents, body.date, now,
  ).run()

  const row = await env.DB.prepare('SELECT * FROM finance_accounts WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToAccount(row!), { status: 201 })
}

export async function updateFinanceAccount(
  req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT * FROM finance_accounts WHERE id = ? AND household_id = ? AND user_id = ?',
  ).bind(id, ctx.householdId, ctx.clerkUserId).first<Record<string, unknown>>()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  const body = await req.json<Partial<{
    name: string; institution: string | null; amountCents: number; date: string
  }>>()
  const fields: string[] = []
  const values: unknown[] = []

  if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name.trim()) }
  if ('institution' in body) { fields.push('institution = ?'); values.push(body.institution ?? null) }
  if (body.amountCents !== undefined) { fields.push('amount_cents = ?'); values.push(body.amountCents) }
  if (body.date !== undefined) { fields.push('date = ?'); values.push(body.date) }

  if (fields.length === 0) return err(400, 'ERR_INVALID_REQUEST')
  values.push(id)

  await env.DB.prepare(`UPDATE finance_accounts SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run()
  const row = await env.DB.prepare('SELECT * FROM finance_accounts WHERE id = ?').bind(id).first<Record<string, unknown>>()
  return Response.json(rowToAccount(row!))
}

export async function deleteFinanceAccount(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return err(403, 'ERR_NO_HOUSEHOLD')

  const existing = await env.DB.prepare(
    'SELECT id FROM finance_accounts WHERE id = ? AND household_id = ? AND user_id = ?',
  ).bind(id, ctx.householdId, ctx.clerkUserId).first()
  if (!existing) return err(404, 'ERR_NOT_FOUND')

  await env.DB.prepare('DELETE FROM finance_accounts WHERE id = ?').bind(id).run()
  return new Response(null, { status: 204 })
}
