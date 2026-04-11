export interface Item {
  id: string
  name: string
  category: string | null
  supermarkets: string[]
  tags: string[]
  onShoppingList: boolean
}

export interface Recipe {
  id: string
  name: string
  type: string | null
  day: string | null
  url: string | null
  coverPhotoUrl: string | null
}

export interface Block {
  id: string
  type: string
  text: string
}

export interface RecipeWithBlocks extends Recipe {
  blocks: Block[]
}

export interface Todo {
  id: string
  name: string
  status: string | null
  priority: string | null
  due: string | null
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  color: string | null
}

export interface RecipeIngredient {
  id: string
  recipeId: string
  itemId: string
  itemName: string
  quantity: string | null
  section: string | null
  needsShopping: boolean
}
