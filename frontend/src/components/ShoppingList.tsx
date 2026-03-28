import { useState, useCallback } from 'react'
import Fab from '@mui/material/Fab'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import QuickAddDialog from './QuickAddDialog'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import CircularProgress from '@mui/material/CircularProgress'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useShoppingList, useToggleShoppingList } from '../api'
import type { Item } from '../api'

// How long the Collapse exit animation plays before mutate fires.
const EXIT_DURATION_MS = 220

// ── Category section ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  items: Item[]
  removingIds: Set<string>
  onRemove: (id: string) => void
}

function CategorySection({ category, items, removingIds, onRemove }: CategorySectionProps) {
  const [open, setOpen] = useState(true)

  // Count only items not yet being removed for the badge
  const visibleCount = items.filter(i => !removingIds.has(i.id)).length

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
      <ListItemButton onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1.25 }}>
        <ListItemText
          primary={
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
              {category}
            </Typography>
          }
        />
        <Typography variant="caption" color="text.disabled" sx={{ mr: 1 }}>
          {visibleCount}
        </Typography>
        {open ? <ExpandLess fontSize="small" sx={{ color: 'text.disabled' }} />
               : <ExpandMore fontSize="small" sx={{ color: 'text.disabled' }} />}
      </ListItemButton>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider />
        <List disablePadding>
          {items.map((item, idx) => (
            <Collapse
              key={item.id}
              in={!removingIds.has(item.id)}
              timeout={EXIT_DURATION_MS}
              unmountOnExit
            >
              {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
              <ListItemButton
                onClick={() => onRemove(item.id)}
                sx={{ px: 2, py: 1 }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox
                    edge="start"
                    checked
                    color="primary"
                    tabIndex={-1}
                    inputProps={{ 'aria-label': `Remove ${item.name} from shopping list` }}
                  />
                </ListItemIcon>
                <ListItemText
                  primary={item.name}
                  secondary={item.supermarkets.length ? item.supermarkets.join(', ') : undefined}
                  primaryTypographyProps={{ variant: 'body1' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            </Collapse>
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

// ── ShoppingList ──────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const { data: items, isLoading, error } = useShoppingList()
  const toggle = useToggleShoppingList()

  // IDs currently mid-exit-animation. Removed from the visible count but still
  // rendered inside <Collapse in={false}> so the exit animation plays before
  // the React Query cache update removes them from `items`.
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [quickAddOpen, setQuickAddOpen] = useState(false)

  const handleRemove = useCallback((id: string) => {
    setRemovingIds(prev => new Set(prev).add(id))
    // Fire the mutation after the exit animation so the item collapses first,
    // then React Query removes it from the cache cleanly.
    setTimeout(() => {
      toggle.mutate({ id, onShoppingList: false })
      setRemovingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }, EXIT_DURATION_MS + 50)
  }, [toggle])

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  if (error) {
    return (
      <Typography color="error" sx={{ p: 2 }}>
        Failed to load shopping list.
      </Typography>
    )
  }

  // Include removing items in byCategory so their Collapse exit animation plays
  const byCategory = (items ?? []).reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category ?? 'Other'
    ;(acc[cat] ??= []).push(item)
    return acc
  }, {})

  const categories = Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b))
  const totalVisible = (items ?? []).filter(i => !removingIds.has(i.id)).length

  if (totalVisible === 0 && !isLoading) {
    return (
      <Box sx={{ pt: 8, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Nothing on the shopping list.
        </Typography>
      </Box>
    )
  }

  return (
    <Box sx={{ pb: 10 }}>
      {categories.map(([cat, catItems]) => (
        <CategorySection
          key={cat}
          category={cat}
          items={catItems}
          removingIds={removingIds}
          onRemove={handleRemove}
        />
      ))}

      <Fab
        color="primary"
        aria-label="Add to shopping list"
        onClick={() => setQuickAddOpen(true)}
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
      >
        <AddIcon />
      </Fab>

      <QuickAddDialog open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </Box>
  )
}
