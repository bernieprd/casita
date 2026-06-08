import { useState, useMemo } from 'react'
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

type SubTab = 'list' | 'inventory'

export default function Shopping() {
  const navigate = useNavigate()
  const isInventory = useMatch('/shopping/inventory')
  const sub: SubTab = isInventory ? 'inventory' : 'list'
  const [query, setQuery] = useState('')
  const [editItem, setEditItem] = useState<Item | null>(null)

  const { data: allItems = [] } = useItems()
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

  function handleToggle(item: Item) {
    toggle.mutate({ id: item.id, onShoppingList: !item.onShoppingList })
  }

  function handleCreate() {
    create.mutate(
      { name: query.trim(), category: null, supermarkets: [], onShoppingList: true },
      {
        onSuccess: item => { setQuery(''); setEditItem(item) },
        onError: () => toast.error('Could not create item. Check that the worker is running.'),
      },
    )
  }

  return (
    <div>
      {/* Backdrop: captures clicks outside the search area so they close the
          dropdown without also triggering actions on list items beneath it. */}
      {q && (
        <div
          className="fixed inset-0 z-[9]"
          onClick={() => setQuery('')}
        />
      )}

      {/* Search bar — matches Recipes / Todos sticky bar pattern */}
      <div className="sticky top-[57px] sm:top-[65px] -ml-[calc(50vw-50%)] w-screen -mt-8 z-10 bg-background border-b border-border">
        <div className="max-w-[600px] mx-auto px-4 py-3 relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="Search inventory…"
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
              className="absolute top-full left-4 right-4 z-10 mt-1 rounded-lg border bg-card shadow-lg overflow-y-auto"
              style={{ maxHeight: 'calc(100dvh - 210px - env(safe-area-inset-bottom))' }}
            >
              {filtered.length === 0 && !showCreate && (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  No items match.
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
                        {item.onShoppingList ? 'Remove' : 'Add'}
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
                            Create <span className="font-semibold">"{query.trim()}"</span>
                          </span>
                          <span className="block text-xs text-muted-foreground">New item · added to shopping list</span>
                        </div>
                      </button>
                    </li>
                  </>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>

      <Tabs
        value={sub}
        onValueChange={(v) => navigate(v === 'inventory' ? '/shopping/inventory' : '/shopping')}
        className="mb-4"
      >
        <TabsList variant="line" className="w-full border-b border-border rounded-none h-auto pb-0">
          <TabsTrigger value="list">Shopping list</TabsTrigger>
          <TabsTrigger value="inventory">Inventory</TabsTrigger>
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
