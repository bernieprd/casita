import { queryDatabase, getPage, getBlockChildren, createPage, updatePage, deleteBlock, appendBlockChildren } from '../notion'
import { normalizeRecipe, normalizeBlock, normalizeRecipeIngredient, normalizeItem, recipeToProps } from '../normalize'
import type { Env, RecipeWithBlocks } from '../types'

export async function createRecipe(req: Request, env: Env): Promise<Response> {
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

  const page = await createPage(env.NOTION_TOKEN, env.NOTION_RECIPES_DB, props, cover)

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

export async function getRecipes(_req: Request, env: Env): Promise<Response> {
  const pages = await queryDatabase(env.NOTION_TOKEN, env.NOTION_RECIPES_DB)
  return Response.json(pages.map(normalizeRecipe))
}

export async function getRecipe(_req: Request, env: Env, id: string): Promise<Response> {
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

export async function updateRecipe(req: Request, env: Env, id: string): Promise<Response> {
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
  recipeId: string,
): Promise<Response> {
  const filter = { property: 'Recipe', relation: { contains: recipeId } }
  const ingredientPages = await queryDatabase(
    env.NOTION_TOKEN,
    env.NOTION_RECIPE_INGREDIENT_DB,
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
