import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env as testEnv } from 'cloudflare:test'
import {
  applySchema, cleanDb, seedHousehold, insertItem, insertRecipeIngredient,
  makeEnv, makeCtx, makeRequest,
} from '../../test/fixtures'
import {
  createRecipeIngredient,
  updateRecipeIngredient,
  deleteRecipeIngredient,
} from '../recipe-ingredients-d1'

beforeAll(applySchema)
beforeEach(async () => { await cleanDb(); await seedHousehold() })

describe('authorization guard', () => {
  const noHhCtx = makeCtx({ householdId: null })

  it('createRecipeIngredient returns 403 without householdId', async () => {
    const req = makeRequest('POST', '/recipe-ingredients', { recipeId: 'r-1', itemId: 'i-1' })
    const res = await createRecipeIngredient(req, makeEnv(), noHhCtx)
    expect(res.status).toBe(403)
    const body = await res.json<{ error: string }>()
    expect(body.error).toBe('ERR_NO_HOUSEHOLD')
  })

  it('updateRecipeIngredient returns 403 without householdId', async () => {
    const req = makeRequest('PATCH', '/recipe-ingredients/ing-1', { needsShopping: true })
    const res = await updateRecipeIngredient(req, makeEnv(), noHhCtx, 'ing-1')
    expect(res.status).toBe(403)
  })

  it('deleteRecipeIngredient returns 403 without householdId', async () => {
    const req = makeRequest('DELETE', '/recipe-ingredients/ing-1')
    const res = await deleteRecipeIngredient(req, makeEnv(), noHhCtx, 'ing-1')
    expect(res.status).toBe(403)
  })
})

describe('updateRecipeIngredient — shopping list sync', () => {
  it('sets items.on_shopping_list = 1 when needsShopping is toggled on', async () => {
    await insertItem('item-1', 'Milk', false)
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1', false)

    const req = makeRequest('PATCH', '/recipe-ingredients/ing-1', { needsShopping: true })
    const res = await updateRecipeIngredient(req, makeEnv(), makeCtx(), 'ing-1')
    expect(res.status).toBe(200)

    const item = await testEnv.DB.prepare('SELECT on_shopping_list FROM items WHERE id = ?')
      .bind('item-1').first<{ on_shopping_list: number }>()
    expect(item?.on_shopping_list).toBe(1)
  })

  it('sets items.on_shopping_list = 0 when needsShopping is toggled off', async () => {
    await insertItem('item-1', 'Milk', true)
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1', true)

    const req = makeRequest('PATCH', '/recipe-ingredients/ing-1', { needsShopping: false })
    const res = await updateRecipeIngredient(req, makeEnv(), makeCtx(), 'ing-1')
    expect(res.status).toBe(200)

    const item = await testEnv.DB.prepare('SELECT on_shopping_list FROM items WHERE id = ?')
      .bind('item-1').first<{ on_shopping_list: number }>()
    expect(item?.on_shopping_list).toBe(0)
  })

  it('does not touch items.on_shopping_list when needsShopping is absent from body', async () => {
    await insertItem('item-1', 'Milk', true)
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1', false)

    const req = makeRequest('PATCH', '/recipe-ingredients/ing-1', { quantity: '2 cups' })
    const res = await updateRecipeIngredient(req, makeEnv(), makeCtx(), 'ing-1')
    expect(res.status).toBe(200)

    const item = await testEnv.DB.prepare('SELECT on_shopping_list FROM items WHERE id = ?')
      .bind('item-1').first<{ on_shopping_list: number }>()
    expect(item?.on_shopping_list).toBe(1)
  })

  it('updates recipe_ingredients.needs_shopping in the DB', async () => {
    await insertItem('item-1', 'Milk', false)
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1', false)

    const req = makeRequest('PATCH', '/recipe-ingredients/ing-1', { needsShopping: true })
    await updateRecipeIngredient(req, makeEnv(), makeCtx(), 'ing-1')

    const ing = await testEnv.DB.prepare('SELECT needs_shopping FROM recipe_ingredients WHERE id = ?')
      .bind('ing-1').first<{ needs_shopping: number }>()
    expect(ing?.needs_shopping).toBe(1)
  })

  it('returns the updated ingredient in response body', async () => {
    await insertItem('item-1', 'Milk', false)
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1', false)

    const req = makeRequest('PATCH', '/recipe-ingredients/ing-1', { needsShopping: true })
    const res = await updateRecipeIngredient(req, makeEnv(), makeCtx(), 'ing-1')
    const body = await res.json<{ id: string; needsShopping: boolean }>()
    expect(body.id).toBe('ing-1')
    expect(body.needsShopping).toBe(true)
  })
})

describe('deleteRecipeIngredient', () => {
  it('removes the ingredient from the database', async () => {
    await insertItem('item-1', 'Milk')
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1')

    const req = makeRequest('DELETE', '/recipe-ingredients/ing-1')
    const res = await deleteRecipeIngredient(req, makeEnv(), makeCtx(), 'ing-1')
    expect(res.status).toBe(204)

    const row = await testEnv.DB.prepare('SELECT id FROM recipe_ingredients WHERE id = ?')
      .bind('ing-1').first()
    expect(row).toBeNull()
  })

  it('only deletes ingredients belonging to the household', async () => {
    await insertItem('item-1', 'Milk')
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-1')

    const otherCtx = makeCtx({ householdId: 'other-hh' })
    const req = makeRequest('DELETE', '/recipe-ingredients/ing-1')
    await deleteRecipeIngredient(req, makeEnv(), otherCtx, 'ing-1')

    const row = await testEnv.DB.prepare('SELECT id FROM recipe_ingredients WHERE id = ?')
      .bind('ing-1').first()
    expect(row).not.toBeNull()
  })
})
