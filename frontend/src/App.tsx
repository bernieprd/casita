import { useState } from 'react'
import './App.css'
import ShoppingList from './components/ShoppingList'
import Items from './components/Items'
import Recipes from './components/Recipes'

type Tab = 'shopping' | 'items' | 'recipes'

const TABS: { id: Tab; label: string }[] = [
  { id: 'shopping', label: 'Shopping list' },
  { id: 'items', label: 'All items' },
  { id: 'recipes', label: 'Recipes' },
]

export default function App() {
  const [tab, setTab] = useState<Tab>('shopping')

  return (
    <div className="app">
      <header className="app-header">
        <h1>Casita</h1>
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              className={`tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main>
        {tab === 'shopping' && <ShoppingList />}
        {tab === 'items'    && <Items />}
        {tab === 'recipes'  && <Recipes />}
      </main>
    </div>
  )
}
