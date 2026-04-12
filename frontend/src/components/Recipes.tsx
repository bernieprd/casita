import { useState, useMemo, useEffect, useRef, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import CircularProgress from '@mui/material/CircularProgress'
import Skeleton from '@mui/material/Skeleton'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import IconButton from '@mui/material/IconButton'
import Button from '@mui/material/Button'
import TextField from '@mui/material/TextField'
import InputAdornment from '@mui/material/InputAdornment'
import Fab from '@mui/material/Fab'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import EditIcon from '@mui/icons-material/Edit'
import AddIcon from '@mui/icons-material/Add'
import RefreshIcon from '@mui/icons-material/Refresh'
import SearchIcon from '@mui/icons-material/Search'
import { useRecipes, useRecipe, useRecipeIngredients, useToggleNeedsShopping, recipeKeys } from '../api'
import { useQueryClient } from '@tanstack/react-query'
import type { Block, RecipeWithBlocks, RecipeIngredient } from '../api'
import RecipeFormSheet from './RecipeFormSheet'

// ── Block renderer ────────────────────────────────────────────────────────────

function RenderBlock({ block }: { block: Block }) {
  switch (block.type) {
    case 'heading_1':
      return <Typography variant="h6" fontWeight={700} sx={{ mt: 2.5, mb: 0.5 }}>{block.text}</Typography>
    case 'heading_2':
      return <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 2, mb: 0.5 }}>{block.text}</Typography>
    case 'heading_3':
      return <Typography variant="subtitle2" fontWeight={600} sx={{ mt: 1.5, mb: 0.5 }}>{block.text}</Typography>
    case 'bulleted_list_item':
      return <Typography variant="body2" sx={{ pl: 2, mb: 0.5 }}>• {block.text}</Typography>
    case 'numbered_list_item':
      return <Typography variant="body2" sx={{ pl: 2, mb: 0.5 }}>{block.text}</Typography>
    case 'divider':
      return <Divider sx={{ my: 2 }} />
    case 'paragraph':
    default:
      return block.text
        ? <Typography variant="body2" color="text.secondary" sx={{ mb: 1, lineHeight: 1.6 }}>{block.text}</Typography>
        : <Box sx={{ height: 6 }} />
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function RecipeGridSkeleton() {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
      {[0, 1, 2, 3].map(i => (
        <Box key={i} sx={{ borderRadius: 2, overflow: 'hidden', bgcolor: 'background.paper', boxShadow: '0 1px 3px rgba(0,0,0,.08)' }}>
          <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '4/3' }} />
          <Box sx={{ p: 1.25 }}>
            <Skeleton width="80%" height={16} sx={{ mb: 0.75 }} />
            <Skeleton width="45%" height={14} />
          </Box>
        </Box>
      ))}
    </Box>
  )
}

// ── Recipe grid ───────────────────────────────────────────────────────────────

function RecipeGrid({ onSelect }: { onSelect: (id: string) => void }) {
  const { data: recipes, isLoading, error } = useRecipes()
  const [search, setSearch] = useState('')
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
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

  // Shared elements rendered across all non-loading/error paths
  const fab = (
    <Fab
      color="primary"
      aria-label="New recipe"
      onClick={() => setCreateOpen(true)}
      sx={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 24 }}
    >
      <AddIcon />
    </Fab>
  )

  const sheet = (
    <RecipeFormSheet
      open={createOpen}
      onClose={() => setCreateOpen(false)}
      onSaved={id => { setToastMsg('Recipe created'); if (id) setScrollToId(id) }}
    />
  )

  const toast = (
    <Snackbar
      open={!!toastMsg}
      autoHideDuration={3000}
      onClose={() => setToastMsg(null)}
      anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
    >
      <Alert severity="success" onClose={() => setToastMsg(null)} sx={{ width: '100%' }}>
        {toastMsg}
      </Alert>
    </Snackbar>
  )

  if (isLoading) return <RecipeGridSkeleton />
  if (error) return <Typography color="error" sx={{ p: 2 }}>Failed to load recipes.</Typography>

  if (!recipes?.length) {
    return (
      <>
        <Box sx={{ pt: 10, textAlign: 'center', px: 4 }}>
          <Box component="img" src="/casita.png" alt="" sx={{ width: 80, mb: 2, opacity: 0.7 }} />
          <Typography variant="body1" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
            No recipes yet
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Tap + to add your first recipe
          </Typography>
        </Box>
        {fab}{sheet}{toast}
      </>
    )
  }

  return (
    <Box>
      {/* Sticky search bar — flush with AppBar, full viewport width */}
      <Box
        sx={{
          position: 'sticky',
          top: { xs: '57px', sm: '65px' },
          ml: 'calc(50% - 50vw)',
          width: '100vw',
          mt: -2,
          zIndex: 10,
          mb: 1.5,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 1.5 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="Search recipes…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Box>
      </Box>

      {/* Type filter chips */}
      {typeOptions.length > 0 && (
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {typeOptions.map(type => (
            <Chip
              key={type}
              label={type}
              size="small"
              color={selectedType === type ? 'primary' : 'default'}
              variant={selectedType === type ? 'filled' : 'outlined'}
              onClick={() => setSelectedType(prev => prev === type ? null : type)}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}

      {/* Result count */}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
        {isFiltering
          ? `${filtered.length} result${filtered.length !== 1 ? 's' : ''}`
          : `${recipes.length} recipe${recipes.length !== 1 ? 's' : ''}`}
      </Typography>

      {/* Empty state (filter miss) */}
      {filtered.length === 0 ? (
        <Box sx={{ pt: 8, textAlign: 'center', px: 4 }}>
          <Box sx={{ fontSize: 52, mb: 2, opacity: 0.35 }}>🔍</Box>
          <Typography variant="body1" fontWeight={500} color="text.secondary">
            No recipes match
          </Typography>
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
          {filtered.map(recipe => (
            <Box
              key={recipe.id}
              id={`recipe-card-${recipe.id}`}
              onClick={() => onSelect(recipe.id)}
              sx={{
                cursor: 'pointer',
                borderRadius: 2,
                overflow: 'hidden',
                bgcolor: 'background.paper',
                boxShadow: '0 1px 3px rgba(0,0,0,.08)',
                transition: 'opacity .15s',
                '&:active': { opacity: 0.75 },
              }}
            >
              <Box sx={{ position: 'relative', width: '100%', aspectRatio: '4/3' }}>
                {/* Emoji fallback — always behind; shows when there's no URL or the image errors */}
                <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
                  🍽
                </Box>
                {recipe.coverPhotoUrl && (
                  <>
                    <Skeleton
                      variant="rectangular"
                      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }}
                    />
                    <Box
                      component="img"
                      src={recipe.coverPhotoUrl}
                      alt={recipe.name}
                      loading="lazy"
                      decoding="async"
                      sx={{
                        position: 'absolute', inset: 0,
                        width: '100%', height: '100%',
                        objectFit: 'cover', display: 'block',
                        opacity: 0, transition: 'opacity .25s', zIndex: 2,
                      }}
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
              </Box>
              <Box sx={{ p: 1.25 }}>
                <Typography variant="body2" fontWeight={600} sx={{ lineHeight: 1.3, mb: 0.75 }}>
                  {recipe.name}
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {recipe.type && (
                    <Chip label={recipe.type} size="small" color="primary" variant="filled"
                      sx={{ fontSize: 10, height: 18 }} />
                  )}
                  {recipe.day && (
                    <Chip label={recipe.day} size="small" variant="outlined"
                      sx={{ fontSize: 10, height: 18 }} />
                  )}
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      )}

      {fab}{sheet}{toast}
    </Box>
  )
}

// ── Ingredient groups ─────────────────────────────────────────────────────────

type ToggleMutation = ReturnType<typeof useToggleNeedsShopping>

function IngredientGroups({
  ingredients,
  toggle,
}: {
  ingredients: RecipeIngredient[]
  toggle: ToggleMutation
}) {
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
    <Box sx={{ mb: 3 }}>
      {groups.map(({ section, items }, groupIdx) => (
        <Box key={section ?? '__none__'}>
          {groupIdx > 0 && <Divider sx={{ mt: 2, mb: 2 }} />}
          {section && (
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ display: 'block', mb: 0.25, fontSize: 10, letterSpacing: '.1em' }}
            >
              {section}
            </Typography>
          )}
          <List disablePadding dense>
            {items.map((ing, idx) => (
              <span key={ing.id}>
                {idx > 0 && <Divider component="li" />}
                <ListItem
                  disableGutters
                  secondaryAction={
                    ing.needsShopping ? (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={() => toggle.mutate({
                          id: ing.id,
                          needsShopping: false,
                          itemId: ing.itemId,
                          itemName: ing.itemName,
                        })}
                      >
                        Added to list
                      </Button>
                    ) : (
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => toggle.mutate({
                          id: ing.id,
                          needsShopping: true,
                          itemId: ing.itemId,
                          itemName: ing.itemName,
                        })}
                      >
                        Add to list
                      </Button>
                    )
                  }
                >
                  <ListItemText
                    primary={ing.itemName}
                    secondary={ing.quantity ?? undefined}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                    sx={{ pr: 16 }}
                  />
                </ListItem>
              </span>
            ))}
          </List>
          {groupIdx < groups.length - 1 && <Divider sx={{ mt: 0.5 }} />}
        </Box>
      ))}
    </Box>
  )
}

// ── Recipe detail ─────────────────────────────────────────────────────────────

function RecipeDetail({ id, onBack, setToolbar }: { id: string; onBack: () => void; setToolbar?: (node: ReactNode | null) => void }) {
  const { data: recipe, isLoading: recipeLoading } = useRecipe(id)
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(id)
  const toggle = useToggleNeedsShopping(id)
  const [editOpen, setEditOpen] = useState(false)
  const [toastOpen, setToastOpen] = useState(false)
  const qc = useQueryClient()
  const onBackRef = useRef(onBack)
  onBackRef.current = onBack

  useEffect(() => {
    setToolbar?.(
      <>
        <IconButton onClick={() => onBackRef.current()} size="small" color="inherit" edge="start">
          <ArrowBackIcon />
        </IconButton>
        <Typography
          variant="body1"
          color="text.secondary"
          onClick={() => onBackRef.current()}
          sx={{ cursor: 'pointer', flex: 1, ml: 0.5 }}
        >
          Recipes
        </Typography>
        <IconButton size="small" color="inherit" onClick={() => setEditOpen(true)}>
          <EditIcon />
        </IconButton>
        <IconButton size="small" color="inherit" onClick={() => qc.invalidateQueries({ queryKey: recipeKeys.all })}>
          <RefreshIcon />
        </IconButton>
      </>
    )
    return () => setToolbar?.(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <Box sx={{ pb: 10 }}>

      {recipeLoading && !recipe ? (
        <>
          <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '16/9', borderRadius: 2, mb: 2 }} />
          <Skeleton width="70%" height={32} sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
            <Skeleton width={72} height={26} sx={{ borderRadius: 10 }} />
            <Skeleton width={60} height={26} sx={{ borderRadius: 10 }} />
          </Box>
          <Skeleton width={100} height={14} sx={{ mb: 0.5 }} />
          <Skeleton variant="rectangular" height={1} sx={{ mb: 1 }} />
          {[1, 2, 3, 4].map(i => <Skeleton key={i} height={40} sx={{ mb: 0.5 }} />)}
        </>
      ) : recipe && (
        <>
          {/* Cover */}
          {recipe.coverPhotoUrl && (
            <Box sx={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
              <Box sx={{ position: 'absolute', inset: 0, bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52 }}>
                🍽
              </Box>
              <Skeleton variant="rectangular" sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 1 }} />
              <Box
                component="img"
                src={recipe.coverPhotoUrl}
                alt={recipe.name}
                decoding="async"
                sx={{
                  position: 'absolute', inset: 0,
                  width: '100%', height: '100%',
                  objectFit: 'cover', display: 'block',
                  opacity: 0, transition: 'opacity .25s', zIndex: 2,
                }}
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
            </Box>
          )}

          {/* Title + badges */}
          <Typography variant="h5" fontWeight={700} sx={{ mb: 1 }}>
            {recipe.name}
          </Typography>
          {(recipe.type || recipe.day) && (
            <Box sx={{ display: 'flex', gap: 0.75, mb: 3, flexWrap: 'wrap' }}>
              {recipe.type && <Chip label={recipe.type} size="small" color="primary" />}
              {recipe.day && <Chip label={recipe.day} size="small" variant="outlined" />}
            </Box>
          )}

          {/* Ingredients */}
          <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '.08em' }}>
            Ingredients
          </Typography>
          <Divider sx={{ mt: 0.5, mb: 0.5 }} />

          {ingredientsLoading ? (
            <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress size={20} />
            </Box>
          ) : (ingredients ?? []).length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
              No ingredients listed.
            </Typography>
          ) : (
            <IngredientGroups ingredients={ingredients ?? []} toggle={toggle} />
          )}

          {/* Instructions */}
          {recipe.blocks && recipe.blocks.length > 0 && (
            <>
              <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '.08em' }}>
                Instructions
              </Typography>
              <Divider sx={{ mt: 0.5, mb: 1 }} />
              <Box>
                {recipe.blocks.map(block => (
                  <RenderBlock key={block.id} block={block} />
                ))}
              </Box>
            </>
          )}
        </>
      )}

      {/* Edit sheet — only mount when we have full data */}
      {recipe && (
        <RecipeFormSheet
          open={editOpen}
          recipeId={id}
          initialData={{
            recipe: recipe as RecipeWithBlocks,
            ingredients: ingredients ?? [] as RecipeIngredient[],
          }}
          onClose={() => setEditOpen(false)}
          onSaved={() => setToastOpen(true)}
        />
      )}

      <Snackbar
        open={toastOpen}
        autoHideDuration={3000}
        onClose={() => setToastOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert severity="success" onClose={() => setToastOpen(false)} sx={{ width: '100%' }}>
          Recipe saved
        </Alert>
      </Snackbar>
    </Box>
  )
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export default function Recipes({
  initialRecipeId,
  onInitialRecipeIdConsumed,
  setToolbar,
}: {
  initialRecipeId?: string | null
  onInitialRecipeIdConsumed?: () => void
  setToolbar?: (node: ReactNode | null) => void
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialRecipeId ?? null)

  // Tell the parent the deep-link was consumed so it won't reuse it on next mount
  useState(() => {
    if (initialRecipeId) onInitialRecipeIdConsumed?.()
  })

  if (selectedId) {
    return <RecipeDetail id={selectedId} onBack={() => setSelectedId(null)} setToolbar={setToolbar} />
  }

  return <RecipeGrid onSelect={setSelectedId} />
}
