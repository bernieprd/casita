import { useState, useCallback, useRef, useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import ItemFormDialog from './ItemFormDialog'
import IncompleteItemsSheet from './IncompleteItemsSheet'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListItemIcon from '@mui/material/ListItemIcon'
import Checkbox from '@mui/material/Checkbox'
import Collapse from '@mui/material/Collapse'
import Divider from '@mui/material/Divider'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import ExpandLess from '@mui/icons-material/ExpandLess'
import ExpandMore from '@mui/icons-material/ExpandMore'
import { useShoppingList, useToggleShoppingList } from '../api'
import type { Item } from '../api'

// How long the Collapse exit animation plays before mutate fires.
const EXIT_DURATION_MS = 220

// ── Long press hook ───────────────────────────────────────────────────────────

function useLongPress(onLongPress: () => void, delay = 500) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  function start(e: React.PointerEvent) {
    startPos.current = { x: e.clientX, y: e.clientY }
    fired.current = false
    timer.current = setTimeout(() => {
      fired.current = true
      onLongPress()
    }, delay)
  }

  function cancel() {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }

  function move(e: React.PointerEvent) {
    if (!startPos.current) return
    const dx = Math.abs(e.clientX - startPos.current.x)
    const dy = Math.abs(e.clientY - startPos.current.y)
    if (dx > 10 || dy > 10) cancel()
  }

  return {
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerMove: move,
    },
    didFire: () => fired.current,
  }
}

// ── Shopping item row ─────────────────────────────────────────────────────────

interface ShoppingItemRowProps {
  item: Item
  removing: boolean
  onRemove: (id: string) => void
  onEdit: (item: Item) => void
}

function ShoppingItemRow({ item, removing, onRemove, onEdit }: ShoppingItemRowProps) {
  const { handlers, didFire } = useLongPress(() => onEdit(item))

  return (
    <Collapse in={!removing} timeout={EXIT_DURATION_MS} unmountOnExit>
      <ListItemButton
        {...handlers}
        onClick={() => { if (!didFire()) onRemove(item.id) }}
        sx={{ px: 2, py: 1, userSelect: 'none' }}
      >
        <ListItemIcon sx={{ minWidth: 40 }}>
          <Checkbox
            edge="start"
            checked={false}
            color="primary"
            tabIndex={-1}
            inputProps={{ 'aria-label': `Mark ${item.name} as bought` }}
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
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  label: string
  items: Item[]
  removingIds: Set<string>
  onRemove: (id: string) => void
  onEdit: (item: Item) => void
}

function GroupSection({ label, items, removingIds, onRemove, onEdit }: GroupSectionProps) {
  const [open, setOpen] = useState(true)

  const visibleCount = items.filter(i => !removingIds.has(i.id)).length

  return (
    <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
      <ListItemButton onClick={() => setOpen(o => !o)} sx={{ px: 2, py: 1.25 }}>
        <ListItemText
          primary={
            <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1, letterSpacing: '.08em' }}>
              {label}
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
            <span key={item.id}>
              {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
              <ShoppingItemRow
                item={item}
                removing={removingIds.has(item.id)}
                onRemove={onRemove}
                onEdit={onEdit}
              />
            </span>
          ))}
        </List>
      </Collapse>
    </Box>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ShoppingListSkeleton() {
  return (
    <Box>
      {[3, 2].map((rows, gi) => (
        <Box key={gi} sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden', boxShadow: '0 1px 2px rgba(0,0,0,.06)', mb: 1 }}>
          <Box sx={{ px: 2, py: 1.25 }}>
            <Skeleton width={90} height={14} />
          </Box>
          <Divider />
          {Array.from({ length: rows }).map((_, i) => (
            <Box key={i}>
              {i > 0 && <Divider sx={{ ml: 7 }} />}
              <Box sx={{ px: 2, py: 1, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Skeleton variant="circular" width={20} height={20} />
                <Box sx={{ flex: 1 }}>
                  <Skeleton width="55%" height={16} />
                  <Skeleton width="28%" height={12} sx={{ mt: 0.5 }} />
                </Box>
              </Box>
            </Box>
          ))}
        </Box>
      ))}
    </Box>
  )
}

// ── ShoppingList ──────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const { data: items, isLoading, error } = useShoppingList()
  const toggle = useToggleShoppingList()
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [selectedSupermarkets, setSelectedSupermarkets] = useState<Set<string>>(new Set())
  const [incompleteSheetOpen, setIncompleteSheetOpen] = useState(false)

  const allItems = items ?? []

  const allSupermarkets = useMemo(() =>
    [...new Set(allItems.flatMap(i => i.supermarkets))].sort(),
  [allItems])

  const incompleteItems = useMemo(() =>
    allItems.filter(i => i.category === null || i.supermarkets.length === 0),
  [allItems])

  const handleRemove = useCallback((id: string) => {
    setRemovingIds(prev => new Set(prev).add(id))
    setTimeout(() => {
      toggle.mutate({ id, onShoppingList: false })
      setRemovingIds(prev => { const s = new Set(prev); s.delete(id); return s })
    }, EXIT_DURATION_MS + 50)
  }, [toggle])

  if (isLoading) return <ShoppingListSkeleton />

  if (error) {
    return <Typography color="error" sx={{ p: 2 }}>Failed to load shopping list.</Typography>
  }

  const totalVisible = allItems.filter(i => !removingIds.has(i.id)).length

  if (totalVisible === 0) {
    return (
      <>
        <Box sx={{ pt: 10, textAlign: 'center', px: 4 }}>
          <Box component="img" src="/casita.png" alt="" sx={{ width: 80, mb: 2, opacity: 0.7 }} />
          <Typography variant="body1" fontWeight={500} color="text.secondary" sx={{ mb: 0.5 }}>
            Your list is empty
          </Typography>
          <Typography variant="body2" color="text.disabled">
            Use the search above to add items
          </Typography>
        </Box>
        <ItemFormDialog
          open={editItem !== null}
          item={editItem}
          onClose={() => setEditItem(null)}
          onDeleteRequest={editItem ? () => setEditItem(null) : undefined}
        />
      </>
    )
  }

  const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

  const visibleItems = selectedSupermarkets.size === 0
    ? allItems
    : allItems.filter(i => i.supermarkets.some(s => selectedSupermarkets.has(s)))

  const groupMap: Record<string, Item[]> = {}
  for (const item of visibleItems) {
    const key = item.category ?? 'Other'
    ;(groupMap[key] ??= []).push(item)
  }
  const groups: Array<[string, Item[]]> = Object.entries(groupMap)
    .sort(([a], [b]) => a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b))
    .map(([label, groupItems]) => [label, [...groupItems].sort(byName)])

  return (
    <Box sx={{ pb: 10 }}>
      {incompleteItems.length > 0 && (
        <Box sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          bgcolor: 'warning.main', color: 'warning.contrastText',
          borderRadius: 2, px: 2, py: 1, mb: 1.5, opacity: 0.9,
        }}>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>
            {incompleteItems.length === 1
              ? '1 item missing category or supermarket'
              : `${incompleteItems.length} items missing category or supermarket`}
          </Typography>
          <Button
            size="small"
            sx={{ color: 'warning.contrastText', fontWeight: 600, ml: 1 }}
            onClick={() => setIncompleteSheetOpen(true)}
          >
            Review
          </Button>
        </Box>
      )}

      {allSupermarkets.length > 0 && (
        <Box sx={{
          display: 'flex', gap: 1, overflowX: 'auto', pb: 0.5, mb: 1.5,
          scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' },
        }}>
          {allSupermarkets.map(s => (
            <Chip
              key={s}
              label={s}
              clickable
              color={selectedSupermarkets.has(s) ? 'primary' : 'default'}
              variant={selectedSupermarkets.has(s) ? 'filled' : 'outlined'}
              size="small"
              onClick={() => setSelectedSupermarkets(prev => {
                const next = new Set(prev)
                next.has(s) ? next.delete(s) : next.add(s)
                return next
              })}
              sx={{ flexShrink: 0 }}
            />
          ))}
        </Box>
      )}

      {groups.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ textAlign: 'center', mt: 4 }}>
          No items for selected supermarket(s)
        </Typography>
      ) : (
        groups.map(([label, groupItems]) => (
          <GroupSection
            key={label}
            label={label}
            items={groupItems}
            removingIds={removingIds}
            onRemove={handleRemove}
            onEdit={setEditItem}
          />
        ))
      )}

      <ItemFormDialog
        open={editItem !== null}
        item={editItem}
        onClose={() => setEditItem(null)}
        onDeleteRequest={editItem ? () => setEditItem(null) : undefined}
      />
      <IncompleteItemsSheet
        open={incompleteSheetOpen}
        items={incompleteItems}
        onClose={() => setIncompleteSheetOpen(false)}
        onEdit={item => setEditItem(item)}
      />
    </Box>
  )
}
