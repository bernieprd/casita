import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Tabs from '@mui/material/Tabs'
import Tab from '@mui/material/Tab'
import Box from '@mui/material/Box'
import ShoppingList from './components/ShoppingList'
import Items from './components/Items'
import Recipes from './components/Recipes'

type TabId = 'shopping' | 'items' | 'recipes'

export default function App() {
  const [tab, setTab] = useState<TabId>('shopping')

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <AppBar position="sticky" color="inherit" sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar sx={{ px: { xs: 2 } }}>
          <Typography variant="h6" fontWeight={700} color="text.primary">
            Casita
          </Typography>
        </Toolbar>
        <Tabs
          value={tab}
          onChange={(_, v: TabId) => setTab(v)}
          sx={{ px: 2, minHeight: 40 }}
          TabIndicatorProps={{ style: { height: 3 } }}
        >
          <Tab label="Shopping list" value="shopping" sx={{ minHeight: 40 }} />
          <Tab label="All items"     value="items"    sx={{ minHeight: 40 }} />
          <Tab label="Recipes"       value="recipes"  sx={{ minHeight: 40 }} />
        </Tabs>
      </AppBar>

      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, py: 2 }}>
        {tab === 'shopping' && <ShoppingList />}
        {tab === 'items'    && <Items />}
        {tab === 'recipes'  && <Recipes />}
      </Box>
    </Box>
  )
}
