// ── Domain types ─────────────────────────────────────────────────────────────

export interface Item {
  id: string
  name: string
  category: string | null
  supermarkets: string[]
  onShoppingList: boolean
}

export interface Recipe {
  id: string
  name: string
  type: string | null
  day: string | null
  url: string | null
  coverPhotoUrl: string | null
  createdAt: number
  updatedAt: number
}

export interface RecipeWithBlocks extends Recipe {
  blocks: Block[]
}

export interface Block {
  id: string
  type: string
  text: string
}

export interface RecipeIngredient {
  id: string
  recipeId: string
  itemId: string
  itemName: string
  quantity: string | null
  section: string | null
  needsShopping: boolean
}

export interface Todo {
  id: string
  name: string
  status: string | null
  priority: string | null
  due: string | null
  categoryId: string | null
  assignedTo: string | null
  url: string | null
  notes: string | null
  frequency: string | null
  sortOrder: number
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  color: string | null
  source?: 'user' | 'household-shared' | 'free-busy'
}

export interface GoogleTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface UserCalendar {
  id: string
  name: string
  colorHex: string
  enabled: boolean
  visibility: 'private' | 'household' | 'free-busy'
}

export interface SharedCalendar {
  calendarId: string
  ownerEmail: string
  name: string
  colorHex: string
  visibility: 'household' | 'free-busy'
}

// ── Notion raw types ──────────────────────────────────────────────────────────

export interface NotionPage {
  id: string
  object: 'page'
  archived: boolean
  cover: NotionCover | null
  properties: Record<string, NotionProperty>
}

export type NotionProperty =
  | { type: 'title'; title: NotionRichText[] }
  | { type: 'rich_text'; rich_text: NotionRichText[] }
  | { type: 'select'; select: NotionSelectOption | null }
  | { type: 'multi_select'; multi_select: NotionSelectOption[] }
  | { type: 'checkbox'; checkbox: boolean }
  | { type: 'relation'; relation: Array<{ id: string }> }
  | { type: 'number'; number: number | null }
  | { type: 'files'; files: NotionFileRef[] }
  | { type: 'url'; url: string | null }
  | { type: 'date'; date: { start: string; end: string | null } | null }

export interface NotionRichText {
  plain_text: string
}

export interface NotionSelectOption {
  name: string
}

export type NotionCover =
  | { type: 'external'; external: { url: string } }
  | { type: 'file'; file: { url: string } }

export type NotionFileRef =
  | { type: 'external'; name: string; external: { url: string } }
  | { type: 'file'; name: string; file: { url: string; expiry_time: string } }

export interface NotionQueryResponse {
  results: NotionPage[]
  has_more: boolean
  next_cursor: string | null
}

export interface NotionBlock {
  id: string
  type: string
  [key: string]: unknown
}

export interface NotionBlocksResponse {
  results: NotionBlock[]
  has_more: boolean
  next_cursor: string | null
}

// ── Env ───────────────────────────────────────────────────────────────────────

export interface Env {
  NOTION_TOKEN: string
  NOTION_SHOPPING_LIST_DB: string
  NOTION_RECIPES_DB: string
  NOTION_RECIPE_INGREDIENT_DB: string
  NOTION_TODOS_DB: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_REDIRECT_URI?: string
  // Set in wrangler.toml [vars] or .dev.vars to override the default.
  ALLOWED_ORIGIN?: string
  APP_BASE_URL?: string
  RECIPE_PHOTOS: R2Bucket
  AUTH_KV: KVNamespace
  ALLOWED_EMAILS: string
  DB: D1Database
  CLERK_PUBLISHABLE_KEY: string
  CLERK_SECRET_KEY: string
  CLERK_JWT_KEY?: string // PEM public key — enables local JWT verification (no network call)
  ADMIN_MIGRATE_SECRET?: string
}

export const DEFAULT_APP_URL = 'https://dashboard.mycasita.app'
export function getAppBaseUrl(env: Env): string {
  return env.APP_BASE_URL ?? DEFAULT_APP_URL
}

export interface ConceptItem {
  id: string
  name: string
  sort_order: number
  usage_count: number
}

// ── Auth / household context ──────────────────────────────────────────────────

export interface RequestContext {
  clerkUserId: string
  email: string
  householdId: string | null
  role: 'owner' | 'member' | null
}

export interface HouseholdNotionConfig {
  household_id: string
  shopping_list_db: string
  recipes_db: string
  recipe_ingredient_db: string
  todos_db: string
}
