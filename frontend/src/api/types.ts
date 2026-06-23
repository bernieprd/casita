export interface Item {
  id: string
  name: string
  category: string | null
  supermarkets: string[]
  onShoppingList: boolean
}

export interface Recipe {
  id: string
  name: string
  type: string | null
  day: string | null
  url: string | null
  coverPhotoUrl: string | null
  createdAt: number
  updatedAt: number
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
  categoryId: string | null
  assignedTo: string[] | null
  url: string | null
  notes: string | null
  frequency: string | null
  frequencyInterval: number | null
  frequencyDays: string[] | null
  sortOrder: number
}

export interface CalendarEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  color: string | null
  source?: 'user' | 'household-shared' | 'free-busy'
}

export interface ConnectedAccount {
  provider: 'google'
  accountEmail: string
  connectedAt: number
}

export interface UserCalendar {
  id: string
  name: string
  colorHex: string
  enabled: boolean
  visibility: 'private' | 'household' | 'free-busy'
  provider: 'google'
  accountEmail: string
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

export interface FinancePeriod {
  id: string
  householdId: string
  name: string
  startDate: string
  endDate: string
  createdAt: number
  incomeCents?: number
  expensesCents?: number
}

export interface FinanceIncome {
  id: string
  householdId: string
  userId: string
  periodId: string
  source: string
  tag: string | null
  amountCents: number
  createdAt: number
}

export interface FinanceExpense {
  id: string
  householdId: string
  userId: string
  periodId: string
  source: string
  tag: string | null
  type: 'shared' | 'personal'
  amountCents: number
  budgetCents: number
  createdAt: number
}

export interface FinanceAccount {
  id: string
  householdId: string
  userId: string
  periodId: string
  name: string
  institution: string | null
  amountCents: number
  date: string
  createdAt: number
}
