import type { AreaId } from '@/api/areas'

export const CROSS_AREA_GUARDS = [
  { area: 'todos',    location: 'Home.tsx / TodoSection' },
  { area: 'shopping', location: 'Home.tsx / ShoppingSection' },
  { area: 'calendar', location: 'Home.tsx / CalendarSection' },
  { area: 'recipes',  location: 'Home.tsx / RecipesSection' },
  { area: 'todos',    location: 'PlanRecipeSheet.tsx / schedule-as-task' },
  { area: 'shopping', location: 'Recipes.tsx / shopping-toggle' },
  { area: '*',        location: 'AreasSettings.tsx / tab-pin options' },
  { area: '*',        location: 'App.tsx / computed tab array' },
] as const satisfies Array<{ area: AreaId | '*'; location: string }>
