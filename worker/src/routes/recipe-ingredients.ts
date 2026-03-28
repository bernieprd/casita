import { updatePage } from '../notion'
import { normalizeRecipeIngredient, recipeIngredientToProps, itemToProps } from '../normalize'
import type { Env } from '../types'

export async function updateRecipeIngredient(
  req: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await req.json<{ needsShopping?: boolean }>()
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
