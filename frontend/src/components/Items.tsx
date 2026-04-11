import { useState, useMemo } from 'react'
import Box from '@mui/material/Box'
import List from '@mui/material/List'
import ListItem from '@mui/material/ListItem'
import ListItemText from '@mui/material/ListItemText'
import ListItemButton from '@mui/material/ListItemButton'
import Typography from '@mui/material/Typography'
import Chip from '@mui/material/Chip'
import Fab from '@mui/material/Fab'
import Divider from '@mui/material/Divider'
import Skeleton from '@mui/material/Skeleton'
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
import { useItems, useDeleteItem } from '../api'
import type { Item } from '../api'
import ItemFormDialog from './ItemFormDialog'
import MergeDuplicatesSheet from './MergeDuplicatesSheet'

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

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ItemsSkeleton() {
  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1.5 }}>
        <Skeleton width={220} height={32} sx={{ borderRadius: 1 }} />
      </Box>
      {[5, 3].map((rows, gi) => (
        <Box key={gi} sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
          <Box sx={{ px: 2, py: 1 }}>
            <Skeleton width={100} height={14} />
          </Box>
          <Divider />
          {Array.from({ length: rows }).map((_, i) => (
            <Box key={i}>
              {i > 0 && <Divider sx={{ ml: 2 }} />}
              <Box sx={{ px: 2, py: 1.25 }}>
                <Skeleton width="50%" height={16} />
                <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5 }}>
                  <Skeleton width={64} height={20} sx={{ borderRadius: 10 }} />
                  <Skeleton width={72} height={20} sx={{ borderRadius: 10 }} />
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ── Items ─────────────────────────────────────────────────────────────────────

export default function Items() {
  const { data, isLoading, error } = useItems()
  const deleteItem = useDeleteItem()
  const [editTarget, setEditTarget] = useState<Item | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [sortGroups, setSortGroups] = useState<'alpha' | 'count'>('alpha')
  const [mergeSheetOpen, setMergeSheetOpen] = useState(false)

  const allItems = data ?? []

  const duplicateGroups = useMemo(() => {
    const map = new Map<string, typeof allItems>()
    for (const item of allItems) {
      const key = item.name.toLowerCase().trim()
      const group = map.get(key) ?? []
      group.push(item)
      map.set(key, group)
    }
    return Array.from(map.values()).filter(g => g.length > 1)
  }, [allItems])

  if (isLoading) return <ItemsSkeleton />

  if (error) {
    return <Typography color="error" sx={{ p: 2 }}>Failed to load items.</Typography>
  }

  if (allItems.length === 0) {
    return (
      <>
        <Box sx={{ pt: 10, textAlign: 'center', px: 4 }}>
          <Box component="img" src="/casita.png" alt="" sx={{ width: 80, mb: 2, opacity: 0.7 }} />
          <Typography variant="body1" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
            No items yet
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Tap + to add your first inventory item
          </Typography>
        </Box>
        <Fab color="primary" aria-label="Add item" onClick={() => setCreating(true)}
          sx={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 24 }}>
          <AddIcon />
        </Fab>
        <ItemFormDialog
          open={creating || editTarget !== null}
          item={editTarget}
          onClose={() => { setCreating(false); setEditTarget(null) }}
          onDeleteRequest={editTarget ? handleDeleteRequest : undefined}
        />
        <DeleteConfirm item={deleteTarget} onConfirm={handleDeleteConfirm} onCancel={() => setDeleteTarget(null)} />
      </>
    )
  }

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
      {duplicateGroups.length > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          bgcolor: 'warning.main', color: 'warning.contrastText',
          borderRadius: 2, px: 2, py: 1, mb: 1.5, opacity: 0.9,
        }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {duplicateGroups.length === 1
              ? '1 duplicate name found'
              : `${duplicateGroups.length} duplicate names found`}
          </Typography>
          <Button
            size="small"
            sx={{ color: 'warning.contrastText', fontWeight: 600, ml: 1 }}
            onClick={() => setMergeSheetOpen(true)}
          >
            Review
          </Button>
        </Box>
      )}
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

      <Fab
        color="primary"
        aria-label="Add item"
        onClick={() => setCreating(true)}
        sx={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 24 }}
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

      <MergeDuplicatesSheet
        open={mergeSheetOpen}
        groups={duplicateGroups}
        onClose={() => setMergeSheetOpen(false)}
      />
    </Box>
  )
}
