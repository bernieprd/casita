import type { Env, RequestContext } from '../types'

function textToBlock(line: string): { type: string; text: string } {
  if (line === '---') return { type: 'divider', text: '' }
  if (line.startsWith('# ') && !line.startsWith('## ')) return { type: 'heading_1', text: line.slice(2) }
  if (line.startsWith('## ') && !line.startsWith('### ')) return { type: 'heading_2', text: line.slice(3) }
  if (line.startsWith('### ')) return { type: 'heading_3', text: line.slice(4) }
  if (line.startsWith('- ') || line.startsWith('* ')) return { type: 'bulleted_list_item', text: line.slice(2) }
  return { type: 'paragraph', text: line }
}

type ImportItem = { name: string; category?: string | null; onShoppingList?: boolean }
type ImportTodo = { name: string; priority?: string | null; due?: string | null }
type ImportIngredient = { name: string; quantity?: string | null }
type ImportRecipe = {
  name: string
  type?: string | null
  url?: string | null
  instructions?: string | null
  ingredients?: ImportIngredient[]
}

export async function importData(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  // Body size guard — read the actual bytes so chunked/no Content-Length requests
  // are also covered. 100 000 bytes ≈ 100 KB, plenty for any valid import payload.
  const bodyText = await req.text()
  if (bodyText.length > 100_000) {
    return Response.json({ error: 'Payload too large (max 100 000 bytes)' }, { status: 400 })
  }
  let body: { items?: ImportItem[]; recipes?: ImportRecipe[]; todos?: ImportTodo[] }
  try {
    body = JSON.parse(bodyText) as { items?: ImportItem[]; recipes?: ImportRecipe[]; todos?: ImportTodo[] }
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { items = [], recipes = [], todos = [] } = body

  // Array length validation
  if (items.length > 500) return Response.json({ error: 'items array exceeds 500 entries' }, { status: 400 })
  if (recipes.length > 100) return Response.json({ error: 'recipes array exceeds 100 entries' }, { status: 400 })
  if (todos.length > 500) return Response.json({ error: 'todos array exceeds 500 entries' }, { status: 400 })

  const householdId = ctx.householdId
  const now = Date.now()

  let importedItems = 0
  let skippedItems = 0
  let importedTodos = 0
  let importedRecipes = 0
  let failedRecipes = 0

  // ── Items ──────────────────────────────────────────────────────────────────

  // itemIdByName is declared here (outside the items block) so the recipe
  // ingredient loop below can reuse it without issuing N+1 SELECT queries.
  const itemIdByName = new Map<string, string>()

  {
    const { results } = await env.DB.prepare(
      'SELECT id, name FROM items WHERE household_id = ?'
    ).bind(householdId).all<{ id: string; name: string }>()

    // existingNames — used for deduplication in the items import section (unchanged)
    const existingNames = new Set(results.map(r => r.name.toLowerCase()))

    // Populate itemIdByName with all pre-existing items
    for (const r of results) {
      itemIdByName.set(r.name.toLowerCase(), r.id)
    }

    const toInsert: (ImportItem & { _id: string })[] = []
    for (const item of items) {
      if (typeof item.name !== 'string' || item.name.trim() === '') {
        skippedItems++
        continue
      }
      if (existingNames.has(item.name.trim().toLowerCase())) {
        skippedItems++
        continue
      }
      const _id = crypto.randomUUID()
      existingNames.add(item.name.trim().toLowerCase())
      itemIdByName.set(item.name.trim().toLowerCase(), _id)
      toInsert.push({ ...item, _id })
    }

    // Batch-insert in chunks of 100
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100)
      const stmts = chunk.map(item =>
        env.DB.prepare(
          'INSERT INTO items (id, household_id, name, category, on_shopping_list, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          item._id,
          householdId,
          item.name.trim(),
          item.category ?? null,
          item.onShoppingList ? 1 : 0,
          now,
          now,
        )
      )
      await env.DB.batch(stmts)
      importedItems += chunk.length
    }
  }

  // ── Todos ──────────────────────────────────────────────────────────────────

  {
    const toInsert: ImportTodo[] = []
    for (const todo of todos) {
      if (typeof todo.name !== 'string' || todo.name.trim() === '') continue
      toInsert.push(todo)
    }

    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100)
      const stmts = chunk.map(todo => {
        const priority = ['High', 'Medium', 'Low'].includes(todo.priority ?? '')
          ? (todo.priority as string)
          : null
        const due = typeof todo.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todo.due)
          ? todo.due
          : null
        return env.DB.prepare(
          'INSERT INTO todos (id, household_id, name, status, priority, due, created_at, updated_at) VALUES (?, ?, ?, \'Todo\', ?, ?, ?, ?)'
        ).bind(
          crypto.randomUUID(),
          householdId,
          todo.name.trim(),
          priority,
          due,
          now,
          now,
        )
      })
      await env.DB.batch(stmts)
      importedTodos += chunk.length
    }
  }

  // ── Recipes ────────────────────────────────────────────────────────────────

  for (const recipe of recipes) {
    if (typeof recipe.name !== 'string' || recipe.name.trim() === '') continue

    try {
      const recipeId = crypto.randomUUID()

      // Parse instructions into blocks
      const blocks = recipe.instructions
        ? recipe.instructions
            .split('\n')
            .filter(line => line.trim() !== '')
            .map(textToBlock)
        : []

      // Build batch statements
      const stmts: D1PreparedStatement[] = []

      // Recipe INSERT
      stmts.push(
        env.DB.prepare(
          'INSERT INTO recipes (id, household_id, name, type, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          recipeId,
          householdId,
          recipe.name.trim(),
          recipe.type ?? null,
          recipe.url ?? null,
          now,
          now,
        )
      )

      // Block INSERTs
      blocks.forEach((block, idx) => {
        stmts.push(
          env.DB.prepare(
            'INSERT INTO recipe_blocks (id, recipe_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?)'
          ).bind(crypto.randomUUID(), recipeId, block.type, block.text, idx)
        )
      })

      // Ingredients
      const ingredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : []
      for (const ingredient of ingredients) {
        if (typeof ingredient.name !== 'string' || ingredient.name.trim() === '') continue

        const ingredientName = ingredient.name.trim()

        // Map lookup — avoids N+1 queries. itemIdByName is populated from the
        // initial SELECT (all pre-existing items) plus every item inserted during
        // the items import block above, and any ingredient-only items added below.
        const lookupKey = ingredientName.toLowerCase()
        let itemId: string
        const mappedId = itemIdByName.get(lookupKey)
        if (mappedId !== undefined) {
          itemId = mappedId
        } else {
          itemId = crypto.randomUUID()
          itemIdByName.set(lookupKey, itemId)
          stmts.push(
            env.DB.prepare(
              'INSERT INTO items (id, household_id, name, category, on_shopping_list, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
            ).bind(itemId, householdId, ingredientName, null, 0, now, now)
          )
        }

        stmts.push(
          env.DB.prepare(
            'INSERT INTO recipe_ingredients (id, household_id, recipe_id, item_id, quantity, section, needs_shopping, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
          ).bind(
            crypto.randomUUID(),
            householdId,
            recipeId,
            itemId,
            ingredient.quantity ?? null,
            null,
            0,
            0,
          )
        )
      }

      // Execute — split into two batches if > 80 statements
      if (stmts.length > 80) {
        const mid = Math.ceil(stmts.length / 2)
        await env.DB.batch(stmts.slice(0, mid))
        await env.DB.batch(stmts.slice(mid))
      } else {
        await env.DB.batch(stmts)
      }

      importedRecipes++
    } catch {
      failedRecipes++
    }
  }

  return Response.json({
    imported: { items: importedItems, recipes: importedRecipes, todos: importedTodos },
    skipped: { items: skippedItems },
    failed: { recipes: failedRecipes },
  })
}
