import { queryDatabase, getPage, getBlockChildren } from '../notion'
import { normalizeRecipe, normalizeBlock, normalizeRecipeIngredient, normalizeItem } from '../normalize'
import type { Env, RecipeWithBlocks } from '../types'

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
