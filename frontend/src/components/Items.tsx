import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible'
import { useItems, useToggleShoppingList } from '../api'
import type { Item } from '../api'
import MergeDuplicatesSheet from './MergeDuplicatesSheet'
import IncompleteItemsSheet from './IncompleteItemsSheet'
import { ItemRow } from './ItemRow'
import GuidedImport from './GuidedImport'
import { ImportModal } from './ImportModal'

// ── Group section ─────────────────────────────────────────────────────────────

interface GroupSectionProps {
  label: string
  items: Item[]
  onEdit: (item: Item) => void
  onToggle: (item: Item) => void
}

function GroupSection({ label, items, onEdit, onToggle }: GroupSectionProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  return (
    <div className="bg-card rounded-lg border border-border shadow-[0_1px_2px_rgba(0,0,0,.06)] mb-2">
      <Collapsible open={open} onOpenChange={setOpen}>
        <button
          onClick={() => setOpen(o => !o)}
          aria-label={open ? t('todos.collapseStatus', { status: label }) : t('todos.expandStatus', { status: label })}
          aria-expanded={open}
          className={`w-full flex items-center px-4 py-3 sticky top-[57px] z-[8] bg-card hover:bg-background transition-colors ${open ? 'rounded-t-lg' : 'rounded-lg'}`}
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
            <ul>
              {items.map((item, idx) => (
                <li key={item.id}>
                  {idx > 0 && <Separator />}
                  <ItemRow
                    variant="inventory"
                    name={item.name}
                    subtitle={item.supermarkets.length > 0 ? item.supermarkets.join(', ') : undefined}
                    onShoppingList={item.onShoppingList}
                    onRowClick={() => onEdit(item)}
                    onToggle={() => onToggle(item)}
                  />
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
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
              {i > 0 && <Separator />}
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data, isLoading, error } = useItems()
  const toggleShoppingList = useToggleShoppingList()
  const [importOpen, setImportOpen] = useState(false)
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
    return <p className="text-destructive p-4">{t('items.failedToLoad')}</p>
  }

  if (allItems.length === 0) {
    return (
      <>
        <div className="pt-10 text-center px-8">
          <img src="/casita.webp" alt="" className="w-20 mb-4 opacity-70 mx-auto" />
          <p className="text-sm font-medium text-muted-foreground mb-1">{t('items.noItemsYet')}</p>
          <p className="text-sm text-muted-foreground/60">{t('items.getStarted')}</p>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="mt-3 text-sm text-primary hover:underline underline-offset-4 transition-colors"
          >
            {t('items.orImport')}
          </button>
        </div>
        <ImportModal open={importOpen} onOpenChange={setImportOpen} description={t('items.importDescription')}>
          <GuidedImport onDone={() => setImportOpen(false)} onSkip={() => setImportOpen(false)} />
        </ImportModal>
      </>
    )
  }

  const byName = (a: Item, b: Item) => a.name.localeCompare(b.name)

  const visibleItems = selectedSupermarkets.size === 0
    ? allItems
    : allItems.filter(i => i.supermarkets.some(s => selectedSupermarkets.has(s)))

  const groupMap: Record<string, Item[]> = {}
  for (const item of visibleItems) {
    const key = item.category ?? '__other__'
    ;(groupMap[key] ??= []).push(item)
  }
  const groups: Array<[string, Item[]]> = Object.entries(groupMap)
    .sort(([a], [b]) => a === '__other__' ? 1 : b === '__other__' ? -1 : a.localeCompare(b))
    .map(([key, groupItems]) => [key === '__other__' ? t('shopping.other') : key, [...groupItems].sort(byName)])

  return (
    <div className="pb-10">
      {duplicateGroups.length > 0 && (
        <div className="flex items-center justify-between bg-warning/90 text-warning-foreground rounded-lg px-4 py-2 mb-3">
          <p className="text-sm font-medium">
            {t('items.duplicates', { count: duplicateGroups.length })}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-foreground font-semibold ml-2 hover:bg-warning-foreground/10"
            onClick={() => setMergeSheetOpen(true)}
          >
            {t('common.review')}
          </Button>
        </div>
      )}

      {incompleteItems.length > 0 && (
        <div className="flex items-center justify-between bg-warning/90 text-warning-foreground rounded-lg px-4 py-2 mb-3">
          <p className="text-sm font-medium">
            {t('shopping.missingInfo', { count: incompleteItems.length })}
          </p>
          <Button
            size="sm"
            variant="ghost"
            className="text-warning-foreground font-semibold ml-2 hover:bg-warning-foreground/10"
            onClick={() => setIncompleteSheetOpen(true)}
          >
            {t('common.review')}
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
          {t('shopping.noItemsForSupermarket')}
        </p>
      ) : (
        groups.map(([label, groupItems]) => (
          <GroupSection
            key={label}
            label={label}
            items={groupItems}
            onEdit={item => navigate('/items/' + item.id + '/edit', { state: { fromApp: true } })}
            onToggle={item => toggleShoppingList.mutate({ id: item.id, onShoppingList: !item.onShoppingList })}
          />
        ))
      )}

      <MergeDuplicatesSheet
        open={mergeSheetOpen}
        groups={duplicateGroups}
        onClose={() => setMergeSheetOpen(false)}
      />

      <IncompleteItemsSheet
        open={incompleteSheetOpen}
        items={incompleteItems}
        onClose={() => setIncompleteSheetOpen(false)}
        onEdit={item => navigate('/items/' + item.id + '/edit', { state: { fromApp: true } })}
      />
    </div>
  )
}
