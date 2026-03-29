import type {
  NotionPage,
  NotionProperty,
  NotionBlock,
  NotionCover,
  Item,
  Recipe,
  Block,
  RecipeIngredient,
  Todo,
} from './types'

// ── Property readers ──────────────────────────────────────────────────────────

function title(prop: NotionProperty | undefined): string {
  if (!prop || prop.type !== 'title') return ''
  return prop.title.map(t => t.plain_text).join('')
}

function richText(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== 'rich_text') return null
  const text = prop.rich_text.map(t => t.plain_text).join('')
  return text || null
}

function select(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== 'select') return null
  return prop.select?.name ?? null
}

function multiSelect(prop: NotionProperty | undefined): string[] {
  if (!prop || prop.type !== 'multi_select') return []
  return prop.multi_select.map(o => o.name)
}

function checkbox(prop: NotionProperty | undefined): boolean {
  if (!prop || prop.type !== 'checkbox') return false
  return prop.checkbox
}

function relation(prop: NotionProperty | undefined): string[] {
  if (!prop || prop.type !== 'relation') return []
  return prop.relation.map(r => r.id)
}

function url(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== 'url') return null
  return prop.url ?? null
}

function coverUrl(cover: NotionCover | null): string | null {
  if (!cover) return null
  return cover.type === 'external' ? cover.external.url : cover.file.url
}

function blockText(block: NotionBlock): string {
  const inner = block[block.type] as { rich_text?: Array<{ plain_text: string }> } | undefined
  return inner?.rich_text?.map(t => t.plain_text).join('') ?? ''
}

// ── Normalizers (Notion → domain) ─────────────────────────────────────────────

export function normalizeItem(page: NotionPage): Item {
  const p = page.properties
  return {
    id: page.id,
    name: title(p['Item']),
    category: select(p['Category']),
    supermarkets: multiSelect(p['Supermarket']),
    tags: multiSelect(p['Tags']),
    onShoppingList: checkbox(p['Shopping List']),
  }
}

export function normalizeRecipe(page: NotionPage): Recipe {
  const p = page.properties
  return {
    id: page.id,
    name: title(p['Recipes']),
    type: select(p['Type']),
    day: select(p['Day']),
    url: url(p['URL']),
    coverPhotoUrl: coverUrl(page.cover),
  }
}

export function normalizeBlock(block: NotionBlock): Block {
  return { id: block.id, type: block.type, text: blockText(block) }
}

export function normalizeRecipeIngredient(page: NotionPage, itemName: string): RecipeIngredient {
  const p = page.properties
  return {
    id: page.id,
    recipeId: relation(p['Recipe'])[0] ?? '',
    itemId: relation(p['Ingredient'])[0] ?? '',
    itemName,
    quantity: richText(p['Quantity']),
    section: richText(p['Section']) ?? select(p['Section']),
    needsShopping: checkbox(p['Add to list']),
  }
}

// ── Denormalizers (domain → Notion properties) ────────────────────────────────

type NotionProps = Record<string, unknown>

export function itemToProps(fields: Partial<Omit<Item, 'id'>>): NotionProps {
  const props: NotionProps = {}
  if (fields.name !== undefined)
    props['Item'] = { title: [{ text: { content: fields.name } }] }
  if (fields.category !== undefined)
    props['Category'] = fields.category ? { select: { name: fields.category } } : { select: null }
  if (fields.supermarkets !== undefined)
    props['Supermarket'] = { multi_select: fields.supermarkets.map(name => ({ name })) }
  if (fields.tags !== undefined)
    props['Tags'] = { multi_select: fields.tags.map(name => ({ name })) }
  if (fields.onShoppingList !== undefined)
    props['Shopping List'] = { checkbox: fields.onShoppingList }
  return props
}

export function recipeToProps(fields: {
  name?: string
  type?: string | null
  day?: string | null
  url?: string | null
}): NotionProps {
  const props: NotionProps = {}
  if (fields.name !== undefined)
    props['Recipes'] = { title: [{ text: { content: fields.name } }] }
  if ('type' in fields)
    props['Type'] = fields.type ? { select: { name: fields.type } } : { select: null }
  if ('day' in fields)
    props['Day'] = fields.day ? { select: { name: fields.day } } : { select: null }
  if ('url' in fields)
    props['URL'] = { url: fields.url ?? null }
  return props
}

export function recipeIngredientToProps(
  fields: Partial<Pick<RecipeIngredient, 'needsShopping' | 'quantity' | 'section'>> & { itemId?: string },
): NotionProps {
  const props: NotionProps = {}
  if (fields.needsShopping !== undefined)
    props['Add to list'] = { checkbox: fields.needsShopping }
  if ('quantity' in fields)
    props['Quantity'] = fields.quantity
      ? { rich_text: [{ type: 'text', text: { content: fields.quantity } }] }
      : { rich_text: [] }
  if ('section' in fields)
    props['Section'] = fields.section
      ? { rich_text: [{ type: 'text', text: { content: fields.section } }] }
      : { rich_text: [] }
  if (fields.itemId)
    props['Ingredient'] = { relation: [{ id: fields.itemId }] }
  return props
}

export function recipeIngredientCreateProps(fields: {
  recipeId: string
  itemId: string
  quantity?: string | null
  section?: string | null
}): NotionProps {
  const props: NotionProps = {
    'Recipe': { relation: [{ id: fields.recipeId }] },
    'Ingredient': { relation: [{ id: fields.itemId }] },
  }
  if (fields.quantity)
    props['Quantity'] = { rich_text: [{ type: 'text', text: { content: fields.quantity } }] }
  if (fields.section)
    props['Section'] = { rich_text: [{ type: 'text', text: { content: fields.section } }] }
  return props
}

// ── Todos ─────────────────────────────────────────────────────────────────────

function date(prop: NotionProperty | undefined): string | null {
  if (!prop || prop.type !== 'date') return null
  return prop.date?.start ?? null
}

export function normalizeTodo(page: NotionPage): Todo {
  const p = page.properties
  return {
    id: page.id,
    name: title(p['Name']),
    done: checkbox(p['Done']),
    priority: select(p['Priority']),
    due: date(p['Due']),
  }
}

export function todoToProps(fields: Partial<{ name: string; done: boolean; priority: string | null; due: string | null }>): NotionProps {
  const props: NotionProps = {}
  if (fields.name !== undefined)
    props['Name'] = { title: [{ text: { content: fields.name } }] }
  if (fields.done !== undefined)
    props['Done'] = { checkbox: fields.done }
  if ('priority' in fields)
    props['Priority'] = fields.priority ? { select: { name: fields.priority } } : { select: null }
  if ('due' in fields)
    props['Due'] = fields.due ? { date: { start: fields.due, end: null } } : { date: null }
  return props
}
