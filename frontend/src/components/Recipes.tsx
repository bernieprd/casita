import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Search, Share, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { useRecipes, useRecipe, useRecipeIngredients, useToggleNeedsShopping, useItems, useShareRecipe } from '../api'
import type { Block, RecipeIngredient, Item } from '../api'

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RecipeGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-lg overflow-hidden bg-card shadow-sm">
          <Skeleton className="w-full aspect-[4/3]" />
          <div className="p-3">
            <Skeleton className="w-4/5 h-4 mb-2" />
            <Skeleton className="w-2/5 h-3" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Recipe grid ───────────────────────────────────────────────────────────────

function RecipeGrid({ onSelect, setHeader }: { onSelect: (id: string) => void; setHeader?: (node: ReactNode | null) => void }) {
  const { data: recipes, isLoading, error } = useRecipes()
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [scrollToId, setScrollToId] = useState<string | null>(null)

  const typeOptions = useMemo(
    () => [...new Set((recipes ?? []).map(r => r.type).filter(Boolean) as string[])].sort(),
    [recipes],
  )

  const filtered = useMemo(() => {
    if (!recipes) return []
    const q = search.trim().toLowerCase()
    return recipes.filter(r => {
      const matchesSearch = !q || r.name.toLowerCase().includes(q)
      const matchesType = !selectedType || r.type === selectedType
      return matchesSearch && matchesType
    })
  }, [recipes, search, selectedType])

  // Scroll to newly created recipe once it appears in the rendered list
  useMemo(() => {
    if (!scrollToId || !filtered.length) return
    const card = document.getElementById(`recipe-card-${scrollToId}`)
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      setScrollToId(null)
    }
  }, [scrollToId, filtered])

  const isFiltering = search.trim() !== '' || selectedType !== null

  useEffect(() => {
    if (!setHeader) return
    setHeader(
      <div className="flex-1 relative px-2">
        <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Search recipes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>
    )
    return () => setHeader(null)
  }, [search, setHeader])

  const fab = (
    <Button
      size="icon"
      aria-label="New recipe"
      onClick={() => navigate('/recipes/new')}
      className="rounded-full fixed bottom-20 right-4 h-14 w-14 shadow-lg"
      style={{ bottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      <Plus className="h-6 w-6" />
    </Button>
  )

  if (isLoading) return <RecipeGridSkeleton />
  if (error) return <p className="text-destructive p-4">Failed to load recipes.</p>

  if (!recipes?.length) {
    return (
      <>
        <div className="pt-10 text-center px-4">
          <img src="/casita.webp" alt="" className="w-20 mb-4 opacity-70 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground mb-1">No recipes yet</p>
          <p className="text-sm text-muted-foreground/60">Tap + to add your first recipe</p>
        </div>
        {fab}
      </>
    )
  }

  return (
    <div>
      {/* Type filter chips */}
      {typeOptions.length > 0 && (
        <div className="flex gap-1.5 flex-wrap mb-3">
          {typeOptions.map(type => (
            <Badge
              key={type}
              variant={selectedType === type ? 'default' : 'outline'}
              className="cursor-pointer"
              onClick={() => setSelectedType(prev => prev === type ? null : type)}
            >
              {type}
            </Badge>
          ))}
        </div>
      )}

      {/* Result count */}
      <p className="text-xs text-muted-foreground mb-3">
        {isFiltering
          ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
          : `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`}
      </p>

      {/* Empty state (filter miss) */}
      {filtered.length === 0 ? (
        <div className="pt-8 text-center px-4">
          <div className="text-5xl mb-4 opacity-35">🔍</div>
          <p className="text-sm font-medium text-muted-foreground">No recipes match</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(recipe => (
            <div
              key={recipe.id}
              id={`recipe-card-${recipe.id}`}
              onClick={() => onSelect(recipe.id)}
              className="cursor-pointer rounded-lg overflow-hidden bg-card shadow-sm transition-opacity active:opacity-75"
            >
              <div className="relative w-full aspect-[4/3]">
                {/* Emoji fallback — always behind; shows when there's no URL or the image errors */}
                <div className="absolute inset-0 bg-accent flex items-center justify-center text-4xl">
                  🍽
                </div>
                {recipe.coverPhotoUrl && (
                  <>
                    <Skeleton className="absolute inset-0 w-full h-full z-[1] rounded-none" />
                    <img
                      src={recipe.coverPhotoUrl}
                      alt={recipe.name}
                      loading="lazy"
                      decoding="async"
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
                  </>
                )}
              </div>
              <div className="p-3">
                <p className="text-sm font-semibold leading-tight mb-1.5">{recipe.name}</p>
                <div className="flex flex-wrap gap-1">
                  {recipe.type && (
                    <Badge className="text-[10px] h-[18px] px-1.5">{recipe.type}</Badge>
                  )}
                  {recipe.day && (
                    <Badge variant="outline" className="text-[10px] h-[18px] px-1.5">{recipe.day}</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {fab}
    </div>
  )
}

// ── Ingredient groups ─────────────────────────────────────────────────────────

type ToggleMutation = ReturnType<typeof useToggleNeedsShopping>

function IngredientGroups({
  ingredients,
  toggle,
  allItems,
}: {
  ingredients: RecipeIngredient[]
  toggle: ToggleMutation
  allItems: Item[]
}) {
  const inList = (ing: RecipeIngredient): boolean => {
    if (ing.itemId && allItems.length > 0) {
      const found = allItems.find(i => i.id === ing.itemId)
      if (found !== undefined) return found.onShoppingList
    }
    return ing.needsShopping
  }

  // Group: null/empty section first, then named sections in order of first appearance
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

    // Ensure null (no section) is always first
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
              <li key={ing.id} className="flex items-center justify-between py-2 gap-4">
                <div className="min-w-0">
                  <p className="text-sm">{ing.itemName}</p>
                  {ing.quantity && <p className="text-xs text-muted-foreground">{ing.quantity}</p>}
                </div>
                <Button
                  size="sm"
                  variant={inList(ing) ? 'outline' : 'default'}
                  className="shrink-0 min-w-[68px]"
                  onClick={() => toggle.mutate({
                    id: ing.id,
                    needsShopping: !inList(ing),
                    itemId: ing.itemId,
                    itemName: ing.itemName,
                  })}
                >
                  {inList(ing) ? 'Remove' : 'Add'}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// ── Recipe detail ─────────────────────────────────────────────────────────────

function RecipeDetail({ id, onBack, setToolbar }: { id: string; onBack: () => void; setToolbar?: (node: ReactNode | null) => void }) {
  const { data: recipe, isLoading: recipeLoading } = useRecipe(id)
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(id)
  const toggle = useToggleNeedsShopping(id)
  const { data: allItems = [] } = useItems()
  const navigate = useNavigate()
  const shareRecipe = useShareRecipe(id)
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  function handleShare() {
    shareRecipe.mutate(undefined, {
      onSuccess: ({ url }) => {
        navigator.clipboard.writeText(url).catch(() => {})
        toast.success('Link copied!')
      }
    })
  }

  useEffect(() => {
    setToolbar?.(
      <>
        <Button variant="ghost" size="icon" onClick={() => onBackRef.current()} className="-ml-2">
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold truncate">{recipe?.name ?? ''}</h1>
        <Button variant="ghost" size="icon" onClick={() => navigate(`/recipes/${id}/edit`)}>
          <Pencil className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" onClick={handleShare}>
          <Share className="h-5 w-5" />
        </Button>
      </>
    )
    return () => setToolbar?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recipe?.name])

  return (
    <div className="pb-10">

      {recipeLoading && !recipe ? (
        <>
          <Skeleton className="w-full aspect-video rounded-lg mb-4" />
          <Skeleton className="w-4/5 h-8 mb-3" />
          <div className="flex gap-1.5 mb-6">
            <Skeleton className="w-18 h-6 rounded-full" />
            <Skeleton className="w-16 h-6 rounded-full" />
          </div>
          <Skeleton className="w-24 h-3.5 mb-1" />
          <Skeleton className="w-full h-px mb-3" />
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 mb-1" />)}
        </>
      ) : recipe && (
        <>
          {/* Cover */}
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

          {/* Title + badges */}
          <h1 className="text-2xl font-bold mb-3">{recipe.name}</h1>
          {(recipe.type || recipe.day) && (
            <div className="flex gap-1.5 mb-6 flex-wrap">
              {recipe.type && <Badge>{recipe.type}</Badge>}
              {recipe.day && <Badge variant="outline">{recipe.day}</Badge>}
            </div>
          )}

          {/* Ingredients */}
          <p className="text-xs tracking-wider uppercase text-muted-foreground">Ingredients</p>
          <Separator className="mt-1 mb-1" />

          {ingredientsLoading ? (
            <div className="py-4 flex justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            </div>
          ) : (ingredients ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">No ingredients listed.</p>
          ) : (
            <IngredientGroups ingredients={ingredients ?? []} toggle={toggle} allItems={allItems} />
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
        </>
      )}
    </div>
  )
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export default function Recipes({
  setToolbar,
}: {
  setToolbar?: (node: ReactNode | null) => void
}) {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()

  if (id) {
    return <RecipeDetail id={id} onBack={() => navigate('/recipes')} setToolbar={setToolbar} />
  }

  return <RecipeGrid onSelect={id => navigate(`/recipes/${id}`)} setHeader={setToolbar} />
}
