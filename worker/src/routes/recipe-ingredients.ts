import { updatePage, createPage, archivePage, getPage } from '../notion'
import {
  normalizeRecipeIngredient,
  normalizeItem,
  recipeIngredientToProps,
  recipeIngredientCreateProps,
  itemToProps,
} from '../normalize'
import type { Env, RequestContext, HouseholdNotionConfig } from '../types'

export async function updateRecipeIngredient(
  req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{ needsShopping?: boolean; quantity?: string | null; section?: string | null; itemId?: string }>()
  const props = recipeIngredientToProps(body)
  const page = await updatePage(env.NOTION_TOKEN, id, props)

  // Side-effect: keep the linked Item's Shopping List checkbox in sync.
  if (body.needsShopping !== undefined) {
    const rel = page.properties['Ingredient']
    const itemId = rel?.type === 'relation' ? (rel.relation[0]?.id ?? '') : ''
    if (itemId) {
      await updatePage(env.NOTION_TOKEN, itemId, itemToProps({ onShoppingList: body.needsShopping }))
    }
  }

  return Response.json(normalizeRecipeIngredient(page, ''))
}

export async function createRecipeIngredient(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await env.DB.prepare(
    'SELECT * FROM household_notion_config WHERE household_id = ?'
  ).bind(ctx.householdId).first<HouseholdNotionConfig>()
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const body = await req.json<{ recipeId: string; itemId: string; quantity?: string | null; section?: string | null; itemName?: string }>()
  const props = recipeIngredientCreateProps(body)

  // Run page creation and item-name fetch in parallel; skip fetch if caller supplied itemName
  const [page, resolvedName] = await Promise.all([
    createPage(env.NOTION_TOKEN, config.recipe_ingredient_db, props),
    body.itemName
      ? Promise.resolve(body.itemName)
      : getPage(env.NOTION_TOKEN, body.itemId).then(p => normalizeItem(p).name),
  ])

  return Response.json(normalizeRecipeIngredient(page, resolvedName), { status: 201 })
}

export async function deleteRecipeIngredient(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  id: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  await archivePage(env.NOTION_TOKEN, id)
  return new Response(null, { status: 204 })
}
