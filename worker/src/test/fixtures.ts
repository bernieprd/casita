import { env as testEnv } from 'cloudflare:test'
import type { Env, RequestContext } from '../types'

export const HH_ID  = 'hh-test'
export const USER_ID = 'user-test'
export const EMAIL   = 'test@example.com'

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS households (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    invite_code TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    todo_workflow TEXT NOT NULL DEFAULT 'simple'
  )`,
  `CREATE TABLE IF NOT EXISTS household_members (
    household_id TEXT NOT NULL,
    clerk_user_id TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    email TEXT,
    joined_at INTEGER NOT NULL,
    locale TEXT NOT NULL DEFAULT 'en',
    PRIMARY KEY (household_id, clerk_user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    on_shopping_list INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS item_supermarkets (
    item_id TEXT NOT NULL,
    supermarket TEXT NOT NULL,
    PRIMARY KEY (item_id, supermarket)
  )`,
  `CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT,
    day TEXT,
    url TEXT,
    cover_photo_url TEXT,
    share_token TEXT UNIQUE,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS recipe_ingredients (
    id TEXT PRIMARY KEY,
    household_id TEXT NOT NULL,
    recipe_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity TEXT,
    section TEXT,
    needs_shopping INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
  )`,
]

const CLEANUP_STATEMENTS = [
  'DELETE FROM recipe_ingredients',
  'DELETE FROM item_supermarkets',
  'DELETE FROM items',
  'DELETE FROM recipes',
  'DELETE FROM household_members',
  'DELETE FROM households',
]

const db = testEnv.DB

export async function applySchema() {
  for (const stmt of SCHEMA_STATEMENTS) {
    await db.prepare(stmt).run()
  }
}

export async function cleanDb() {
  for (const stmt of CLEANUP_STATEMENTS) {
    await db.prepare(stmt).run()
  }
}

export async function seedHousehold() {
  await db.prepare(
    'INSERT OR REPLACE INTO households (id, name, created_at, todo_workflow) VALUES (?, ?, ?, ?)',
  ).bind(HH_ID, 'Test House', Date.now(), 'simple').run()
}

export async function insertItem(id: string, name: string, onShoppingList = false) {
  const now = Date.now()
  await db.prepare(
    'INSERT INTO items (id, household_id, name, category, on_shopping_list, created_at, updated_at) VALUES (?, ?, ?, NULL, ?, ?, ?)',
  ).bind(id, HH_ID, name, onShoppingList ? 1 : 0, now, now).run()
}

export async function insertRecipeIngredient(
  id: string,
  recipeId: string,
  itemId: string,
  needsShopping = false,
) {
  await db.prepare(
    'INSERT INTO recipe_ingredients (id, household_id, recipe_id, item_id, quantity, section, needs_shopping, sort_order) VALUES (?, ?, ?, ?, NULL, NULL, ?, 0)',
  ).bind(id, HH_ID, recipeId, itemId, needsShopping ? 1 : 0).run()
}

export function makeEnv(): Env {
  return {
    ...(testEnv as unknown as Env),
    RATE_LIMITER:       { limit: async () => ({ success: true }) } as unknown as RateLimit,
    ADMIN_RATE_LIMITER: { limit: async () => ({ success: true }) } as unknown as RateLimit,
  }
}

export function makeCtx(overrides?: Partial<RequestContext>): RequestContext {
  return {
    clerkUserId: USER_ID,
    email: EMAIL,
    householdId: HH_ID,
    role: 'owner',
    ...overrides,
  }
}

export function makeRequest(method: string, path: string, body?: unknown): Request {
  return new Request(`http://worker${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
}
