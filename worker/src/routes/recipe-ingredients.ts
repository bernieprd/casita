import { updatePage } from '../notion'
import { normalizeRecipeIngredient, recipeIngredientToProps } from '../normalize'
import type { Env } from '../types'

export async function updateRecipeIngredient(
  req: Request,
  env: Env,
  id: string,
): Promise<Response> {
  const body = await req.json<{ needsShopping?: boolean }>()
  const props = recipeIngredientToProps(body)
  const page = await updatePage(env.NOTION_TOKEN, id, props)

  // itemName is not available here without an extra fetch; return empty string
  // since the caller already has it from the ingredients list.
  return Response.json(normalizeRecipeIngredient(page, ''))
}
