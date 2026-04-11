import { useState, useCallback, useRef } from 'react'
import Fab from '@mui/material/Fab'
import AddIcon from '@mui/icons-material/Add'
import Box from '@mui/material/Box'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import QuickAddDialog from './QuickAddDialog'
import ItemFormDialog from './ItemFormDialog'
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

type GroupBy = 'category' | 'supermarket' | 'none'

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
  groupBy: GroupBy
  onRemove: (id: string) => void
  onEdit: (item: Item) => void
}

function ShoppingItemRow({ item, removing, groupBy, onRemove, onEdit }: ShoppingItemRowProps) {
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
            checked
            color="primary"
            tabIndex={-1}
            inputProps={{ 'aria-label': `Remove ${item.name} from shopping list` }}
          />
        </ListItemIcon>
        <ListItemText
          primary={item.name}
          secondary={
            groupBy === 'category'
              ? (item.supermarkets.length ? item.supermarkets.join(', ') : undefined)
              : (item.category ?? undefined)
          }
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
  groupBy: GroupBy
}

function GroupSection({ label, items, removingIds, onRemove, onEdit, groupBy }: GroupSectionProps) {
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
                groupBy={groupBy}
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
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [groupBy, setGroupBy] = useState<GroupBy>('category')
  const [sortGroups, setSortGroups] = useState<'alpha' | 'count'>('alpha')

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

  const allItems = items ?? []
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
            Tap + to add items from your inventory
          </Typography>
        </Box>
        <Fab
          color="primary"
          aria-label="Add to shopping list"
          onClick={() => setQuickAddOpen(true)}
          sx={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 24 }}
        >
          <AddIcon />
        </Fab>
        <QuickAddDialog
          open={quickAddOpen}
          onClose={() => setQuickAddOpen(false)}
          onCreated={item => setEditItem(item)}
        />
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
          aria-label="Group shopping list by"
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
                  {idx > 0 && <Divider component="li" sx={{ ml: 7 }} />}
                  <ShoppingItemRow
                    item={item}
                    removing={removingIds.has(item.id)}
                    groupBy={groupBy}
                    onRemove={handleRemove}
                    onEdit={setEditItem}
                  />
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
            removingIds={removingIds}
            onRemove={handleRemove}
            onEdit={setEditItem}
            groupBy={groupBy}
          />
        ))
      }

      <Fab
        color="primary"
        aria-label="Add to shopping list"
        onClick={() => setQuickAddOpen(true)}
        sx={{ position: 'fixed', bottom: 'calc(80px + env(safe-area-inset-bottom))', right: 24 }}
      >
        <AddIcon />
      </Fab>

      <QuickAddDialog
        open={quickAddOpen}
        onClose={() => setQuickAddOpen(false)}
        onCreated={item => setEditItem(item)}
      />
      <ItemFormDialog
        open={editItem !== null}
        item={editItem}
        onClose={() => setEditItem(null)}
        onDeleteRequest={editItem ? () => setEditItem(null) : undefined}
      />
    </Box>
  )
}
