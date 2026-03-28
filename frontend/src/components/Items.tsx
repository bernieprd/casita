import { useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Chip from '@mui/material/Chip'
import Fab from '@mui/material/Fab'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import { useItems, useDeleteItem, flatItems } from '../api'
import type { Item } from '../api'
import ItemFormDialog from './ItemFormDialog'

// ── Category section ──────────────────────────────────────────────────────────

interface CategorySectionProps {
  category: string
  items: Item[]
  onEdit: (item: Item) => void
  onDelete: (id: string) => void
}

function CategorySection({ category, items, onEdit, onDelete }: CategorySectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
      <ListItemButton onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1 }}>
        <ListItemText
          primary={
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
              {category}
            </Typography>
          }
        />
        <Typography variant="caption" color="text.disabled" sx={{ mr: 1 }}>{items.length}</Typography>
        {open
          ? <ExpandLess fontSize="small" sx={{ color: 'text.disabled' }} />
          : <ExpandMore fontSize="small" sx={{ color: 'text.disabled' }} />}
      </ListItemButton>

      <Collapse in={open} timeout="auto" unmountOnExit>
        <Divider />
        <List disablePadding>
          {items.map((item, idx) => (
            <span key={item.id}>
              {idx > 0 && <Divider component="li" sx={{ ml: 2 }} />}
              <ListItem
                disablePadding
                secondaryAction={
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton size="small" edge="end" onClick={() => onEdit(item)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" edge="end" onClick={() => onDelete(item.id)}
                      sx={{ color: 'error.light' }}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                }
              >
                <ListItemButton sx={{ pl: 2, pr: 12 }}>
                  <ListItemText
                    primary={item.name}
                    secondary={
                      <Box component="span" sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                        {item.category && (
                          <Chip label={item.category} size="small" variant="outlined"
                            sx={{ fontSize: 11, height: 20 }} />
                        )}
                        {item.supermarkets.map(s => (
                          <Chip key={s} label={s} size="small"
                            sx={{ fontSize: 11, height: 20, bgcolor: 'action.hover' }} />
                        ))}
                      </Box>
                    }
                    secondaryTypographyProps={{ component: 'span' }}
                  />
                </ListItemButton>
              </ListItem>
            </span>
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

// ── Items ─────────────────────────────────────────────────────────────────────

export default function Items() {
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useItems()
  const deleteItem = useDeleteItem()

  const [editTarget, setEditTarget] = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', pt: 6 }}>
        <CircularProgress color="primary" />
      </Box>
    )
  }

  if (error) {
    return <Typography color="error" sx={{ p: 2 }}>Failed to load items.</Typography>
  }

  const items = flatItems(data)
  const byCategory = items.reduce<Record<string, Item[]>>((acc, item) => {
    const cat = item.category ?? 'Other'
    ;(acc[cat] ??= []).push(item)
    return acc
  }, {})

  return (
    <Box sx={{ pb: 10 }}>
      {Object.entries(byCategory)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([cat, catItems]) => (
          <CategorySection
            key={cat}
            category={cat}
            items={catItems}
            onEdit={setEditTarget}
            onDelete={id => deleteItem.mutate(id)}
          />
        ))}

      {hasNextPage && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
          <Button
            variant="outlined"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            startIcon={isFetchingNextPage ? <CircularProgress size={14} color="inherit" /> : undefined}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </Box>
      )}

      <Fab
        color="primary"
        aria-label="Add item"
        onClick={() => setCreating(true)}
        sx={{ position: 'fixed', bottom: 24, right: 24 }}
      >
        <AddIcon />
      </Fab>

      <ItemFormDialog
        open={creating || editTarget !== null}
        item={editTarget}
        onClose={() => { setCreating(false); setEditTarget(null) }}
      />
    </Box>
  )
}
