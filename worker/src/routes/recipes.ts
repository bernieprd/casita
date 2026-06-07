import { queryDatabase, getPage, getBlockChildren, createPage, updatePage, deleteBlock, appendBlockChildren } from '../notion'
import { normalizeRecipe, normalizeBlock, normalizeRecipeIngredient, normalizeItem, recipeToProps } from '../normalize'
import type { Env, RecipeWithBlocks, RequestContext } from '../types'
import { getNotionConfig } from './household'

export async function createRecipe(req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await getNotionConfig(env, ctx.householdId)
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const body = await req.json<{
    name: string
    type?: string | null
    day?: string | null
    url?: string | null
    coverUrl?: string | null
    instructions?: string
  }>()

  const props = recipeToProps({
    name: body.name,
    type: body.type,
    day: body.day,
    url: body.url,
  })

  const cover = body.coverUrl
    ? ({ type: 'external', external: { url: body.coverUrl } } as const)
    : undefined

  const page = await createPage(env.NOTION_TOKEN, config.recipes_db, props, cover)

  if (body.instructions) {
    const lines = body.instructions.split('\n').filter(l => l.trim())
    if (lines.length) {
      await appendBlockChildren(
        env.NOTION_TOKEN,
        page.id,
        lines.map(text => ({
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
        })),
      )
    }
  }

  return Response.json(normalizeRecipe(page), { status: 201 })
}

export async function getRecipes(_req: Request, env: Env, ctx: RequestContext): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await getNotionConfig(env, ctx.householdId)
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const pages = await queryDatabase(env.NOTION_TOKEN, config.recipes_db)
  return Response.json(pages.map(normalizeRecipe))
}

export async function getRecipe(_req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const [page, blocks] = await Promise.all([
    getPage(env.NOTION_TOKEN, id),
    getBlockChildren(env.NOTION_TOKEN, id),
  ])

  const recipe: RecipeWithBlocks = {
    ...normalizeRecipe(page),
    blocks: blocks.map(normalizeBlock),
  }
  return Response.json(recipe)
}

export async function updateRecipe(req: Request, env: Env, ctx: RequestContext, id: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const body = await req.json<{
    name?: string
    type?: string | null
    day?: string | null
    url?: string | null
    coverUrl?: string | null
    instructions?: string
  }>()

  const props = recipeToProps(body)

  // Build cover value: undefined = don't touch, null = remove, object = set external URL
  let cover: { type: 'external'; external: { url: string } } | null | undefined
  if ('coverUrl' in body) {
    cover = body.coverUrl ? { type: 'external', external: { url: body.coverUrl } } : null
  }

  // updatePage and getBlockChildren are independent — run in parallel
  const [page, existing] = await Promise.all([
    updatePage(env.NOTION_TOKEN, id, props, cover),
    'instructions' in body ? getBlockChildren(env.NOTION_TOKEN, id) : Promise.resolve([]),
  ])

  // Replace instructions blocks when provided
  if ('instructions' in body) {
    await Promise.all(existing.map(b => deleteBlock(env.NOTION_TOKEN, b.id)))
    const lines = (body.instructions ?? '').split('\n').filter(l => l.trim())
    if (lines.length) {
      await appendBlockChildren(
        env.NOTION_TOKEN,
        id,
        lines.map(text => ({
          type: 'paragraph',
          paragraph: { rich_text: [{ type: 'text', text: { content: text } }] },
        })),
      )
    }
  }

  // Frontend invalidates and re-fetches detail — no need to return full blocks here
  return Response.json(normalizeRecipe(page))
}

export async function getRecipeIngredients(
  _req: Request,
  env: Env,
  ctx: RequestContext,
  recipeId: string,
): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const config = await getNotionConfig(env, ctx.householdId)
  if (!config) return Response.json({ error: 'Household not configured' }, { status: 403 })

  const filter = { property: 'Recipe', relation: { contains: recipeId } }
  const ingredientPages = await queryDatabase(
    env.NOTION_TOKEN,
    config.recipe_ingredient_db,
    filter,
  )

  // Resolve each related Item page in parallel to get the item name.
  const ingredients = await Promise.all(
    ingredientPages.map(async page => {
      const relation = page.properties['Ingredient']
      const itemId =
        relation?.type === 'relation' ? (relation.relation[0]?.id ?? '') : ''

      let itemName = ''
      if (itemId) {
        const itemPage = await getPage(env.NOTION_TOKEN, itemId)
        itemName = normalizeItem(itemPage).name
      }

      return normalizeRecipeIngredient(page, itemName)
    }),
  )

  return Response.json(ingredients)
}

export async function shareRecipe(_req: Request, env: Env, ctx: RequestContext, recipeId: string): Promise<Response> {
  if (!ctx.householdId) return Response.json({ error: 'No household' }, { status: 403 })

  const existing = await env.AUTH_KV.get(`share-recipe:${recipeId}`)
  if (existing) {
    const appUrl = env.APP_BASE_URL ?? 'https://casita.bernardoprd.com/#'
    return Response.json({ token: existing, url: `${appUrl}/share/${existing}` })
  }

  const token = crypto.randomUUID()
  await Promise.all([
    env.AUTH_KV.put(`share:${token}`, JSON.stringify({ recipeId, householdId: ctx.householdId })),
    env.AUTH_KV.put(`share-recipe:${recipeId}`, token),
  ])

  const appUrl = env.APP_BASE_URL ?? 'https://casita.bernardoprd.com/#'
  return Response.json({ token, url: `${appUrl}/share/${token}` }, { status: 201 })
}

export async function getPublicRecipe(_req: Request, env: Env, token: string): Promise<Response> {
  const raw = await env.AUTH_KV.get(`share:${token}`)
  if (!raw) return Response.json({ error: 'Not found' }, { status: 404 })

  // Support both new JSON format { recipeId, householdId } and old plain string format
  let recipeId: string
  let householdId: string
  try {
    const parsed = JSON.parse(raw) as { recipeId: string; householdId: string }
    recipeId = parsed.recipeId
    householdId = parsed.householdId
  } catch {
    recipeId = raw
    householdId = 'hh-home'
  }

  const config = await getNotionConfig(env, householdId)
  if (!config) return Response.json({ error: 'Not found' }, { status: 404 })

  const [page, blocks, ingredientPages] = await Promise.all([
    getPage(env.NOTION_TOKEN, recipeId),
    getBlockChildren(env.NOTION_TOKEN, recipeId),
    queryDatabase(env.NOTION_TOKEN, config.recipe_ingredient_db, {
      property: 'Recipe',
      relation: { contains: recipeId },
    }),
  ])

  const recipe: RecipeWithBlocks = {
    ...normalizeRecipe(page),
    blocks: blocks.map(normalizeBlock),
  }

  const ingredients = await Promise.all(
    ingredientPages.map(async ingPage => {
      const relation = ingPage.properties['Ingredient']
      const itemId = relation?.type === 'relation' ? (relation.relation[0]?.id ?? '') : ''
      let itemName = ''
      if (itemId) {
        const itemPage = await getPage(env.NOTION_TOKEN, itemId)
        itemName = normalizeItem(itemPage).name
      }
      return normalizeRecipeIngredient(ingPage, itemName)
    }),
  )

  return Response.json({ recipe, ingredients })
}
