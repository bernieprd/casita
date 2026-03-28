import { useState } from 'react'
import AppBar from '@mui/material/AppBar'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import BottomNavigation from '@mui/material/BottomNavigation'
import BottomNavigationAction from '@mui/material/BottomNavigationAction'
import Paper from '@mui/material/Paper'
import Box from '@mui/material/Box'
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart'
import StorefrontIcon from '@mui/icons-material/Storefront'
import MenuBookIcon from '@mui/icons-material/MenuBook'
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
      </AppBar>

      <Box sx={{ maxWidth: 600, mx: 'auto', px: 2, pt: 2, pb: 10 }}>
        {tab === 'shopping' && <ShoppingList />}
        {tab === 'items'    && <Items />}
        {tab === 'recipes'  && <Recipes />}
      </Box>

      <Paper
        elevation={3}
        sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }}
      >
        <BottomNavigation
          value={tab}
          onChange={(_, v: TabId) => setTab(v)}
          sx={{ maxWidth: 600, mx: 'auto' }}
        >
          <BottomNavigationAction
            label="Shopping"
            value="shopping"
            icon={<ShoppingCartIcon />}
          />
          <BottomNavigationAction
            label="Inventory"
            value="items"
            icon={<StorefrontIcon />}
          />
          <BottomNavigationAction
            label="Recipes"
            value="recipes"
            icon={<MenuBookIcon />}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  )
}
