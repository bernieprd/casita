import { useState, useCallback, useRef, useMemo } from 'react'
import { useIsMobile } from '../hooks/useIsMobile'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import ItemFormDialog from './ItemFormDialog'
import IncompleteItemsSheet from './IncompleteItemsSheet'
import { ItemRow, EXIT_DURATION_MS } from './ItemRow'
import { useShoppingList, useToggleShoppingList, useDeleteItem } from '../api'
import type { Item } from '../api'

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

// ── Delete confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  item: Item | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirm({ item, onConfirm, onCancel }: DeleteConfirmProps) {
  const isMobile = useIsMobile()

  if (isMobile) {
    return (
      <Drawer open={!!item} onOpenChange={open => { if (!open) onCancel() }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete "{item?.name}"?</DrawerTitle>
            <DrawerDescription>
              This will permanently remove the item from your inventory.
            </DrawerDescription>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    )
  }

  return (
    <Dialog open={!!item} onOpenChange={open => { if (!open) onCancel() }}>
      <DialogContent showCloseButton={false} className="max-w-xs">
        <DialogHeader>
          <DialogTitle>Delete "{item?.name}"?</DialogTitle>
          <DialogDescription>
            This will permanently remove the item from your inventory.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Shopping row wrapper (handles per-item hook) ──────────────────────────────

function ShoppingRow({ item, removingIds, onRemove, onEdit }: { item: Item; removingIds: Set<string>; onRemove: (id: string) => void; onEdit: (item: Item) => void }) {
  const { handlers, didFire } = useLongPress(() => onEdit(item))
  return (
    <ItemRow
      variant="shopping"
      name={item.name}
      subtitle={item.supermarkets.length > 0 ? item.supermarkets.join(', ') : undefined}
      removing={removingIds.has(item.id)}
      handlers={handlers}
      didFire={didFire}
      onRemove={() => onRemove(item.id)}
    />
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
    <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
      <button
        onClick={() => setOpen(o => !o)}
        aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
        aria-expanded={open}
        className={`flex items-center w-full px-4 py-3 sticky top-[57px] z-[8] bg-card hover:bg-background transition-colors ${open ? 'rounded-t-lg' : 'rounded-lg'}`}
      >
        <span className="flex-1 text-left text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground leading-none">
          {label}
        </span>
        <span className="text-xs text-muted-foreground mr-2">{visibleCount}</span>
        {open
          ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
          : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>

      <div
        style={{
          overflow: 'hidden',
          transition: 'max-height 0.2s ease',
          maxHeight: open ? '9999px' : 0,
        }}
      >
        <div className="rounded-b-lg overflow-hidden">
          <hr className="border-border" />
          <ul>
            {items.map((item, idx) => (
              <li key={item.id}>
                {idx > 0 && <hr className="border-border" />}
                <ShoppingRow item={item} removingIds={removingIds} onRemove={onRemove} onEdit={onEdit} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ShoppingListSkeleton() {
  return (
    <div>
      {[3, 2].map((rows, gi) => (
        <div key={gi} className="bg-card rounded-lg overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
          <div className="px-4 py-3">
            <Skeleton className="h-3.5 w-[90px]" />
          </div>
          <hr className="border-border" />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i}>
              {i > 0 && <hr className="border-border ml-14" />}
              <div className="px-4 py-2 flex items-center gap-3">
                <Skeleton className="h-5 w-5 rounded-full shrink-0" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-[55%]" />
                  <Skeleton className="h-3 w-[28%] mt-1" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── ShoppingList ──────────────────────────────────────────────────────────────

export default function ShoppingList() {
  const { data: items, isLoading, error } = useShoppingList()
  const toggle = useToggleShoppingList()
  const deleteItem = useDeleteItem()
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set())
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
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
  }, [toggle.mutate])

  function handleDeleteRequest() {
    const target = editItem
    setEditItem(null)
    setTimeout(() => setDeleteTarget(target), 150)
  }

  function handleDeleteConfirm() {
    if (deleteTarget) deleteItem.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  if (isLoading) return <ShoppingListSkeleton />

  if (error) {
    return <p className="p-4 text-destructive text-sm">Failed to load shopping list.</p>
  }

  const totalVisible = allItems.filter(i => !removingIds.has(i.id)).length

  if (totalVisible === 0) {
    return (
      <>
        <div className="pt-10 text-center px-8">
          <img src="/casita.webp" alt="" className="w-20 mb-4 opacity-70 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground mb-1">Your list is empty</p>
          <p className="text-sm text-muted-foreground/60">Use the search above to add items</p>
        </div>
        <ItemFormDialog
          open={editItem !== null}
          item={editItem}
          onClose={() => setEditItem(null)}
          onDeleteRequest={editItem ? handleDeleteRequest : undefined}
        />
        <DeleteConfirm
          item={deleteTarget}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTarget(null)}
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
    <div className="pb-10">
      {incompleteItems.length > 0 && (
        <div className="flex items-center justify-between bg-warning text-warning-foreground rounded-lg px-4 py-2 mb-3 opacity-90">
          <p className="text-sm font-medium">
            {incompleteItems.length === 1
              ? '1 item missing category or supermarket'
              : `${incompleteItems.length} items missing category or supermarket`}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-foreground font-semibold ml-2"
            onClick={() => setIncompleteSheetOpen(true)}
          >
            Review
          </Button>
        </div>
      )}

      {allSupermarkets.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {allSupermarkets.map(s => (
            <button
              key={s}
              onClick={() => setSelectedSupermarkets(prev => {
                const next = new Set(prev)
                next.has(s) ? next.delete(s) : next.add(s)
                return next
              })}
              className="shrink-0 min-h-[44px] flex items-center"
            >
              <Badge
                variant={selectedSupermarkets.has(s) ? 'default' : 'outline'}
                className="cursor-pointer"
              >
                {s}
              </Badge>
            </button>
          ))}
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center mt-8">
          No items for selected supermarket(s)
        </p>
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
        onDeleteRequest={editItem ? handleDeleteRequest : undefined}
      />
      <DeleteConfirm
        item={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
      />
      <IncompleteItemsSheet
        open={incompleteSheetOpen}
        items={incompleteItems}
        onClose={() => setIncompleteSheetOpen(false)}
        onEdit={item => setEditItem(item)}
      />
    </div>
  )
}
