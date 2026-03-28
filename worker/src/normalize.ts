import type {
  NotionPage,
  NotionProperty,
  NotionBlock,
  NotionCover,
  Item,
  Recipe,
  Block,
  RecipeIngredient,
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

export function recipeIngredientToProps(
  fields: Partial<Pick<RecipeIngredient, 'needsShopping'>>,
): NotionProps {
  const props: NotionProps = {}
  if (fields.needsShopping !== undefined)
    props['Add to list'] = { checkbox: fields.needsShopping }
  return props
}
