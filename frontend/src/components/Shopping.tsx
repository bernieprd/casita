import { useState, useMemo, useEffect, useCallback, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useMatch } from 'react-router-dom'
import { Search, X, PlusCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import ShoppingList from './ShoppingList'
import Items from './Items'
import ItemFormDialog from './ItemFormDialog'
import { useItems, useToggleShoppingList, useCreateItem } from '../api'
import type { Item } from '../api'

const EMPTY_ITEMS: Item[] = []

type SubTab = 'list' | 'inventory'

export default function Shopping({ setHeader }: { setHeader: (node: ReactNode | null) => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const isInventory = useMatch('/shopping/inventory')
  const sub: SubTab = isInventory ? 'inventory' : 'list'
  const [query, setQuery] = useState('')
  const [editItem, setEditItem] = useState<Item | null>(null)

  const { data: allItems = EMPTY_ITEMS } = useItems()
  const toggle = useToggleShoppingList()
  const create = useCreateItem()

  const q = query.trim().toLowerCase()

  const filtered = useMemo(() => {
    if (!q) return []
    return allItems
      .filter(i => i.name.toLowerCase().split(/\s+/).some(word => word.startsWith(q)))
      .sort((a, b) => {
        if (a.onShoppingList !== b.onShoppingList) return a.onShoppingList ? 1 : -1
        return a.name.localeCompare(b.name)
      })
  }, [allItems, q])

  const hasExactMatch = filtered.some(i => i.name.toLowerCase().trim() === q)
  const showCreate = q.length > 0 && !hasExactMatch

  const handleToggle = useCallback((item: Item) => {
    toggle.mutate({ id: item.id, onShoppingList: !item.onShoppingList })
  }, [toggle.mutate])

  const queryRef = useRef(query)
  useEffect(() => { queryRef.current = query })

  const handleCreate = useCallback(() => {
    create.mutate(
      { name: queryRef.current.trim(), category: null, supermarkets: [], onShoppingList: true },
      {
        onSuccess: item => { setQuery(''); setEditItem(item) },
        onError: () => toast.error(t('shopping.couldNotCreate')),
      },
    )
  }, [create.mutate])

  useEffect(() => {
    setHeader(
      <div className="flex-1 relative px-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 pr-9"
            placeholder={t('shopping.searchInventory')}
            value={query}
            onChange={e => setQuery(e.target.value)}
          />
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setQuery('')}
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {q && (
          <div
            className="absolute top-full left-0 right-0 z-[51] mt-1 rounded-lg border bg-card shadow-lg overflow-y-auto"
            style={{ maxHeight: 'calc(100dvh - 160px - env(safe-area-inset-bottom))' }}
          >
            {filtered.length === 0 && !showCreate && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                {t('shopping.noItemsMatch')}
              </p>
            )}

            <ul className="py-1">
              {filtered.map((item, idx) => (
                <li key={item.id}>
                  {idx > 0 && <hr className="border-border" />}
                  <div className="flex items-center pr-2">
                    <button
                      className="flex-1 px-4 py-2 text-left hover:bg-accent transition-colors"
                      onClick={() => handleToggle(item)}
                    >
                      <span className={`block text-sm ${item.onShoppingList ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {item.name}
                      </span>
                      {item.category && (
                        <span className="block text-xs text-muted-foreground">{item.category}</span>
                      )}
                    </button>
                    <Button
                      size="sm"
                      variant={item.onShoppingList ? 'outline' : 'default'}
                      className="shrink-0 min-w-[68px]"
                      onClick={e => { e.stopPropagation(); handleToggle(item) }}
                    >
                      {item.onShoppingList ? t('common.remove') : t('common.add')}
                    </Button>
                  </div>
                </li>
              ))}

              {showCreate && (
                <>
                  {filtered.length > 0 && <hr className="border-border" />}
                  <li>
                    <button
                      className="flex items-center gap-2 w-full px-4 py-2 hover:bg-accent transition-colors disabled:opacity-50"
                      onClick={handleCreate}
                      disabled={create.isPending}
                    >
                      <PlusCircle className="h-4 w-4 text-primary shrink-0" />
                      <div className="text-left">
                        <span className="block text-sm">
                          {t('shopping.createItem', { name: query.trim() })}
                        </span>
                        <span className="block text-xs text-muted-foreground">{t('shopping.itemAdded')}</span>
                      </div>
                    </button>
                  </li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    )
    return () => setHeader(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, allItems, create.isPending, setHeader])

  return (
    <div>
      {/* Backdrop: captures clicks outside the dropdown so they close it
          without also triggering actions on list items beneath it. */}
      {q && (
        <div
          className="fixed inset-0 z-[9]"
          onClick={() => setQuery('')}
        />
      )}

      {/* Tabs — sticky right below header so navigation is always reachable */}
      <Tabs
        value={sub}
        onValueChange={(v) => navigate(v === 'inventory' ? '/shopping/inventory' : '/shopping')}
      >
        <TabsList variant="line" className="sticky top-[57px] w-full border-b border-border rounded-none h-auto pb-0 bg-background z-10">
          <TabsTrigger value="list">{t('shopping.shoppingListTab')}</TabsTrigger>
          <TabsTrigger value="inventory">{t('shopping.inventoryTab')}</TabsTrigger>
        </TabsList>
      </Tabs>

      {sub === 'list'      && <ShoppingList />}
      {sub === 'inventory' && <Items />}

      <ItemFormDialog
        open={editItem !== null}
        item={editItem}
        onClose={() => setEditItem(null)}
      />
    </div>
  )
}
