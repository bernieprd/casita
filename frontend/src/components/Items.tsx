import { useState } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Fab from '@mui/material/Fab'
import Divider from '@mui/material/Divider'
import CircularProgress from '@mui/material/CircularProgress'
import Collapse from '@mui/material/Collapse'
import Button from '@mui/material/Button'
import Drawer from '@mui/material/Drawer'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogContent from '@mui/material/DialogContent'
import DialogActions from '@mui/material/DialogActions'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import AddIcon from '@mui/icons-material/Add'
import { useTheme } from '@mui/material/styles'
import useMediaQuery from '@mui/material/useMediaQuery'
import { useItems, useDeleteItem, flatItems } from '../api'
import type { Item } from '../api'
import ItemFormDialog from './ItemFormDialog'

type GroupBy = 'category' | 'supermarket' | 'none'

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, onEdit }: { item: Item; onEdit: (i: Item) => void }) {
  return (
    <ListItem disablePadding>
      <ListItemButton sx={{ pl: 2, pr: 2 }} onClick={() => onEdit(item)}>
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
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  label: string
  items: Item[]
  onEdit: (item: Item) => void
}

function GroupSection({ label, items, onEdit }: GroupSectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
      <ListItemButton onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1 }}>
        <ListItemText
          primary={
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
              {label}
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
              <ItemRow item={item} onEdit={onEdit} />
            </span>
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  item: Item | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirm({ item, onConfirm, onCancel }: DeleteConfirmProps) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'))

  if (isMobile) {
    return (
      <Drawer
        anchor="bottom"
        open={!!item}
        onClose={onCancel}
        PaperProps={{ sx: { borderRadius: '16px 16px 0 0' } }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'center', pt: 1.5, pb: 0.5 }}>
          <Box sx={{ width: 32, height: 4, borderRadius: 2, bgcolor: 'divider' }} />
        </Box>
        <Box sx={{ px: 3, pt: 1, pb: 3 }}>
          <Typography variant="h6" sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>
            Delete "{item?.name}"?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            This will permanently remove the item from your inventory.
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Button fullWidth variant="contained" color="error" onClick={onConfirm}>
              Delete
            </Button>
            <Button fullWidth color="inherit" onClick={onCancel}>
              Cancel
            </Button>
          </Box>
        </Box>
      </Drawer>
    )
  }

  return (
    <Dialog open={!!item} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Delete "{item?.name}"?</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary">
          This will permanently remove the item from your inventory.
        </Typography>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onCancel} color="inherit">Cancel</Button>
        <Button variant="contained" color="error" onClick={onConfirm}>Delete</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Items ─────────────────────────────────────────────────────────────────────

export default function Items() {
  const { data, isLoading, error, hasNextPage, fetchNextPage, isFetchingNextPage } = useItems()
  const deleteItem = useDeleteItem()
  const [editTarget, setEditTarget] = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [sortGroups, setSortGroups] = useState<'alpha' | 'count'>('alpha')

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

  const allItems = flatItems(data)
  const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

  let groups: Array<[string, Item[]]>

  if (groupBy === 'none') {
    groups = [['', [...allItems].sort(byName)]]
  } else {
    const groupMap: Record<string, Item[]> = {}
    for (const item of allItems) {
      if (groupBy === 'category') {
        const key = item.category ?? 'Other'
        ;(groupMap[key] ??= []).push(item)
      } else {
        const markets = item.supermarkets.length ? item.supermarkets : ['Other']
        for (const market of markets) {
          ;(groupMap[market] ??= []).push(item)
        }
      }
    }
    groups = Object.entries(groupMap)
      .sort(([a, ai], [b, bi]) => {
        if (a === 'Other') return 1
        if (b === 'Other') return -1
        return sortGroups === 'count' ? bi.length - ai.length : a.localeCompare(b)
      })
      .map(([label, groupItems]) => [label, [...groupItems].sort(byName)])
  }

  function handleDeleteRequest() {
    // Close edit first, then open confirm sheet
    const target = editTarget
    setEditTarget(null)
    setCreating(false)
    // Small delay so edit sheet finishes closing before confirm opens
    setTimeout(() => setDeleteTarget(target), 150)
  }

  function handleDeleteConfirm() {
    if (deleteTarget) deleteItem.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <Box sx={{ pb: 10 }}>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mb: 1.5 }}>
        {groupBy !== 'none' && (
          <ToggleButtonGroup
            value={sortGroups}
            exclusive
            size="small"
            onChange={(_, val) => { if (val) setSortGroups(val) }}
            aria-label="Sort groups by"
          >
            <ToggleButton value="alpha" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: 12 }}>
              A–Z
            </ToggleButton>
            <ToggleButton value="count" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: 12 }}>
              Count
            </ToggleButton>
          </ToggleButtonGroup>
        )}
        <ToggleButtonGroup
          value={groupBy}
          exclusive
          size="small"
          onChange={(_, val) => { if (val) setGroupBy(val) }}
          aria-label="Group items by"
        >
          <ToggleButton value="none" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: 12 }}>
            None
          </ToggleButton>
          <ToggleButton value="category" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: 12 }}>
            Category
          </ToggleButton>
          <ToggleButton value="supermarket" sx={{ px: 1.5, py: 0.5, textTransform: 'none', fontSize: 12 }}>
            Supermarket
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {groupBy === 'none'
        ? (
          <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)' }}>
            <List disablePadding>
              {groups[0][1].map((item, idx) => (
                <span key={item.id}>
                  {idx > 0 && <Divider component="li" sx={{ ml: 2 }} />}
                  <ItemRow item={item} onEdit={setEditTarget} />
                </span>
              ))}
            </List>
          </Box>
        )
        : groups.map(([label, groupItems]) => (
          <GroupSection
            key={label}
            label={label}
            items={groupItems}
            onEdit={setEditTarget}
          />
        ))
      }

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
        onDeleteRequest={editTarget ? handleDeleteRequest : undefined}
      />

      <DeleteConfirm
        item={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
    </Box>
  )
}
