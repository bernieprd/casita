import { useItems, useToggleShoppingList } from '../api'

export default function Items() {
  const { data: items, isLoading, error } = useItems()
  const toggle = useToggleShoppingList()

  if (isLoading) return <p className="loading">Loading…</p>
  if (error) return <p className="error">Failed to load items.</p>
  if (!items?.length) return <p className="empty">No items found.</p>

  const byCategory = items.reduce<Record<string, typeof items>>((acc, item) => {
    const cat = item.category ?? 'Other'
    ;(acc[cat] ??= []).push(item)
    return acc
  }, {})

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {Object.entries(byCategory).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
        <section key={cat}>
          <p className="section-title">{cat} <span style={{ fontWeight: 400 }}>({catItems.length})</span></p>
          <div className="item-list">
            {catItems.map(item => (
              <div key={item.id} className="item-row">
                <input
                  type="checkbox"
                  checked={item.onShoppingList}
                  title={item.onShoppingList ? 'Remove from shopping list' : 'Add to shopping list'}
                  onChange={e =>
                    toggle.mutate({ id: item.id, onShoppingList: e.target.checked })
                  }
                />
                <div className="item-info">
                  <span className={`item-name${item.onShoppingList ? ' checked' : ''}`}>
                    {item.name}
                  </span>
                  <div className="item-meta">
                    {item.supermarkets.length > 0 && <span>{item.supermarkets.join(', ')}</span>}
                    {item.tags.map(tag => (
                      <span key={tag} className="tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
