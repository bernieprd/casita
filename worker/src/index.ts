import { getItems, createItem, updateItem, deleteItem } from './routes/items'
import { getRecipes, getRecipe, getRecipeIngredients } from './routes/recipes'
import { updateRecipeIngredient } from './routes/recipe-ingredients'
import { NotionError } from './notion'
import type { Env } from './types'

const DEFAULT_ORIGIN = 'https://bernieprd.github.io'
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function resolveOrigin(req: Request, allowedOrigin: string): string {
  const reqOrigin = req.headers.get('Origin') ?? ''
  return DEV_ORIGINS.includes(reqOrigin) ? reqOrigin : allowedOrigin
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
  }
}

function withCors(res: Response, origin: string): Response {
  const next = new Response(res.body, res)
  for (const [k, v] of Object.entries(corsHeaders(origin))) next.headers.set(k, v)
  return next
}

function err(status: number, message: string, origin: string): Response {
  return withCors(Response.json({ error: message }, { status }), origin)
}

// ── Route table ───────────────────────────────────────────────────────────────
//
// Each entry: [method, URLPattern, handler(req, env, ...groups)]
//
// URLPattern groups capture named path segments. The handler receives them
// positionally in the order they appear in the pattern's pathname groups.

type Handler = (req: Request, env: Env, ...ids: string[]) => Promise<Response>

const routes: Array<[string, URLPattern, Handler]> = [
  ['GET',    new URLPattern({ pathname: '/items' }),                          getItems],
  ['POST',   new URLPattern({ pathname: '/items' }),                          createItem],
  ['PATCH',  new URLPattern({ pathname: '/items/:id' }),                      updateItem],
  ['DELETE', new URLPattern({ pathname: '/items/:id' }),                      deleteItem],
  ['GET',    new URLPattern({ pathname: '/recipes' }),                        getRecipes],
  ['GET',    new URLPattern({ pathname: '/recipes/:id' }),                    getRecipe],
  ['GET',    new URLPattern({ pathname: '/recipes/:id/ingredients' }),        getRecipeIngredients],
  ['PATCH',  new URLPattern({ pathname: '/recipe-ingredients/:id' }),         updateRecipeIngredient],
]

// ── Entry point ───────────────────────────────────────────────────────────────

export default {
  async fetch(req: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const origin = resolveOrigin(req, env.ALLOWED_ORIGIN ?? DEFAULT_ORIGIN)

    // CORS preflight
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) })
    }

    try {
      for (const [method, pattern, handler] of routes) {
        if (req.method !== method) continue

        const match = pattern.exec(req.url)
        if (!match) continue

        // Collect pathname groups in declaration order
        const groups = Object.values(match.pathname.groups).map(v => v ?? '')
        const res = await handler(req, env, ...groups)
        return withCors(res, origin)
      }

      return err(404, 'Not found', origin)
    } catch (e) {
      if (e instanceof NotionError) {
        return err(e.status >= 400 && e.status < 500 ? e.status : 502, e.message, origin)
      }
      console.error(e)
      return err(500, 'Internal server error', origin)
    }
  },
} satisfies ExportedHandler<Env>
