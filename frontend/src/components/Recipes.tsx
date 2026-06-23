import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import PlanRecipeSheet from './PlanRecipeSheet'
import GuidedImport from './GuidedImport'
import { ImportModal } from './ImportModal'
import { useParams, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Pencil, Search, Share, ArrowLeft, CalendarPlus, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { useRecipes, useRecipe, useRecipeIngredients, useToggleNeedsShopping, useItems, useShareRecipe, useHouseholdSettings } from '../api'
import { isAreaEnabled } from '@/api/areas'
import type { Block, RecipeIngredient, Item } from '../api'
import { ItemRow } from './ItemRow'

// ── Inline markdown renderer ──────────────────────────────────────────────────

function renderInline(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return parts.map((part, i) =>
    part.startsWith('**') && part.endsWith('**')
      ? <strong key={i}>{part.slice(2, -2)}</strong>
      : part
  )
}

// ── Block renderer ────────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading_1':
      return <h3 className="text-lg font-bold mt-10 mb-2">{block.text}</h3>
    case 'heading_2':
      return <h4 className="text-base font-semibold mt-8 mb-2">{block.text}</h4>
    case 'heading_3':
      return <h5 className="text-sm font-semibold mt-6 mb-2">{block.text}</h5>
    case 'bulleted_list_item':
      return <p className="text-sm pl-4 mb-1">• {renderInline(block.text)}</p>
    case 'numbered_list_item':
      return <p className="text-sm pl-4 mb-1">{block.text}</p>
    case 'divider':
      return <Separator className="my-4" />
    case 'paragraph':
    default:
      return block.text
        ? <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{renderInline(block.text)}</p>
        : <div className="h-1.5" />
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RecipeGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-lg overflow-hidden bg-card border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)]">
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

type SortOption = 'name-asc' | 'name-desc' | 'updated-desc' | 'created-desc' | 'created-asc' | 'type'

function RecipeGrid({ onSelect, setHeader, initialScroll }: { onSelect: (id: string) => void; setHeader?: (node: ReactNode | null) => void; initialScroll?: number | null }) {
  const { t } = useTranslation()
  const { data: recipes, isLoading, error } = useRecipes()
  const navigate = useNavigate()
  const [importOpen, setImportOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>('updated-desc')
  const [scrollToId, setScrollToId] = useState<string | null>(null)
  const [imgErrors, setImgErrors] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (initialScroll) requestAnimationFrame(() => window.scrollTo(0, initialScroll))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const typeOptions = useMemo(
    () => [...new Set((recipes ?? []).map(r => r.type).filter(Boolean) as string[])].sort(),
    [recipes],
  )

  const filtered = useMemo(() => {
    if (!recipes) return []
    const q = search.trim().toLowerCase()
    const list = recipes.filter(r => {
      const matchesSearch = !q || r.name.toLowerCase().includes(q)
      const matchesType = !selectedType || r.type === selectedType
      return matchesSearch && matchesType
    })
    return list.sort((a, b) => {
      switch (sortBy) {
        case 'name-asc':     return a.name.localeCompare(b.name)
        case 'name-desc':    return b.name.localeCompare(a.name)
        case 'updated-desc': return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
        case 'created-desc': return (b.createdAt ?? 0) - (a.createdAt ?? 0)
        case 'created-asc':  return (a.createdAt ?? 0) - (b.createdAt ?? 0)
        case 'type':         return (a.type ?? '').localeCompare(b.type ?? '')
        default:             return 0
      }
    })
  }, [recipes, search, selectedType, sortBy])

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
      <div className="flex items-center gap-2 flex-1 px-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={t('recipes.searchPlaceholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => navigate('/recipes/new')}>
          <Plus className="h-4 w-4 mr-1" /> {t('recipes.new')}
        </Button>
      </div>
    )
    return () => setHeader(null)
  }, [search, setHeader])

  const renderCard = (recipe: NonNullable<typeof recipes>[number]) => (
    <div
      key={recipe.id}
      id={`recipe-card-${recipe.id}`}
      onClick={() => onSelect(recipe.id)}
      className="cursor-pointer rounded-lg overflow-hidden bg-card border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] transition-opacity active:opacity-75"
    >
      <div className="relative w-full aspect-[4/3]">
        <div className="absolute inset-0 bg-accent flex items-center justify-center text-4xl">
          {imgErrors.has(recipe.id) ? '🖼️' : '🍽'}
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
                setImgErrors(prev => new Set(prev).add(recipe.id))
              }}
            />
          </>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-semibold leading-tight mb-1.5">{recipe.name}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {recipe.type && (
            <Badge className="text-[10px] h-[18px] px-1.5">{recipe.type}</Badge>
          )}
          {recipe.url && (
            <a
              href={recipe.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={e => e.stopPropagation()}
              className="text-[10px] h-[18px] px-1.5 inline-flex items-center rounded-full border text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-2.5 mr-1" />
              {t('recipes.recipeLink')}
            </a>
          )}
        </div>
      </div>
    </div>
  )

  if (isLoading) return <RecipeGridSkeleton />
  if (error) return <p className="text-destructive p-4">{t('recipes.failedToLoad')}</p>

  if (!recipes?.length) {
    return (
      <>
        <div className="pt-10 text-center px-4">
          <img src="/casita.webp" alt="" className="w-20 mb-4 opacity-70 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground mb-1">{t('recipes.noRecipesYet')}</p>
          <p className="text-sm text-muted-foreground/60">{t('recipes.tapToAdd')}</p>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-3 text-sm text-primary hover:underline underline-offset-4 transition-colors"
          >
            {t('recipes.orImport')}
          </button>
        </div>
        <ImportModal open={importOpen} onOpenChange={setImportOpen} description={t('recipes.importDescription')}>
          <GuidedImport onDone={() => setImportOpen(false)} onSkip={() => setImportOpen(false)} />
        </ImportModal>
      </>
    )
  }

  return (
    <div>
      {/* Sort control */}
      <div className="mb-2">
        <Select value={sortBy} onValueChange={v => setSortBy(v as SortOption)}>
          <SelectTrigger size="sm" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="name-asc">{t('recipes.sortNameAsc')}</SelectItem>
            <SelectItem value="name-desc">{t('recipes.sortNameDesc')}</SelectItem>
            <SelectItem value="updated-desc">{t('recipes.sortRecentlyUpdated')}</SelectItem>
            <SelectItem value="created-desc">{t('recipes.sortNewest')}</SelectItem>
            <SelectItem value="created-asc">{t('recipes.sortOldest')}</SelectItem>
            <SelectItem value="type">{t('recipes.sortGroupByType')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
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
          ? t('recipes.resultCount', { count: filtered.length })
          : t('recipes.recipeCount', { count: recipes.length })}
      </p>

      {/* Empty state (filter miss) */}
      {filtered.length === 0 ? (
        <div className="pt-8 text-center px-4">
          <div className="text-5xl mb-4 opacity-35">🔍</div>
          <p className="text-sm font-medium text-muted-foreground">{t('recipes.noMatch')}</p>
        </div>
      ) : sortBy === 'type' ? (
        (() => {
          const groupMap = new Map<string, typeof filtered>()
          for (const r of filtered) {
            const key = r.type ?? '__other__'
            if (!groupMap.has(key)) groupMap.set(key, [])
            groupMap.get(key)!.push(r)
          }
          const groups: [string, typeof filtered][] = []
          for (const [key, gr] of groupMap) {
            if (key !== '__other__') groups.push([key, gr])
          }
          if (groupMap.has('__other__')) groups.push([t('recipes.other'), groupMap.get('__other__')!])
          return (
            <div className="flex flex-col gap-6">
              {groups.map(([label, groupRecipes]) => (
                <div key={label}>
                  <h3 className="text-xs font-semibold tracking-widest uppercase text-muted-foreground mb-3">{label}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    {groupRecipes.map(recipe => renderCard(recipe))}
                  </div>
                </div>
              ))}
            </div>
          )
        })()
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map(recipe => renderCard(recipe))}
        </div>
      )}

    </div>
  )
}

// ── Ingredient groups ─────────────────────────────────────────────────────────

type ToggleMutation = ReturnType<typeof useToggleNeedsShopping>

function CollapsibleIngredientGroup({
  section,
  items,
  toggle,
  inList,
  showShoppingToggle,
}: {
  section: string
  items: RecipeIngredient[]
  toggle: ToggleMutation
  inList: (ing: RecipeIngredient) => boolean
  showShoppingToggle: boolean
}) {
  const [open, setOpen] = useState(true)
  return (
    <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        className={`flex items-center w-full px-4 py-3 bg-card hover:bg-background transition-colors ${open ? 'rounded-t-lg' : 'rounded-lg'}`}
      >
        <h3 className="flex-1 text-left text-xs font-semibold tracking-widest uppercase text-muted-foreground leading-none">
          {section}
        </h3>
        <span className="text-xs text-muted-foreground mr-2">{items.length}</span>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      <div style={{ overflow: 'hidden', transition: 'max-height 0.2s ease', maxHeight: open ? '9999px' : 0 }}>
        <div className="rounded-b-lg overflow-hidden">
          <hr className="border-border" />
          <ul>
            {items.map((ing, idx) => (
              <li key={ing.id}>
                {idx > 0 && <hr className="border-border" />}
                <ItemRow
                  variant="recipe"
                  name={ing.itemName}
                  subtitle={ing.quantity ?? undefined}
                  onShoppingList={inList(ing)}
                  onToggle={showShoppingToggle ? () => toggle.mutate({ id: ing.id, needsShopping: !inList(ing), itemId: ing.itemId, itemName: ing.itemName }) : undefined}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

function IngredientGroups({
  ingredients,
  toggle,
  allItems,
  showShoppingToggle,
}: {
  ingredients: RecipeIngredient[]
  toggle: ToggleMutation
  allItems: Item[]
  showShoppingToggle: boolean
}) {
  const inList = (ing: RecipeIngredient): boolean => {
    if (ing.itemId && allItems.length > 0) {
      const found = allItems.find(i => i.id === ing.itemId)
      if (found !== undefined) return found.onShoppingList
    }
    return ing.needsShopping
  }

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
    <div className="mb-4 flex flex-col gap-2">
      {groups.map(({ section, items }) => {
        if (!section) {
          return (
            <div key="__none__" className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] overflow-hidden">
              <ul>
                {items.map((ing, idx) => (
                  <li key={ing.id}>
                    {idx > 0 && <hr className="border-border" />}
                    <ItemRow
                      variant="recipe"
                      name={ing.itemName}
                      subtitle={ing.quantity ?? undefined}
                      onShoppingList={inList(ing)}
                      onToggle={showShoppingToggle ? () => toggle.mutate({ id: ing.id, needsShopping: !inList(ing), itemId: ing.itemId, itemName: ing.itemName }) : undefined}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )
        }
        return (
          <CollapsibleIngredientGroup
            key={section}
            section={section}
            items={items}
            toggle={toggle}
            inList={inList}
            showShoppingToggle={showShoppingToggle}
          />
        )
      })}
    </div>
  )
}

// ── Recipe detail ─────────────────────────────────────────────────────────────

function RecipeDetail({ id, onBack, setToolbar }: { id: string; onBack: () => void; setToolbar?: (node: ReactNode | null) => void }) {
  const { t } = useTranslation()
  const { data: recipe, isLoading: recipeLoading } = useRecipe(id)
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(id)
  const toggle = useToggleNeedsShopping(id)
  const { data: allItems = [] } = useItems()
  const navigate = useNavigate()
  const shareRecipe = useShareRecipe(id)
  const { data: householdSettings } = useHouseholdSettings()
  const areasConfig = householdSettings?.areasConfig ?? null
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack
  const [planOpen, setPlanOpen] = useState(false)
  const [detailImgError, setDetailImgError] = useState(false)

  function handleShare() {
    shareRecipe.mutate(undefined, {
      onSuccess: ({ url }) => {
        navigator.clipboard.writeText(url).catch(() => {})
        toast.success(t('recipes.linkCopied'))
      }
    })
  }

  useEffect(() => { setDetailImgError(false) }, [recipe?.id])

  useEffect(() => {
    setToolbar?.(
      <>
        <Button variant="ghost" size="icon" onClick={() => onBackRef.current()} className="-ml-2">
          <ArrowLeft />
        </Button>
        <h1 className="flex-1 text-lg font-bold truncate">{recipe?.name ?? ''}</h1>
        {isAreaEnabled(areasConfig, 'todos') && (
          <Button data-testid="schedule-as-task-btn" variant="ghost" size="icon" onClick={() => setPlanOpen(true)}>
            <CalendarPlus className="h-5 w-5" />
          </Button>
        )}
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
  }, [recipe?.name, areasConfig])

  return (
    <div className="pb-10">
      {isAreaEnabled(areasConfig, 'todos') && (
        <PlanRecipeSheet open={planOpen} recipeName={recipe?.name ?? ''} onClose={() => setPlanOpen(false)} />
      )}

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
                {detailImgError ? '🖼️' : '🍽'}
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
                  setDetailImgError(true)
                }}
              />
            </div>
          )}

          {/* Title + badges */}
          <h1 className="text-2xl font-bold mb-3">{recipe.name}</h1>
          {(recipe.type || recipe.url) && (
            <div className="flex items-center gap-1.5 mb-6 flex-wrap">
              {recipe.type && <Badge>{recipe.type}</Badge>}
              {recipe.url && (
                <a
                  href={recipe.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ExternalLink className="size-3.5" />
                  {t('recipes.viewOriginal')}
                </a>
              )}
            </div>
          )}

          {/* Ingredients */}
          <div className="flex items-center gap-1 mb-3">
            <h2 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
              {t('recipes.ingredients')}
            </h2>
          </div>

          {ingredientsLoading ? (
            <div className="py-4 flex justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
            </div>
          ) : (ingredients ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">{t('recipes.noIngredients')}</p>
          ) : (
            <IngredientGroups ingredients={ingredients ?? []} toggle={toggle} allItems={allItems} showShoppingToggle={isAreaEnabled(areasConfig, 'shopping')} />
          )}

          {/* Instructions */}
          {recipe.blocks && recipe.blocks.length > 0 && (
            <>
              <div className="flex items-center gap-1 mb-3">
                <h2 className="text-sm font-semibold tracking-widest uppercase text-muted-foreground">
                  {t('recipes.instructions')}
                </h2>
              </div>
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
  const savedScrollRef = useRef<number | null>(null)

  if (id) {
    return <RecipeDetail id={id} onBack={() => navigate('/recipes')} setToolbar={setToolbar} />
  }

  return (
    <RecipeGrid
      onSelect={recipeId => {
        savedScrollRef.current = window.scrollY
        navigate(`/recipes/${recipeId}`)
      }}
      initialScroll={savedScrollRef.current}
      setHeader={setToolbar}
    />
  )
}
