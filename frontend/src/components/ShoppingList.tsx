import { useShoppingList, useToggleShoppingList } from '../api'

export default function ShoppingList() {
  const { data: items, isLoading, error } = useShoppingList()
  const toggle = useToggleShoppingList()

  if (isLoading) return <p className="loading">Loading…</p>
  if (error) return <p className="error">Failed to load shopping list.</p>
  if (!items?.length) return <p className="empty">Nothing on the shopping list.</p>

  const byCategory = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category ?? 'Other'
    ;(acc[cat] ??= []).push(item)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
        <section key={cat}>
          <p className="section-title">{cat}</p>
          <div className="item-list">
            {catItems.map(item => (
              <div key={item.id} className="item-row">
                <input
                  type="checkbox"
                  checked={item.onShoppingList}
                  onChange={e =>
                    toggle.mutate({ id: item.id, onShoppingList: e.target.checked })
                  }
                />
                <div className="item-info">
                  <div className="item-name">{item.name}</div>
                  {item.supermarkets.length > 0 && (
                    <div className="item-meta">{item.supermarkets.join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
