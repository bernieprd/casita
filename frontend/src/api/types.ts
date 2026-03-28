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

export interface RecipeIngredient {
  id: string
  recipeId: string
  itemId: string
  itemName: string
  quantity: string | null
  needsShopping: boolean
}
