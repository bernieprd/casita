import { useParams } from 'react-router-dom'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Divider from '@mui/material/Divider'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import { usePublicRecipe } from '../api'
import type { Block, RecipeIngredient } from '../api'
import { useMemo } from 'react'

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
                <ListItem disableGutters>
                  <ListItemText
                    primary={ing.itemName}
                    secondary={ing.quantity ?? undefined}
                    primaryTypographyProps={{ variant: 'body2' }}
                    secondaryTypographyProps={{ variant: 'caption' }}
                  />
                </ListItem>
              </span>
            ))}
          </List>
        </Box>
      ))}
    </Box>
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
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
        <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 3, pb: 6 }}>
          <Skeleton variant="rectangular" sx={{ width: '100%', aspectRatio: '16/9', borderRadius: 2, mb: 2 }} />
          <Skeleton width="70%" height={36} sx={{ mb: 1 }} />
          <Box sx={{ display: 'flex', gap: 0.75, mb: 3 }}>
            <Skeleton width={72} height={26} sx={{ borderRadius: 10 }} />
            <Skeleton width={60} height={26} sx={{ borderRadius: 10 }} />
          </Box>
          <Skeleton width={100} height={14} sx={{ mb: 0.5 }} />
          <Skeleton variant="rectangular" height={1} sx={{ mb: 1 }} />
          <Stack spacing={1}>
            {[1, 2, 3, 4].map(i => <Skeleton key={i} height={40} />)}
          </Stack>
        </Box>
      </Box>
    )
  }

  if (error || !recipe) {
    return (
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Typography variant="body1" color="text.secondary">Recipe not found</Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 3, pb: 6 }}>

        {/* Cover photo */}
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
              loading="lazy"
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

        {/* Title + chips */}
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
        {ingredients.length > 0 && (
          <>
            <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: '.08em' }}>
              Ingredients
            </Typography>
            <Divider sx={{ mt: 0.5, mb: 0.5 }} />
            <StaticIngredientGroups ingredients={ingredients} />
          </>
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

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 4 }}>
          Made with Casita
        </Typography>
      </Box>
    </Box>
  )
}
