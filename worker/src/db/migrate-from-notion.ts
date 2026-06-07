import { queryDatabase, getBlockChildren } from '../notion'
import { normalizeItem, normalizeRecipe, normalizeBlock, normalizeRecipeIngredient, normalizeTodo } from '../normalize'
import type { Env, HouseholdNotionConfig } from '../types'

const NOW = Date.now()

// Each exported function migrates exactly one resource type for one household
// so callers can stay well under the 50-subrequest Workers limit.

export async function runMigrationItems(env: Env, householdId: string): Promise<string[]> {
  const log: string[] = []
  const config = await getConfig(env, householdId, log)
  if (!config) return log
  await migrateItems(env, householdId, config, log)
  return log
}

export async function runMigrationRecipes(env: Env, householdId: string): Promise<string[]> {
  const log: string[] = []
  const config = await getConfig(env, householdId, log)
  if (!config) return log
  await migrateRecipes(env, householdId, config, log)
  return log
}

export async function runMigrationIngredients(env: Env, householdId: string): Promise<string[]> {
  const log: string[] = []
  const config = await getConfig(env, householdId, log)
  if (!config) return log
  await migrateIngredients(env, householdId, config, log)
  return log
}

export async function runMigrationTodos(env: Env, householdId: string): Promise<string[]> {
  const log: string[] = []
  const config = await getConfig(env, householdId, log)
  if (!config) return log
  await migrateTodos(env, householdId, config, log)
  return log
}

export async function runMigrationTokens(env: Env): Promise<string[]> {
  const log: string[] = []
  await migrateShareTokens(env, log)
  return log
}

async function getConfig(env: Env, householdId: string, log: string[]): Promise<HouseholdNotionConfig | null> {
  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?',
  ).bind(householdId).first<HouseholdNotionConfig>()
  if (!config) {
    log.push(`household ${householdId}: no Notion config, skipping`)
    return null
  }
  return config
}

async function migrateItems(
  env: Env,
  householdId: string,
  config: HouseholdNotionConfig,
  log: string[],
) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.shopping_list_db)
  for (const page of pages) {
    const item = normalizeItem(page)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO items (id, household_id, name, category, on_shopping_list, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(item.id, householdId, item.name, item.category, item.onShoppingList ? 1 : 0, NOW, NOW).run()

    for (const s of item.supermarkets) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO item_supermarkets (item_id, supermarket) VALUES (?, ?)',
      ).bind(item.id, s).run()
    }
    for (const t of item.tags) {
      await env.DB.prepare(
        'INSERT OR IGNORE INTO item_tags (item_id, tag) VALUES (?, ?)',
      ).bind(item.id, t).run()
    }
  }
  log.push(`  items: ${pages.length}`)
}

async function migrateRecipes(
  env: Env,
  householdId: string,
  config: HouseholdNotionConfig,
  log: string[],
) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.recipes_db)
  for (const page of pages) {
    const recipe = normalizeRecipe(page)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO recipes (id, household_id, name, type, day, url, cover_photo_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(recipe.id, householdId, recipe.name, recipe.type, recipe.day, recipe.url, recipe.coverPhotoUrl, NOW, NOW).run()

    const blocks = await getBlockChildren(env.NOTION_TOKEN, recipe.id)
    for (let i = 0; i < blocks.length; i++) {
      const b = normalizeBlock(blocks[i])
      await env.DB.prepare(
        'INSERT OR IGNORE INTO recipe_blocks (id, recipe_id, type, text, sort_order) VALUES (?, ?, ?, ?, ?)',
      ).bind(b.id, recipe.id, b.type, b.text, i).run()
    }
  }
  log.push(`  recipes: ${pages.length}`)
}

async function migrateIngredients(
  env: Env,
  householdId: string,
  config: HouseholdNotionConfig,
  log: string[],
) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.recipe_ingredient_db)
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i]
    // Use D1 to look up item name — items already migrated, avoids one Notion getPage per ingredient
    const itemId =
      page.properties['Ingredient']?.type === 'relation'
        ? (page.properties['Ingredient'].relation[0]?.id ?? '')
        : ''
    const itemRow = itemId
      ? await env.DB.prepare('SELECT name FROM items WHERE id = ?').bind(itemId).first<{ name: string }>()
      : null
    const itemName = itemRow?.name ?? ''
    const ing = normalizeRecipeIngredient(page, itemName)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO recipe_ingredients (id, household_id, recipe_id, item_id, quantity, section, needs_shopping, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(ing.id, householdId, ing.recipeId, ing.itemId, ing.quantity, ing.section, ing.needsShopping ? 1 : 0, i).run()
  }
  log.push(`  recipe_ingredients: ${pages.length}`)
}

async function migrateTodos(
  env: Env,
  householdId: string,
  config: HouseholdNotionConfig,
  log: string[],
) {
  const pages = await queryDatabase(env.NOTION_TOKEN, config.todos_db)
  for (const page of pages) {
    const todo = normalizeTodo(page)
    await env.DB.prepare(
      `INSERT OR IGNORE INTO todos (id, household_id, name, status, priority, due, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(todo.id, householdId, todo.name, todo.status, todo.priority, todo.due, NOW, NOW).run()
  }
  log.push(`  todos: ${pages.length}`)
}

async function migrateShareTokens(env: Env, log: string[]) {
  const list = await env.AUTH_KV.list({ prefix: 'share-recipe:' })
  for (const key of list.keys) {
    const recipeId = key.name.replace('share-recipe:', '')
    const token = await env.AUTH_KV.get(key.name)
    if (!token) continue
    await env.DB.prepare(
      'UPDATE recipes SET share_token = ? WHERE id = ?',
    ).bind(token, recipeId).run()
  }
  log.push(`share tokens migrated: ${list.keys.length}`)
}
