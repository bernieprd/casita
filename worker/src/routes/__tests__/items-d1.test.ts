import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { env as testEnv } from 'cloudflare:test'
import {
  applySchema, cleanDb, seedHousehold, insertItem, insertRecipeIngredient,
  makeEnv, makeCtx, makeRequest,
} from '../../test/fixtures'
import { getItems, createItem, updateItem, mergeItem } from '../items-d1'

beforeAll(applySchema)
beforeEach(async () => { await cleanDb(); await seedHousehold() })

describe('authorization guard', () => {
  const noHhCtx = makeCtx({ householdId: null })

  it('getItems returns 403 without householdId', async () => {
    const req = makeRequest('GET', '/items')
    const res = await getItems(req, makeEnv(), noHhCtx)
    expect(res.status).toBe(403)
  })

  it('createItem returns 403 without householdId', async () => {
    const req = makeRequest('POST', '/items', { name: 'Milk' })
    const res = await createItem(req, makeEnv(), noHhCtx)
    expect(res.status).toBe(403)
  })

  it('updateItem returns 403 without householdId', async () => {
    const req = makeRequest('PATCH', '/items/item-1', { name: 'Oat Milk' })
    const res = await updateItem(req, makeEnv(), noHhCtx, 'item-1')
    expect(res.status).toBe(403)
  })

  it('mergeItem returns 403 without householdId', async () => {
    const req = makeRequest('POST', '/items/item-1/merge', { keepId: 'item-2' })
    const res = await mergeItem(req, makeEnv(), noHhCtx, 'item-1')
    expect(res.status).toBe(403)
  })
})

describe('getItems', () => {
  it('returns all household items', async () => {
    await insertItem('item-1', 'Milk')
    await insertItem('item-2', 'Eggs')
    const req = makeRequest('GET', '/items')
    const res = await getItems(req, makeEnv(), makeCtx())
    expect(res.status).toBe(200)
    const body = await res.json<{ id: string }[]>()
    expect(body).toHaveLength(2)
  })

  it('filters to shopping-list items when shopping=true', async () => {
    await insertItem('item-1', 'Milk', false)
    await insertItem('item-2', 'Eggs', true)
    const req = makeRequest('GET', '/items?shopping=true')
    const res = await getItems(req, makeEnv(), makeCtx())
    const body = await res.json<{ id: string }[]>()
    expect(body).toHaveLength(1)
    expect(body[0].id).toBe('item-2')
  })
})

describe('createItem', () => {
  it('rejects empty name with 400', async () => {
    const req = makeRequest('POST', '/items', { name: '' })
    const res = await createItem(req, makeEnv(), makeCtx())
    expect(res.status).toBe(400)
  })

  it('rejects name longer than 500 chars with 400', async () => {
    const req = makeRequest('POST', '/items', { name: 'a'.repeat(501) })
    const res = await createItem(req, makeEnv(), makeCtx())
    expect(res.status).toBe(400)
  })

  it('creates item and returns 201', async () => {
    const req = makeRequest('POST', '/items', { name: 'Butter', onShoppingList: false })
    const res = await createItem(req, makeEnv(), makeCtx())
    expect(res.status).toBe(201)
    const body = await res.json<{ id: string; name: string }>()
    expect(body.name).toBe('Butter')
    expect(typeof body.id).toBe('string')
  })
})

describe('updateItem', () => {
  it('rejects empty name with 400', async () => {
    await insertItem('item-1', 'Milk')
    const req = makeRequest('PATCH', '/items/item-1', { name: '' })
    const res = await updateItem(req, makeEnv(), makeCtx(), 'item-1')
    expect(res.status).toBe(400)
  })

  it('updates name and returns 200 with new name', async () => {
    await insertItem('item-1', 'Milk')
    const req = makeRequest('PATCH', '/items/item-1', { name: 'Oat Milk' })
    const res = await updateItem(req, makeEnv(), makeCtx(), 'item-1')
    expect(res.status).toBe(200)
    const body = await res.json<{ id: string; name: string }>()
    expect(body.name).toBe('Oat Milk')
  })

  it('updates onShoppingList in the DB', async () => {
    await insertItem('item-1', 'Milk', false)
    const req = makeRequest('PATCH', '/items/item-1', { onShoppingList: true })
    const res = await updateItem(req, makeEnv(), makeCtx(), 'item-1')
    expect(res.status).toBe(200)
    const row = await testEnv.DB.prepare('SELECT on_shopping_list FROM items WHERE id = ?')
      .bind('item-1').first<{ on_shopping_list: number }>()
    expect(row?.on_shopping_list).toBe(1)
  })
})

describe('mergeItem', () => {
  it('re-points recipe ingredients from discard item to keeper', async () => {
    await insertItem('item-keep', 'Milk')
    await insertItem('item-discard', 'milk')
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-discard')

    const req = makeRequest('POST', `/items/item-discard/merge`, { keepId: 'item-keep' })
    const res = await mergeItem(req, makeEnv(), makeCtx(), 'item-discard')
    expect(res.status).toBe(200)

    const ing = await testEnv.DB.prepare('SELECT item_id FROM recipe_ingredients WHERE id = ?')
      .bind('ing-1').first<{ item_id: string }>()
    expect(ing?.item_id).toBe('item-keep')
  })

  it('deletes the discarded item', async () => {
    await insertItem('item-keep', 'Milk')
    await insertItem('item-discard', 'milk')

    const req = makeRequest('POST', `/items/item-discard/merge`, { keepId: 'item-keep' })
    await mergeItem(req, makeEnv(), makeCtx(), 'item-discard')

    const row = await testEnv.DB.prepare('SELECT id FROM items WHERE id = ?')
      .bind('item-discard').first()
    expect(row).toBeNull()
  })

  it('returns the kept item in the response body', async () => {
    await insertItem('item-keep', 'Milk')
    await insertItem('item-discard', 'milk')

    const req = makeRequest('POST', `/items/item-discard/merge`, { keepId: 'item-keep' })
    const res = await mergeItem(req, makeEnv(), makeCtx(), 'item-discard')
    const body = await res.json<{ id: string }>()
    expect(body.id).toBe('item-keep')
  })

  it('does not delete an item belonging to a different household', async () => {
    await insertItem('item-keep', 'Milk')
    await insertItem('item-discard', 'milk')
    await insertRecipeIngredient('ing-1', 'recipe-1', 'item-discard')

    const otherCtx = makeCtx({ householdId: 'other-hh' })
    const req = makeRequest('POST', `/items/item-discard/merge`, { keepId: 'item-keep' })
    await mergeItem(req, makeEnv(), otherCtx, 'item-discard')

    // item-discard belongs to hh-test, not other-hh — the DELETE is scoped so it is NOT deleted
    const row = await testEnv.DB.prepare('SELECT id FROM items WHERE id = ?')
      .bind('item-discard').first()
    expect(row).not.toBeNull()
  })
})
