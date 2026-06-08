import { useState, useMemo } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useItems, useDeleteItem, useToggleShoppingList } from '../api'
import type { Item } from '../api'
import ItemFormDialog from './ItemFormDialog'
import MergeDuplicatesSheet from './MergeDuplicatesSheet'
import IncompleteItemsSheet from './IncompleteItemsSheet'

// ── Item row ──────────────────────────────────────────────────────────────────

function ItemRow({ item, onEdit, onToggle }: { item: Item; onEdit: (i: Item) => void; onToggle: (i: Item) => void }) {
  return (
    <li className="flex items-center">
      <button
        className="flex-1 px-4 py-2 pr-24 text-left hover:bg-muted/50 transition-colors"
        onClick={() => onEdit(item)}
      >
        <div className="text-sm">{item.name}</div>
        {item.supermarkets.length > 0 && (
          <div className="text-xs text-muted-foreground">{item.supermarkets.join(', ')}</div>
        )}
      </button>
      <div className="absolute right-3">
        <Button
          size="sm"
          variant={item.onShoppingList ? 'outline' : 'default'}
          onClick={e => { e.stopPropagation(); onToggle(item) }}
          className="min-w-[68px]"
        >
          {item.onShoppingList ? 'Remove' : 'Add'}
        </Button>
      </div>
    </li>
  )
}

// ── Group section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  label: string
  items: Item[]
  onEdit: (item: Item) => void
  onToggle: (item: Item) => void
}

function GroupSection({ label, items, onEdit, onToggle }: GroupSectionProps) {
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <button
          onClick={() => setOpen(o => !o)}
          className={`w-full flex items-center px-4 py-3 sticky top-[98px] z-[8] bg-card hover:bg-background transition-colors ${open ? 'rounded-t-lg' : 'rounded-lg'}`}
        >
          <span className="flex-1 text-left text-xs font-semibold uppercase tracking-[.08em] text-muted-foreground leading-none">
            {label}
          </span>
          <span className="text-xs text-muted-foreground mr-2">{items.length}</span>
          {open
            ? <ChevronUp className="size-4 text-muted-foreground" />
            : <ChevronDown className="size-4 text-muted-foreground" />}
        </button>

        <CollapsibleContent>
          <div className="rounded-b-lg overflow-hidden">
            <Separator />
            <ul className="relative">
              {items.map((item, idx) => (
                <span key={item.id}>
                  {idx > 0 && <Separator className="ml-4" />}
                  <ItemRow item={item} onEdit={onEdit} onToggle={onToggle} />
                </span>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  )
}

// ── Delete confirmation ───────────────────────────────────────────────────────

interface DeleteConfirmProps {
  item: Item | null
  onConfirm: () => void
  onCancel: () => void
}

function DeleteConfirm({ item, onConfirm, onCancel }: DeleteConfirmProps) {
  const isMobile = window.innerWidth < 768

  if (isMobile) {
    return (
      <Drawer open={!!item} onOpenChange={open => { if (!open) onCancel() }}>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Delete "{item?.name}"?</DrawerTitle>
            <p className="text-sm text-muted-foreground">
              This will permanently remove the item from your inventory.
            </p>
          </DrawerHeader>
          <DrawerFooter>
            <Button variant="destructive" onClick={onConfirm}>Delete</Button>
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
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
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          This will permanently remove the item from your inventory.
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button variant="destructive" onClick={onConfirm}>Delete</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function ItemsSkeleton() {
  return (
    <div>
      <div className="flex mb-3">
        <Skeleton className="w-[220px] h-8 rounded" />
      </div>
      {[5, 3].map((rows, gi) => (
        <div key={gi} className="bg-card rounded-lg border border-border overflow-hidden shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
          <div className="px-4 py-3">
            <Skeleton className="w-[100px] h-3.5" />
          </div>
          <Separator />
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i}>
              {i > 0 && <Separator className="ml-4" />}
              <div className="px-4 py-3">
                <Skeleton className="w-1/2 h-4" />
                <div className="flex gap-1.5 mt-1.5">
                  <Skeleton className="w-16 h-5 rounded-full" />
                  <Skeleton className="w-18 h-5 rounded-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// ── Items ─────────────────────────────────────────────────────────────────────

export default function Items() {
  const { data, isLoading, error } = useItems()
  const deleteItem = useDeleteItem()
  const toggleShoppingList = useToggleShoppingList()
  const [editTarget, setEditTarget] = useState<Item | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Item | null>(null)
  const [mergeSheetOpen, setMergeSheetOpen] = useState(false)
  const [selectedSupermarkets, setSelectedSupermarkets] = useState<Set<string>>(new Set())
  const [incompleteSheetOpen, setIncompleteSheetOpen] = useState(false)

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

  const allSupermarkets = useMemo(() =>
    [...new Set(allItems.flatMap(i => i.supermarkets))].sort(),
  [allItems])

  const incompleteItems = useMemo(() =>
    allItems.filter(i => i.category === null || i.supermarkets.length === 0),
  [allItems])

  if (isLoading) return <ItemsSkeleton />

  if (error) {
    return <p className="text-destructive p-4">Failed to load items.</p>
  }

  if (allItems.length === 0) {
    return (
      <div className="pt-10 text-center px-8">
        <img src="/casita.webp" alt="" className="w-20 mb-4 opacity-70 mx-auto" />
        <p className="text-sm font-medium text-muted-foreground mb-1">No items yet</p>
        <p className="text-sm text-muted-foreground/60">Use the search above to add your first item</p>
      </div>
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

  function handleDeleteRequest() {
    // Close edit first, then open confirm sheet
    const target = editTarget
    setEditTarget(null)
    // Small delay so edit sheet finishes closing before confirm opens
    setTimeout(() => setDeleteTarget(target), 150)
  }

  function handleDeleteConfirm() {
    if (deleteTarget) deleteItem.mutate(deleteTarget.id)
    setDeleteTarget(null)
  }

  return (
    <div className="pb-10">
      {duplicateGroups.length > 0 && (
        <div className="flex items-center justify-between bg-warning/90 text-warning-foreground rounded-lg px-4 py-2 mb-3">
          <p className="text-sm font-medium">
            {duplicateGroups.length === 1
              ? '1 duplicate name found'
              : `${duplicateGroups.length} duplicate names found`}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-foreground font-semibold ml-2 hover:bg-warning-foreground/10"
            onClick={() => setMergeSheetOpen(true)}
          >
            Review
          </Button>
        </div>
      )}

      {incompleteItems.length > 0 && (
        <div className="flex items-center justify-between bg-warning/90 text-warning-foreground rounded-lg px-4 py-2 mb-3">
          <p className="text-sm font-medium">
            {incompleteItems.length === 1
              ? '1 item missing category or supermarket'
              : `${incompleteItems.length} items missing category or supermarket`}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-foreground font-semibold ml-2 hover:bg-warning-foreground/10"
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
            onEdit={setEditTarget}
            onToggle={item => toggleShoppingList.mutate({ id: item.id, onShoppingList: !item.onShoppingList })}
          />
        ))
      )}

      <ItemFormDialog
        open={editTarget !== null}
        item={editTarget}
        onClose={() => setEditTarget(null)}
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

      <IncompleteItemsSheet
        open={incompleteSheetOpen}
        items={incompleteItems}
        onClose={() => setIncompleteSheetOpen(false)}
        onEdit={item => { setEditTarget(item) }}
      />
    </div>
  )
}
