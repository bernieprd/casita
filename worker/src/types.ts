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
  assignedTo: string[] | null
  url: string | null
  notes: string | null
  frequency: string | null
  frequencyInterval: number | null
  frequencyDays: string[] | null
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

export interface ConnectedAccount {
  provider: 'google'
  accountEmail: string
  connectedAt: number
}

export interface UserCalendar {
  id: string
  name: string
  colorHex: string
  enabled: boolean
  visibility: 'private' | 'household' | 'free-busy'
  provider: 'google'
  accountEmail: string
}

export interface SharedCalendar {
  calendarId: string
  ownerEmail: string
  accountEmail?: string
  name: string
  colorHex: string
  visibility: 'household' | 'free-busy'
  provider?: 'google'
}

// ── Env ───────────────────────────────────────────────────────────────────────

export interface Env {
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
  RATE_LIMITER: RateLimit
  ADMIN_RATE_LIMITER: RateLimit
  RESEND_API_KEY?: string
  RESEND_FROM_EMAIL?: string
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

