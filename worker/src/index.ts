import { getItems, createItem, updateItem, deleteItem, mergeItem } from './routes/items'
import { createRecipe, getRecipes, getRecipe, updateRecipe, getRecipeIngredients, shareRecipe, getPublicRecipe } from './routes/recipes'
import { updateRecipeIngredient, createRecipeIngredient, deleteRecipeIngredient } from './routes/recipe-ingredients'
import { uploadRecipePhoto, serveRecipePhoto } from './routes/uploads'
import { getTodos, createTodo, updateTodo, deleteTodo } from './routes/todos'
import { getCalendarEvents } from './routes/calendar'
import { checkAuth, setupAuth, loginAuth, logoutAuth } from './routes/auth'
import { NotionError } from './notion'
import type { Env } from './types'

const DEFAULT_ORIGIN = 'https://casita.bernardoprd.com'
const DEV_ORIGINS = ['http://localhost:5173', 'http://localhost:5174']

function resolveOrigin(req: Request, allowedOrigin: string): string {
  const reqOrigin = req.headers.get('Origin') ?? ''
  return DEV_ORIGINS.includes(reqOrigin) ? reqOrigin : allowedOrigin
}

function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
  ['POST',   new URLPattern({ pathname: '/auth/check' }),              checkAuth],
  ['POST',   new URLPattern({ pathname: '/auth/setup' }),              setupAuth],
  ['POST',   new URLPattern({ pathname: '/auth/login' }),              loginAuth],
  ['POST',   new URLPattern({ pathname: '/auth/logout' }),             logoutAuth],
  ['GET',    new URLPattern({ pathname: '/items' }),                          getItems],
  ['POST',   new URLPattern({ pathname: '/items' }),                          createItem],
  ['PATCH',  new URLPattern({ pathname: '/items/:id' }),                      updateItem],
  ['DELETE', new URLPattern({ pathname: '/items/:id' }),                      deleteItem],
  ['POST',   new URLPattern({ pathname: '/items/:id/merge' }),                mergeItem],
  ['POST',   new URLPattern({ pathname: '/recipes' }),                        createRecipe],
  ['GET',    new URLPattern({ pathname: '/recipes' }),                        getRecipes],
  ['GET',    new URLPattern({ pathname: '/recipes/:id' }),                    getRecipe],
  ['PATCH',  new URLPattern({ pathname: '/recipes/:id' }),                    updateRecipe],
  ['GET',    new URLPattern({ pathname: '/recipes/:id/ingredients' }),        getRecipeIngredients],
  ['POST',   new URLPattern({ pathname: '/recipes/:id/share' }),             shareRecipe],
  ['GET',    new URLPattern({ pathname: '/public/recipes/:token' }),         getPublicRecipe],
  ['POST',   new URLPattern({ pathname: '/recipe-ingredients' }),             createRecipeIngredient],
  ['PATCH',  new URLPattern({ pathname: '/recipe-ingredients/:id' }),         updateRecipeIngredient],
  ['DELETE', new URLPattern({ pathname: '/recipe-ingredients/:id' }),         deleteRecipeIngredient],
  ['POST',   new URLPattern({ pathname: '/recipe-photos' }),                  uploadRecipePhoto],
  ['GET',    new URLPattern({ pathname: '/recipe-photos/:key' }),             serveRecipePhoto],
  ['GET',    new URLPattern({ pathname: '/todos' }),                          getTodos],
  ['POST',   new URLPattern({ pathname: '/todos' }),                          createTodo],
  ['PATCH',  new URLPattern({ pathname: '/todos/:id' }),                      updateTodo],
  ['DELETE', new URLPattern({ pathname: '/todos/:id' }),                      deleteTodo],
  ['GET',    new URLPattern({ pathname: '/calendar' }),                       getCalendarEvents],
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
      if (!req.url.includes('/auth/') && !req.url.includes('/public/')) {
        const token = req.headers.get('Authorization')?.replace('Bearer ', '')
        if (!token) return err(401, 'Unauthorized', origin)
        const session = await env.AUTH_KV.get(`session:${token}`, 'json') as { email: string; expiresAt: number } | null
        if (!session || session.expiresAt < Date.now()) {
          if (session) await env.AUTH_KV.delete(`session:${token}`)
          return err(401, 'Unauthorized', origin)
        }
      }

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
