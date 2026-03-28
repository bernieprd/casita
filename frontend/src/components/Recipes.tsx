import { useState } from 'react'
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
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import { useRecipes, useRecipe, useRecipeIngredients, useToggleNeedsShopping } from '../api'
import type { Block } from '../api'

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

  if (isLoading) return <RecipeGridSkeleton />
  if (error) return <Typography color="error" sx={{ p: 2 }}>Failed to load recipes.</Typography>
  if (!recipes?.length) {
    return (
      <Box sx={{ pt: 10, textAlign: 'center', px: 4 }}>
        <Box sx={{ fontSize: 52, mb: 2, opacity: 0.35 }}>🍽</Box>
        <Typography variant="body1" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
          No recipes yet
        </Typography>
        <Typography variant="body2" color="text.disabled">
          Add recipes to your Notion database to see them here
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 1.5 }}>
      {recipes.map(recipe => (
        <Box
          key={recipe.id}
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
          {recipe.coverPhotoUrl ? (
            <Box
              component="img"
              src={recipe.coverPhotoUrl}
              alt={recipe.name}
              loading="lazy"
              sx={{ width: '100%', aspectRatio: '4/3', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <Box sx={{ width: '100%', aspectRatio: '4/3', bgcolor: 'action.hover', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>
              🍽
            </Box>
          )}
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
  )
}

// ── Recipe detail ─────────────────────────────────────────────────────────────

function RecipeDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { data: recipe, isLoading: recipeLoading } = useRecipe(id)
  const { data: ingredients, isLoading: ingredientsLoading } = useRecipeIngredients(id)
  const toggle = useToggleNeedsShopping(id)

  return (
    <Box sx={{ pb: 10 }}>
      {/* Back nav */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 2, mx: -0.5 }}>
        <IconButton onClick={onBack} size="small">
          <ArrowBackIcon fontSize="small" />
        </IconButton>
        <Typography
          variant="body2"
          color="text.secondary"
          onClick={onBack}
          sx={{ cursor: 'pointer' }}
        >
          Recipes
        </Typography>
      </Box>

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
            <Box
              component="img"
              src={recipe.coverPhotoUrl}
              alt={recipe.name}
              sx={{ width: '100%', aspectRatio: '16/9', objectFit: 'cover', borderRadius: 2, display: 'block', mb: 2 }}
            />
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
            <List disablePadding dense sx={{ mb: 3 }}>
              {(ingredients ?? []).map((ing, idx) => (
                <span key={ing.id}>
                  {idx > 0 && <Divider component="li" />}
                  <ListItem
                    disableGutters
                    secondaryAction={
                      <IconButton
                        size="small"
                        edge="end"
                        onClick={() => toggle.mutate({
                          id: ing.id,
                          needsShopping: !ing.needsShopping,
                          itemId: ing.itemId,
                          itemName: ing.itemName,
                        })}
                        color={ing.needsShopping ? 'primary' : 'default'}
                        sx={{ opacity: ing.needsShopping ? 1 : 0.35 }}
                      >
                        <ShoppingCartIcon fontSize="small" />
                      </IconButton>
                    }
                  >
                    <ListItemText
                      primary={ing.itemName}
                      secondary={ing.quantity ?? undefined}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                      sx={{ pr: 5 }}
                    />
                  </ListItem>
                </span>
              ))}
            </List>
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
    </Box>
  )
}

// ── Recipes ───────────────────────────────────────────────────────────────────

export default function Recipes() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  if (selectedId) {
    return <RecipeDetail id={selectedId} onBack={() => setSelectedId(null)} />
  }

  return <RecipeGrid onSelect={setSelectedId} />
}
