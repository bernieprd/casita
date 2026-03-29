// ── Domain types ─────────────────────────────────────────────────────────────

export interface Item {
  id: string
  name: string
  category: string | null
  supermarkets: string[]
  tags: string[]
  onShoppingList: boolean
}

export interface Recipe {
  id: string
  name: string
  type: string | null
  day: string | null
  url: string | null
  coverPhotoUrl: string | null
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
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  color: string | null
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
  // Set in wrangler.toml [vars] or .dev.vars to override the default.
  // Defaults to the GitHub Pages origin in production.
  ALLOWED_ORIGIN?: string
}
