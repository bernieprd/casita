import { useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { usePublicRecipe } from '../api'
import type { Block, RecipeIngredient } from '../api'
import { useMemo } from 'react'

// ── Block renderer ────────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading_1':
      return <h2 className="text-lg font-bold mt-10 mb-2">{block.text}</h2>
    case 'heading_2':
      return <h3 className="text-base font-semibold mt-8 mb-2">{block.text}</h3>
    case 'heading_3':
      return <h4 className="text-sm font-semibold mt-6 mb-2">{block.text}</h4>
    case 'bulleted_list_item':
      return <p className="text-sm pl-4 mb-1">• {block.text}</p>
    case 'numbered_list_item':
      return <p className="text-sm pl-4 mb-1">{block.text}</p>
    case 'divider':
      return <Separator className="my-4" />
    case 'paragraph':
    default:
      return block.text
        ? <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{block.text}</p>
        : <div className="h-1.5" />
  }
}

// ── Static ingredient groups ──────────────────────────────────────────────────

function StaticIngredientGroups({ ingredients }: { ingredients: RecipeIngredient[] }) {
  const groups = useMemo(() => {
    const order: Array<string | null> = []
    const map = new Map<string | null, RecipeIngredient[]>()

    for (const ing of ingredients) {
      const key = ing.section || null
      if (!map.has(key)) {
        order.push(key)
        map.set(key, [])
      }
      map.get(key)!.push(ing)
    }

    const sorted = [null, ...order.filter(k => k !== null)]
    return sorted.filter(k => map.has(k)).map(k => ({ section: k, items: map.get(k)! }))
  }, [ingredients])

  return (
    <div className="mb-6">
      {groups.map(({ section, items }, groupIdx) => (
        <div key={section ?? '__none__'}>
          {groupIdx > 0 && <Separator className="my-4" />}
          {section && (
            <p className="block text-[10px] tracking-widest uppercase text-muted-foreground mb-1">
              {section}
            </p>
          )}
          <ul className="divide-y divide-border">
            {items.map((ing) => (
              <li key={ing.id} className="py-2">
                <p className="text-sm">{ing.itemName}</p>
                {ing.quantity && <p className="text-xs text-muted-foreground">{ing.quantity}</p>}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function PublicRecipeView() {
  const { token } = useParams<{ token: string }>()
  const { data, isLoading, error } = usePublicRecipe(token!)

  const recipe = data?.recipe
  const ingredients = data?.ingredients ?? []

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-xl mx-auto px-4 pt-6 pb-12">
          <Skeleton className="w-full aspect-video rounded-lg mb-4" />
          <Skeleton className="w-4/5 h-9 mb-3" />
          <div className="flex gap-1.5 mb-6">
            <Skeleton className="w-18 h-6 rounded-full" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
          <Skeleton className="w-24 h-3.5 mb-1" />
          <Skeleton className="w-full h-px mb-3" />
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10" />)}
          </div>
        </div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Recipe not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-xl mx-auto px-4 pt-6 pb-12">

        {/* Cover photo */}
        {recipe.coverPhotoUrl && (
          <div className="relative w-full aspect-video rounded-lg overflow-hidden mb-4">
            <div className="absolute inset-0 bg-accent flex items-center justify-center text-5xl">
              🍽
            </div>
            <Skeleton className="absolute inset-0 w-full h-full z-[1] rounded-none" />
            <img
              src={recipe.coverPhotoUrl}
              alt={recipe.name}
              decoding="async"
              loading="lazy"
              className="absolute inset-0 w-full h-full object-cover block z-[2]"
              style={{ opacity: 0, transition: 'opacity .25s' }}
              onLoad={e => {
                const img = e.target as HTMLImageElement
                img.style.opacity = '1';
                (img.previousElementSibling as HTMLElement | null)?.style.setProperty('display', 'none')
              }}
              onError={e => {
                const img = e.target as HTMLImageElement;
                (img.previousElementSibling as HTMLElement | null)?.style.setProperty('display', 'none')
              }}
            />
          </div>
        )}

        {/* Title + chips */}
        <h1 className="text-2xl font-bold mb-3">{recipe.name}</h1>
        {(recipe.type || recipe.day) && (
          <div className="flex gap-1.5 mb-6 flex-wrap">
            {recipe.type && <Badge>{recipe.type}</Badge>}
            {recipe.day && <Badge variant="outline">{recipe.day}</Badge>}
          </div>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <>
            <p className="text-xs tracking-wider uppercase text-muted-foreground">Ingredients</p>
            <Separator className="mt-1 mb-1" />
            <StaticIngredientGroups ingredients={ingredients} />
          </>
        )}

        {/* Instructions */}
        {recipe.blocks && recipe.blocks.length > 0 && (
          <>
            <p className="text-xs tracking-wider uppercase text-muted-foreground">Instructions</p>
            <Separator className="mt-1 mb-3" />
            <div>
              {recipe.blocks.map(block => (
                <RenderBlock key={block.id} block={block} />
              ))}
            </div>
          </>
        )}

        <p className="text-xs text-muted-foreground text-center mt-8">Made with Casita</p>
      </div>
    </div>
  )
}
