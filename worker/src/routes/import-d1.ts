import type { Env, RequestContext } from '../types'

function textToBlock(line: string): { type: string; text: string } {
  if (line === '---') return { type: 'divider', text: '' }
  if (line.startsWith('# ') && !line.startsWith('## ')) return { type: 'heading_1', text: line.slice(2) }
  if (line.startsWith('## ') && !line.startsWith('### ')) return { type: 'heading_2', text: line.slice(3) }
  if (line.startsWith('### ')) return { type: 'heading_3', text: line.slice(4) }
  if (line.startsWith('- ') || line.startsWith('* ')) return { type: 'bulleted_list_item', text: line.slice(2) }
  return { type: 'paragraph', text: line }
}

type ImportItem = { name: string; category?: string | null; onShoppingList?: boolean; supermarkets?: string[] }
type ImportTodo = {
  name: string; priority?: string | null; due?: string | null
  status?: string | null; notes?: string | null; url?: string | null
  frequency?: string | null; frequency_interval?: number | null
  frequency_days?: string | null; category?: string | null
}
type ImportIngredient = { name: string; quantity?: string | null }
type ImportRecipe = {
  name: string
  type?: string | null
  url?: string | null
  instructions?: string | null
  ingredients?: ImportIngredient[]
}

export async function importData(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'ERR_NO_HOUSEHOLD' }, { status: 403 })

  // Body size guard — read the actual bytes so chunked/no Content-Length requests
  // are also covered. 100 000 bytes ≈ 100 KB, plenty for any valid import payload.
  const bodyText = await req.text()
  if (bodyText.length > 200_000) {
    return Response.json({ error: 'ERR_PAYLOAD_TOO_LARGE' }, { status: 400 })
  }
  let body: { version?: number; items?: ImportItem[]; recipes?: ImportRecipe[]; todos?: ImportTodo[] }
  try {
    body = JSON.parse(bodyText) as { version?: number; items?: ImportItem[]; recipes?: ImportRecipe[]; todos?: ImportTodo[] }
  } catch {
    return Response.json({ error: 'ERR_INVALID_JSON' }, { status: 400 })
  }

  const { items = [], recipes = [], todos = [] } = body

  // Array length validation
  if (items.length > 500) return Response.json({ error: 'ERR_IMPORT_TOO_MANY_ITEMS' }, { status: 400 })
  if (recipes.length > 100) return Response.json({ error: 'ERR_IMPORT_TOO_MANY_RECIPES' }, { status: 400 })
  if (todos.length > 500) return Response.json({ error: 'ERR_IMPORT_TOO_MANY_TODOS' }, { status: 400 })

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

    // Insert supermarket associations for newly created items
    const smRows: Array<{ itemId: string; supermarket: string }> = []
    for (const item of toInsert) {
      if (!Array.isArray(item.supermarkets)) continue
      for (const s of item.supermarkets) {
        if (typeof s === 'string' && s.trim() !== '')
          smRows.push({ itemId: item._id, supermarket: s.trim() })
      }
    }
    for (let i = 0; i < smRows.length; i += 100) {
      const chunk = smRows.slice(i, i + 100)
      await env.DB.batch(
        chunk.map(r =>
          env.DB.prepare('INSERT OR IGNORE INTO item_supermarkets (item_id, supermarket) VALUES (?, ?)')
            .bind(r.itemId, r.supermarket)
        )
      )
    }
  }

  // ── Todos ──────────────────────────────────────────────────────────────────

  {
    const toInsert: ImportTodo[] = []
    for (const todo of todos) {
      if (typeof todo.name !== 'string' || todo.name.trim() === '') continue
      toInsert.push(todo)
    }

    // Resolve todo categories: fetch existing, create any new ones
    const categoryIdByName = new Map<string, string>()
    {
      const { results: existingCats } = await env.DB
        .prepare('SELECT id, name FROM household_todo_categories WHERE household_id = ?')
        .bind(householdId)
        .all<{ id: string; name: string }>()
      for (const c of existingCats) {
        categoryIdByName.set(c.name.toLowerCase(), c.id)
      }

      const namesToCreate = [
        ...new Set(
          toInsert
            .map(t => (typeof t.category === 'string' ? t.category.trim() : ''))
            .filter(n => n !== '' && !categoryIdByName.has(n.toLowerCase()))
        ),
      ]
      if (namesToCreate.length > 0) {
        const { results: maxRow } = await env.DB
          .prepare('SELECT COALESCE(MAX(sort_order), -1) as max_sort FROM household_todo_categories WHERE household_id = ?')
          .bind(householdId)
          .all<{ max_sort: number }>()
        const startSortOrder = (maxRow[0]?.max_sort ?? -1) + 1

        const createStmts = namesToCreate.map((catName, idx) => {
          const newId = crypto.randomUUID()
          categoryIdByName.set(catName.toLowerCase(), newId)
          return env.DB
            .prepare('INSERT OR IGNORE INTO household_todo_categories (id, household_id, name, sort_order) VALUES (?, ?, ?, ?)')
            .bind(newId, householdId, catName, startSortOrder + idx)
        })
        await env.DB.batch(createStmts)
      }
    }

    const validStatuses = ['Todo', 'In Progress', 'Done']
    for (let i = 0; i < toInsert.length; i += 100) {
      const chunk = toInsert.slice(i, i + 100)
      const stmts = chunk.map(todo => {
        const priority = ['High', 'Medium', 'Low'].includes(todo.priority ?? '')
          ? (todo.priority as string)
          : null
        const due = typeof todo.due === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(todo.due)
          ? todo.due
          : null
        const status = typeof todo.status === 'string' && validStatuses.includes(todo.status)
          ? todo.status
          : 'Todo'
        const notes = typeof todo.notes === 'string' ? todo.notes : null
        const url = typeof todo.url === 'string' ? todo.url : null
        const frequency = typeof todo.frequency === 'string' ? todo.frequency : null
        const frequencyInterval = typeof todo.frequency_interval === 'number' && todo.frequency_interval >= 1
          ? todo.frequency_interval
          : 1
        const frequencyDays = typeof todo.frequency_days === 'string' ? todo.frequency_days : null
        const catKey = typeof todo.category === 'string' ? todo.category.trim().toLowerCase() : ''
        const categoryId = catKey !== '' ? (categoryIdByName.get(catKey) ?? null) : null

        return env.DB.prepare(
          'INSERT INTO todos (id, household_id, name, status, priority, due, notes, url, frequency, frequency_interval, frequency_days, category_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(
          crypto.randomUUID(),
          householdId,
          todo.name.trim(),
          status,
          priority,
          due,
          notes,
          url,
          frequency,
          frequencyInterval,
          frequencyDays,
          categoryId,
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
